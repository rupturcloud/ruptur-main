import { supabase } from '../auth/index.js';

const INVITE_EXPIRY_DAYS = 7;
const INVITE_RATE_LIMIT = 10; // máximo de invites por hora
const ACTION_TOKEN_EXPIRY_HOURS = 24;

/**
 * UserManagementService - Gerenciar usuários, convites e roles em tenants
 */
class UserManagementService {
  /**
   * Convida um usuário para um tenant
   * - Valida rate limiting (max 10/hora)
   * - Verifica se email já foi convidado
   * - Cria token único para aceitar convite
   * - Registra em audit_logs
   */
  static async inviteUser(tenantId, email, invitedRole = 'member', invitedBy) {
    try {
      if (!tenantId || !email || !invitedBy) {
        throw new Error('Missing required fields: tenantId, email, invitedBy');
      }

      if (!['owner', 'admin', 'member'].includes(invitedRole)) {
        throw new Error(`Invalid role: ${invitedRole}`);
      }

      // Verificar permissão do usuário que está convidando
      const inviterRole = await this._getUserRole(tenantId, invitedBy);
      if (!['owner', 'admin'].includes(inviterRole)) {
        throw new Error('Only admins and owners can invite users');
      }

      // Rate limiting: máximo 10 convites por hora
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentInvites } = await supabase
        .from('user_tenant_invites')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('invited_by', invitedBy)
        .eq('status', 'pending')
        .gte('created_at', oneHourAgo);

      if (recentInvites >= INVITE_RATE_LIMIT) {
        throw new Error(`Rate limit exceeded: max ${INVITE_RATE_LIMIT} invites per hour`);
      }

      // Verificar se já existe convite pendente para este email
      const { data: existingInvite } = await supabase
        .from('user_tenant_invites')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', email.toLowerCase())
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        throw new Error('Pending invite already exists for this email');
      }

      // Verificar se usuário já é membro do tenant
      const { data: existingMember } = await supabase
        .from('user_tenant_roles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', (await supabase.auth.admin.getUserById(email))?.data?.user?.id)
        .single();

      if (existingMember) {
        throw new Error('User is already a member of this tenant');
      }

      // Gerar token único para aceitar convite
      const token = this._generateToken();
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const { data: invite, error: createError } = await supabase
        .from('user_tenant_invites')
        .insert({
          tenant_id: tenantId,
          email: email.toLowerCase(),
          invited_role: invitedRole,
          token,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
          invited_by: invitedBy
        })
        .select('*')
        .single();

      if (createError) throw createError;

