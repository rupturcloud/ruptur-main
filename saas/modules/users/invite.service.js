/**
 * InviteService
 * Gerencia convites de usuários: send, accept, expire, list pending
 * Validação de email dupla, rate limiting e auditoria automática
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import RateLimiter from './rate-limiter.service.js';

class InviteService {
  constructor(supabaseUrl, supabaseKey) {
    this.client = createClient(supabaseUrl, supabaseKey);
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Enviar convite para novo usuário
   */
  async sendInvite(tenantId, email, role = 'member', invitedBy, customMessage = '') {
    // Validar email
    if (!this._isValidEmail(email)) {
      throw new Error('Invalid email address');
    }

    // Rate limit: máx 20 convites por minuto por tenant
    const key = `send_invite:${tenantId}`;
    if (!this.rateLimiter.allow(key, 20, 60)) {
      throw new Error('Rate limit exceeded: máx 20 convites por minuto');
    }

    // Validar role
    if (!['owner', 'admin', 'member'].includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // Checar se já existe convite ativo para este email
    const { data: existing } = await this.client
      .from('user_tenant_invites')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existing) {
      throw new Error('Active invite already exists for this email');
    }

    // Checar se usuário já está no tenant
    const { data: existingUser } = await this.client
      .from('user_tenant_roles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', (
        await this._getUserIdByEmail(email)
      ))
      .eq('status', 'active')
      .single();

    if (existingUser) {
      throw new Error('User is already a member of this tenant');
    }

    // Gerar token único
    const token = crypto.randomBytes(32).toString('hex');

    const { data, error } = await this.client
      .from('user_tenant_invites')
      .insert({
        tenant_id: tenantId,
        email,
        invited_role: role,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
        status: 'pending',
        invited_by: invitedBy,
        metadata: { custom_message: customMessage },
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create invite: ${error.message}`);
    return data;
  }

  /**
   * Aceitar convite (usado pelo usuário que recebeu o convite)
   */
  async acceptInvite(token, acceptedByUserId) {
    // Rate limit: máx 5 aceitações por minuto por usuário
    const key = `accept_invite:${acceptedByUserId}`;
    if (!this.rateLimiter.allow(key, 5, 60)) {
      throw new Error('Rate limit exceeded');
    }

    // Buscar convite
    const { data: invite, error: fetchError } = await this.client
      .from('user_tenant_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (fetchError || !invite) {
      throw new Error('Invalid or expired invite');
    }

    // Validar que email do convite bate com email do usuário
    const { data: authUser } = await this.client.auth.admin.getUserById(acceptedByUserId);
    if (authUser?.user?.email !== invite.email) {
      throw new Error('Email mismatch: convite não é para este email');
    }

    // Aceitar convite
    const { data: updatedInvite, error: updateError } = await this.client
      .from('user_tenant_invites')
      .update({
        status: 'accepted',
        accepted_by_user_id: acceptedByUserId,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id)
      .select()
      .single();

    if (updateError) throw new Error(`Failed to accept invite: ${updateError.message}`);

    // Adicionar usuário ao tenant com a role convidada
    await this.client
      .from('user_tenant_roles')
      .insert({
        tenant_id: invite.tenant_id,
        user_id: acceptedByUserId,
        role: invite.invited_role,
        status: 'active',
      });

    return updatedInvite;
  }

  /**
   * Cancelar/rejeitar convite
   */
  async rejectInvite(inviteId, rejectedBy) {
    const { data, error } = await this.client
      .from('user_tenant_invites')
      .update({
        status: 'rejected',
      })
      .eq('id', inviteId)
      .select()
      .single();

    if (error) throw new Error(`Failed to reject invite: ${error.message}`);
    return data;
  }

  /**
   * Listar convites pendentes de um tenant
   */
  async listPendingInvites(tenantId) {
    const { data, error } = await this.client
      .from('user_tenant_invites')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list invites: ${error.message}`);

    // Filtrar convites expirados (opcional, triggers já fazem isso)
    return data.filter(invite => new Date(invite.expires_at) > new Date());
  }

  /**
   * Listar convites de um usuário (os que foram enviados para ele)
   */
  async listUserInvites(email) {
    const { data, error } = await this.client
      .from('user_tenant_invites')
      .select('*')
      .eq('email', email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list user invites: ${error.message}`);
    return data.filter(invite => new Date(invite.expires_at) > new Date());
  }

  /**
   * Cancelar convite (por admin)
   */
  async cancelInvite(inviteId, cancelledBy) {
    const { data, error } = await this.client
      .from('user_tenant_invites')
      .update({
        status: 'cancelled',
      })
      .eq('id', inviteId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel invite: ${error.message}`);
    return data;
  }

  // ===== HELPERS PRIVADOS =====

  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async _getUserIdByEmail(email) {
    const { data: authUser } = await this.client.auth.admin.listUsers();
    const user = authUser?.users?.find(u => u.email === email);
    return user?.id || null;
  }
}

export default InviteService;
