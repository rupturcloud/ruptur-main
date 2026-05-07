/**
 * Tenant Configuration Service - Admin
 * Gerencia configurações e settings de tenants
 *
 * Métodos:
 * - getTenantSettings(tenantId) - Obter configurações
 * - updateTenantSettings(tenantId, settings, updatedBy) - Atualizar settings
 * - getTenantMembers(tenantId) - Listar membros
 * - updateMemberRole(tenantId, userId, role, updatedBy) - Mudar role
 * - getTenantBilling(tenantId) - Info de billing
 * - getTenantAudit(tenantId, limit) - Logs de auditoria
 */

export class TenantConfigService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Obter configurações completas de um tenant
   */
  async getTenantSettings(tenantId) {
    try {
      if (!tenantId) throw new Error('tenantId é obrigatório');

      const { data: tenant, error } = await this.supabase
        .from('tenants')
        .select('id, slug, name, email, plan, status, credits_balance, trial_ends_at, created_at, updated_at')
        .eq('id', tenantId)
        .single();

      if (error) throw error;

      return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        email: tenant.email,
        plan: tenant.plan,
        status: tenant.status,
        creditsBalance: tenant.credits_balance,
        trialEndsAt: tenant.trial_ends_at,
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at
      };
    } catch (error) {
      console.error('[TenantConfig] getTenantSettings error:', error.message);
      throw error;
    }
  }

  /**
   * Atualizar configurações de tenant
   */
  async updateTenantSettings(tenantId, updates, updatedBy) {
    try {
      if (!tenantId || !updatedBy) {
        throw new Error('tenantId e updatedBy são obrigatórios');
      }

      const allowedFields = ['name', 'email', 'plan', 'status', 'credits_balance', 'trial_ends_at'];
      const sanitized = {};

      Object.keys(updates).forEach(key => {
        const dbKey = key === 'creditsBalance' ? 'credits_balance' : key === 'trialEndsAt' ? 'trial_ends_at' : key;
        if (allowedFields.includes(dbKey)) {
          sanitized[dbKey] = updates[key];
        }
      });

      if (Object.keys(sanitized).length === 0) {
        throw new Error('Nenhum campo válido para atualizar');
      }

      const { data: updated, error } = await this.supabase
        .from('tenants')
        .update({
          ...sanitized,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId)
        .select('*')
        .single();

      if (error) throw error;

      // Registrar em audit_logs
      await this._auditLog(tenantId, updatedBy, 'tenant_updated', 'tenant', tenantId,
        JSON.stringify(Object.keys(sanitized)), JSON.stringify(sanitized));

      return {
        success: true,
        message: 'Tenant atualizado com sucesso',
        tenant: updated
      };
    } catch (error) {
      console.error('[TenantConfig] updateTenantSettings error:', error.message);
      throw error;
    }
  }

  /**
   * Listar membros de um tenant
   */
  async getTenantMembers(tenantId, includeInactive = false) {
    try {
      if (!tenantId) throw new Error('tenantId é obrigatório');

      let query = this.supabase
        .from('user_tenant_roles')
        .select(`
          id,
          user_id,
          role,
          created_at,
          updated_at,
          deleted_at,
          deleted_by
        `)
        .eq('tenant_id', tenantId);

      if (!includeInactive) {
        // Se há coluna status, filtrar por active
        // Caso contrário, filtrar por deleted_at IS NULL
        query = query.is('deleted_at', null);
      }

      const { data: members, error } = await query;

      if (error) throw error;

      return members.map(m => ({
        userId: m.user_id,
        role: m.role,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        deletedAt: m.deleted_at,
        deletedBy: m.deleted_by
      }));
    } catch (error) {
      console.error('[TenantConfig] getTenantMembers error:', error.message);
      throw error;
    }
  }

  /**
   * Mudar role de um membro
   */
  async updateMemberRole(tenantId, userId, newRole, updatedBy) {
    try {
      if (!tenantId || !userId || !newRole || !updatedBy) {
        throw new Error('tenantId, userId, newRole e updatedBy são obrigatórios');
      }

      if (!['owner', 'admin', 'member'].includes(newRole)) {
        throw new Error(`Role inválido: ${newRole}`);
      }

      // Verificar permissão: apenas owners podem mudar roles
      const { data: updaterRole } = await this.supabase
        .from('user_tenant_roles')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('user_id', updatedBy)
        .single();

      if (!updaterRole || updaterRole.role !== 'owner') {
        throw new Error('Apenas owners podem mudar roles');
      }

      // Buscar role atual
      const { data: currentRole } = await this.supabase
        .from('user_tenant_roles')
        .select('id, role')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .single();

      if (!currentRole) {
        throw new Error('Membro não encontrado');
      }

      const oldRole = currentRole.role;

      // Se downgrading admin, verificar que há outro admin/owner
      if (oldRole === 'admin' && newRole !== 'admin') {
        const { count } = await this.supabase
          .from('user_tenant_roles')
          .select('*', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .in('role', ['admin', 'owner'])
          .is('deleted_at', null);

        if (count <= 1) {
          throw new Error('Não é possível remover último admin/owner');
        }
      }

      // Atualizar role
      const { error: updateError } = await this.supabase
        .from('user_tenant_roles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentRole.id);

      if (updateError) throw updateError;

      // Registrar em audit
      await this._auditLog(tenantId, updatedBy, 'member_role_updated', 'user_role', userId,
        JSON.stringify({ oldRole }), JSON.stringify({ newRole }));

      return {
        success: true,
        message: `Role alterado de ${oldRole} para ${newRole}`,
        oldRole,
        newRole
      };
    } catch (error) {
      console.error('[TenantConfig] updateMemberRole error:', error.message);
      throw error;
    }
  }

  /**
   * Obter info de billing de um tenant
   */
  async getTenantBilling(tenantId) {
    try {
      if (!tenantId) throw new Error('tenantId é obrigatório');

      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('id, plan, credits_balance, monthly_credits, trial_ends_at, created_at')
        .eq('id', tenantId)
        .single();

      if (!tenant) throw new Error('Tenant não encontrado');

      return {
        plan: tenant.plan,
        creditsBalance: tenant.credits_balance,
        monthlyCredits: tenant.monthly_credits,
        trialEndsAt: tenant.trial_ends_at,
        createdAt: tenant.created_at,
        isExpired: tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()
      };
    } catch (error) {
      console.error('[TenantConfig] getTenantBilling error:', error.message);
      throw error;
    }
  }

  /**
   * Obter logs de auditoria do tenant
   */
  async getTenantAudit(tenantId, limit = 50) {
    try {
      if (!tenantId) throw new Error('tenantId é obrigatório');

      const { data: logs, error } = await this.supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return logs.map(log => ({
        id: log.id,
        action: log.action,
        resourceType: log.resource_type,
        resourceId: log.resource_id,
        oldValue: log.old_value,
        newValue: log.new_value,
        metadata: log.metadata,
        createdAt: log.created_at
      }));
    } catch (error) {
      console.error('[TenantConfig] getTenantAudit error:', error.message);
      throw error;
    }
  }

  /**
   * Helper: registrar em audit_logs
   */
  async _auditLog(tenantId, userId, action, resourceType, resourceId, oldValue, newValue) {
    try {
      await this.supabase
        .from('audit_logs')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          old_value: oldValue ? JSON.parse(oldValue) : null,
          new_value: newValue ? JSON.parse(newValue) : null
        });
    } catch (error) {
      console.warn('[TenantConfig] _auditLog error (non-fatal):', error.message);
    }
  }
}

export default TenantConfigService;
