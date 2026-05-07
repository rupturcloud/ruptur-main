/**
 * UserManagementService
 * Gerencia usuários de tenants: add, remove, change role, suspend
 * Rate limiting, auditoria e validações incluídas
 */

import { createClient } from '@supabase/supabase-js';
import RateLimiter from './rate-limiter.service.js';

class UserManagementService {
  constructor(supabaseUrl, supabaseKey) {
    this.client = createClient(supabaseUrl, supabaseKey);
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Adicionar usuário ao tenant via convite aceito
   */
  async addUserToTenant(tenantId, userId, role = 'member', metadata = {}) {
    // Validar rate limit (máx 10 usuários por minuto por tenant)
    const key = `add_user:${tenantId}`;
    if (!this.rateLimiter.allow(key, 10, 60)) {
      throw new Error('Rate limit exceeded: máx 10 usuários por minuto');
    }

    // Validar que há pelo menos 1 admin ativo
    if (role !== 'member') {
      const adminCount = await this._countActiveAdmins(tenantId);
      if (adminCount === 0 && role !== 'owner') {
        throw new Error('Tenant must have at least one admin');
      }
    }

    const { data, error } = await this.client
      .from('user_tenant_roles')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        role,
        status: 'active',
        metadata,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add user: ${error.message}`);
    return data;
  }

  /**
   * Remover usuário do tenant (soft delete)
   */
  async removeUserFromTenant(tenantId, userId, deletedBy, reason = '') {
    // Rate limit: máx 5 remoções por minuto
    const key = `remove_user:${tenantId}`;
    if (!this.rateLimiter.allow(key, 5, 60)) {
      throw new Error('Rate limit exceeded: máx 5 remoções por minuto');
    }

    // Validar que não é o último admin
    const userRole = await this._getUserRole(tenantId, userId);
    if (userRole === 'owner' || userRole === 'admin') {
      const adminCount = await this._countActiveAdmins(tenantId);
      if (adminCount === 1) {
        throw new Error('Cannot remove last admin from tenant');
      }
    }

    const { data, error } = await this.client
      .from('user_tenant_roles')
      .update({
        status: 'inactive',
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        metadata: { reason },
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to remove user: ${error.message}`);
    return data;
  }

  /**
   * Mudar role de usuário
   */
  async changeUserRole(tenantId, userId, newRole, changedBy) {
    // Rate limit: máx 20 mudanças de role por minuto
    const key = `change_role:${tenantId}`;
    if (!this.rateLimiter.allow(key, 20, 60)) {
      throw new Error('Rate limit exceeded');
    }

    // Validar que novo role é válido
    const validRoles = ['owner', 'admin', 'member'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }

    // Se removendo role admin/owner, validar que há outro admin
    if (newRole === 'member') {
      const adminCount = await this._countActiveAdmins(tenantId);
      if (adminCount === 1) {
        const userRole = await this._getUserRole(tenantId, userId);
        if (userRole === 'owner' || userRole === 'admin') {
          throw new Error('Cannot remove last admin from tenant');
        }
      }
    }

    const { data, error } = await this.client
      .from('user_tenant_roles')
      .update({
        role: newRole,
        token_invalidated_at: new Date().toISOString(), // Força re-login
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .select()
      .single();

    if (error) throw new Error(`Failed to change role: ${error.message}`);
    return data;
  }

  /**
   * Suspender usuário (mantém acesso a histórico, mas não pode fazer ações)
   */
  async suspendUser(tenantId, userId, reason = '') {
    const { data, error } = await this.client
      .from('user_tenant_roles')
      .update({
        status: 'suspended',
        metadata: { suspended_reason: reason },
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to suspend user: ${error.message}`);
    return data;
  }

  /**
   * Reativar usuário suspenso
   */
  async reactivateUser(tenantId, userId) {
    const { data, error } = await this.client
      .from('user_tenant_roles')
      .update({
        status: 'active',
        metadata: {},
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to reactivate user: ${error.message}`);
    return data;
  }

  /**
   * Listar usuários de um tenant
   */
  async listTenantUsers(tenantId, options = {}) {
    const { includeInactive = false, role = null } = options;

    let query = this.client
      .from('user_tenant_roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('status', 'active');
    }

    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    return data;
  }

  // ===== HELPERS PRIVADOS =====

  async _countActiveAdmins(tenantId) {
    const { data, error } = await this.client
      .from('user_tenant_roles')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin']);

    if (error) return 0;
    return data?.length || 0;
  }

  async _getUserRole(tenantId, userId) {
    const { data, error } = await this.client
      .from('user_tenant_roles')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data?.role;
  }
}

export default UserManagementService;