      // Registrar em audit_logs (trigger vai fazer isso, mas documentar)
      // Trigger: audit_invite_created
      return {
        id: invite.id,
        email: invite.email,
        invitedRole: invite.invited_role,
        token: invite.token,
        expiresAt: invite.expires_at,
        status: 'pending'
      };
    } catch (error) {
      console.error('[UserManagement] inviteUser error:', error.message);
      throw error;
    }
  }

  /**
   * Aceita um convite de usuário
   * - Valida se convite não expirou
   * - Verifica se email bate
   * - Cria entry em user_tenant_roles
   * - Marca convite como accepted
   */
  static async acceptInvite(token, userId, userEmail) {
    try {
      if (!token || !userId || !userEmail) {
        throw new Error('Missing required fields: token, userId, userEmail');
      }

      // Buscar convite pendente
      const { data: invite, error: inviteError } = await supabase
        .from('user_tenant_invites')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        throw new Error('Invalid or expired invite');
      }

      // Validar se não expirou
      if (new Date(invite.expires_at) < new Date()) {
        throw new Error('Invite has expired');
      }

      // Validar email bate
      if (invite.email !== userEmail.toLowerCase()) {
        throw new Error('Email does not match the invite');
      }

      // Criar role para usuário neste tenant
      const { error: roleError } = await supabase
        .from('user_tenant_roles')
        .insert({
          user_id: userId,
          tenant_id: invite.tenant_id,
          role: invite.invited_role,
          status: 'active',
          created_at: new Date().toISOString()
        });

      if (roleError) {
        // Se duplicado, talvez usuário já aceitou esse convite
        if (roleError.code === '23505') {
          throw new Error('User is already a member of this tenant');
        }
        throw roleError;
      }

      // Marcar convite como accepted
      const { error: updateError } = await supabase
        .from('user_tenant_invites')
        .update({
          status: 'accepted',
          accepted_by_user_id: userId,
          accepted_at: new Date().toISOString()
        })
        .eq('id', invite.id);

      if (updateError) throw updateError;

      // Trigger: audit_invite_accepted vai registrar automaticamente
      return {
        tenantId: invite.tenant_id,
        role: invite.invited_role,
        acceptedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[UserManagement] acceptInvite error:', error.message);
      throw error;
    }
  }

  /**
   * Remove um usuário de um tenant (soft-delete)
   * - Valida se não é último admin
   * - Marca status como inactive e seta deleted_at
   * - Registra quem removeu (deleted_by)
   */
  static async removeUserFromTenant(targetUserId, tenantId, removedBy) {
    try {
      if (!targetUserId || !tenantId || !removedBy) {
        throw new Error('Missing required fields');
      }

      // Validar permissão de quem está removendo
      const removerRole = await this._getUserRole(tenantId, removedBy);
      if (!['owner', 'admin'].includes(removerRole)) {
        throw new Error('Only admins and owners can remove users');
      }

      // Buscar user role atual
      const { data: userRole, error: roleError } = await supabase
        .from('user_tenant_roles')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('tenant_id', tenantId)
        .single();

      if (roleError || !userRole) {
        throw new Error('User is not a member of this tenant');
      }

      // Se é admin, verificar que há pelo menos outro admin ativo
      if (userRole.role === 'admin') {
        const { count: adminCount } = await supabase
          .from('user_tenant_roles')
          .select('*', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('role', 'admin')
          .eq('status', 'active');

        if (adminCount <= 1) {
          throw new Error('Cannot remove last admin. Assign another admin first.');
        }
      }

      // Soft-delete: marcar como inativo
      const { error: updateError } = await supabase
        .from('user_tenant_roles')
        .update({
          status: 'inactive',
          deleted_at: new Date().toISOString(),
          deleted_by: removedBy
        })
        .eq('id', userRole.id);

      if (updateError) throw updateError;

      // Trigger: audit_user_removal vai registrar automaticamente
      return {
        userId: targetUserId,
        tenantId,
        status: 'inactive',
        removedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[UserManagement] removeUserFromTenant error:', error.message);
      throw error;
    }
  }

  /**
   * Muda role de um usuário
   * - Apenas owners podem mudar roles
   * - Valida que novo role é válido
   * - Registra mudança em audit_logs via trigger
   */
  static async changeUserRole(targetUserId, tenantId, newRole, changedBy) {
    try {
      if (!targetUserId || !tenantId || !newRole || !changedBy) {
        throw new Error('Missing required fields');
      }

      if (!['owner', 'admin', 'member'].includes(newRole)) {
        throw new Error(`Invalid role: ${newRole}`);
      }

      // Apenas owners podem mudar roles
      const changerRole = await this._getUserRole(tenantId, changedBy);
      if (changerRole !== 'owner') {
        throw new Error('Only owners can change user roles');
      }

      // Buscar user role atual
      const { data: userRole, error: roleError } = await supabase
        .from('user_tenant_roles')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('tenant_id', tenantId)
        .single();

      if (roleError || !userRole) {
        throw new Error('User is not a member of this tenant');
      }

      const oldRole = userRole.role;

      // Se downgrading admin para outro role, verificar que há outro admin
      if (oldRole === 'admin' && newRole !== 'admin') {
        const { count: adminCount } = await supabase
          .from('user_tenant_roles')
          .select('*', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .eq('role', 'admin')
          .eq('status', 'active');

        if (adminCount <= 1) {
          throw new Error('Cannot remove last admin. Assign another admin first.');
        }
      }

      // Atualizar role
      const { error: updateError } = await supabase
        .from('user_tenant_roles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', userRole.id);

      if (updateError) throw updateError;

      // Trigger: audit_role_change vai registrar automaticamente
      return {
        userId: targetUserId,
        tenantId,
        oldRole,
        newRole,
        changedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[UserManagement] changeUserRole error:', error.message);
      throw error;
    }
  }

  /**
   * Lista usuários de um tenant
   * - Por padrão mostra apenas ativos
   * - includeInactive=true mostra desativados também
   */
  static async listTenantUsers(tenantId, includeInactive = false) {
    try {
      if (!tenantId) {
        throw new Error('tenantId is required');
      }

      let query = supabase
        .from('user_tenant_roles')
        .select(`
          id,
          user_id,
          role,
          status,
          created_at,
          updated_at,
          deleted_at,
          deleted_by
        `)
        .eq('tenant_id', tenantId);

      if (!includeInactive) {
        query = query.eq('status', 'active');
      }

      const { data: users, error } = await query;

      if (error) throw error;

      return users.map(user => ({
        userId: user.user_id,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        deletedAt: user.deleted_at,
        deletedBy: user.deleted_by
      }));
    } catch (error) {
      console.error('[UserManagement] listTenantUsers error:', error.message);
      throw error;
    }
  }

  /**
   * Retorna estatísticas de usuários do tenant
   */
  static async getTenantUserStats(tenantId) {
    try {
      if (!tenantId) {
        throw new Error('tenantId is required');
      }

      const { data: users, error } = await supabase
        .from('user_tenant_roles')
        .select('role, status')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      const stats = {
        totalMembers: 0,
        activeMembers: 0,
        inactiveMembers: 0,
        owners: 0,
        admins: 0,
        members: 0
      };

      users.forEach(user => {
        stats.totalMembers++;
        if (user.status === 'active') stats.activeMembers++;
        if (user.status === 'inactive') stats.inactiveMembers++;
        if (user.role === 'owner') stats.owners++;
        if (user.role === 'admin') stats.admins++;
        if (user.role === 'member') stats.members++;
      });

      return stats;
    } catch (error) {
      console.error('[UserManagement] getTenantUserStats error:', error.message);
      throw error;
    }
  }

  /**
   * Cria um action token para operações sensíveis (remove user, change role, etc)
   * - Token válido por 24h
   * - Requer confirmação explícita (double confirmation)
   */
  static async createActionToken(tenantId, userId, targetUserId, action, actionData, createdBy) {
    try {
      if (!['remove_user', 'change_role', 'suspend_user', 'restore_user'].includes(action)) {
        throw new Error(`Invalid action: ${action}`);
      }

      const token = this._generateToken();
      const expiresAt = new Date(Date.now() + ACTION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      const { data: actionToken, error } = await supabase
        .from('action_tokens')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          target_user_id: targetUserId,
          action,
          action_data: actionData || {},
          token,
          expires_at: expiresAt.toISOString(),
          status: 'pending'
        })
        .select('*')
        .single();

      if (error) throw error;

      return {
        id: actionToken.id,
        token: actionToken.token,
        action,
        expiresAt: actionToken.expires_at
      };
    } catch (error) {
      console.error('[UserManagement] createActionToken error:', error.message);
      throw error;
    }
  }

  /**
   * Confirma um action token
   * - Valida se token é válido e não expirou
   * - Marca como confirmed e seta confirmed_at
   */
  static async confirmActionToken(token, confirmedBy) {
    try {
      if (!token || !confirmedBy) {
        throw new Error('Missing required fields');
      }

      // Buscar action token
      const { data: actionToken, error: tokenError } = await supabase
        .from('action_tokens')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (tokenError || !actionToken) {
        throw new Error('Invalid or expired action token');
      }

      // Validar se não expirou
      if (new Date(actionToken.expires_at) < new Date()) {
        throw new Error('Action token has expired');
      }

      // Confirmar token
      const { error: updateError } = await supabase
        .from('action_tokens')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: confirmedBy
        })
        .eq('id', actionToken.id);

      if (updateError) throw updateError;

      return {
        id: actionToken.id,
        action: actionToken.action,
        targetUserId: actionToken.target_user_id,
        actionData: actionToken.action_data,
        confirmedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[UserManagement] confirmActionToken error:', error.message);
      throw error;
    }
  }

  /**
   * Helper: Obter role de um usuário em um tenant
   */
  static async _getUserRole(tenantId, userId) {
    const { data: userRole } = await supabase
      .from('user_tenant_roles')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return userRole?.role || null;
  }

  /**
   * Helper: Gerar token único (64 caracteres)
   */
  static _generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
}

export { UserManagementService };
