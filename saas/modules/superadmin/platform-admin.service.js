/**
 * PlatformAdminService — Gerenciamento de Superadmins
 *
 * Responsabilidades:
 * - Adicionar/remover superadmins
 * - Gerenciar convites de superadmin
 * - Verificar se usuário é superadmin
 * - Enviar emails de convite
 *
 * Uso:
 * ```js
 * const service = new PlatformAdminService(supabase, emailService);
 * await service.invitePlatformAdmin('new@example.com', invitedByUserId);
 * ```
 */

import crypto from 'crypto';

export class PlatformAdminService {
  constructor(supabase, emailService) {
    this.db = supabase;
    this.email = emailService;
  }

  /**
   * Verificar se usuário é superadmin
   * @returns {Promise<boolean>}
   */
  async isPlatformAdmin(userId) {
    try {
      const { data, error } = await this.db
        .from('platform_admins')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      return !error && !!data;
    } catch (error) {
      console.error('Error checking platform admin status:', error);
      return false;
    }
  }

  /**
   * Obter todos os superadmins
   * @returns {Promise<Array>}
   */
  async listPlatformAdmins() {
    try {
      const { data, error } = await this.db
        .from('platform_admins')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error listing platform admins:', error);
      return [];
    }
  }

  /**
   * Adicionar superadmin direto (sem convite)
   * Requer que quem está criando seja um superadmin
   * @returns {Promise<Object>}
   */
  async addPlatformAdminDirect(email, userId, createdByUserId) {
    try {
      // Validar que quem está criando é superadmin
      const isAdmin = await this.isPlatformAdmin(createdByUserId);
      if (!isAdmin) {
        throw new Error('Only platform admins can add other admins');
      }

      // Verificar se email já existe
      const { data: existing } = await this.db
        .from('platform_admins')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        throw new Error(`Email ${email} already is a platform admin`);
      }

      // Inserir novo superadmin
      const { data, error } = await this.db
        .from('platform_admins')
        .insert({
          user_id: userId,
          email,
          status: 'active',
          created_by: createdByUserId,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Platform admin added: ${email}`);
      return data;
    } catch (error) {
      console.error('Error adding platform admin:', error);
      throw error;
    }
  }

  /**
   * Convidar email para se tornar superadmin
   * Cria invite com token de aceitação
   * @returns {Promise<{invite, token}>}
   */
  async invitePlatformAdmin(email, invitedByUserId) {
    try {
      // Validar que quem está convidando é superadmin
      const isAdmin = await this.isPlatformAdmin(invitedByUserId);
      if (!isAdmin) {
        throw new Error('Only platform admins can send invites');
      }

      // Verificar se email já é superadmin
      const { data: existing } = await this.db
        .from('platform_admins')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        throw new Error(`Email ${email} already is a platform admin`);
      }

      // Gerar token único
      const token = crypto
        .randomBytes(32)
        .toString('hex');

      // Inserir convite
      const { data, error } = await this.db
        .from('platform_admin_invites')
        .insert({
          email,
          token,
          invited_by: invitedByUserId,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
        })
        .select()
        .single();

      if (error) throw error;

      // Enviar email com link de convite quando houver serviço de email configurado.
      // Em produção inicial, o gateway pode rodar sem emailService; nesse caso,
      // retornamos o token/link para o superadmin copiar manualmente.
      const inviteUrl = `${process.env.APP_URL || 'https://app.ruptur.cloud'}/admin/accept-invite?token=${token}`;

      let emailSent = false;
      if (this.email?.send) {
        await this.email.send({
          to: email,
          subject: 'Você foi convidado para ser Superadmin da Ruptur',
          template: 'platform-admin-invite',
          data: {
            email,
            inviteUrl,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
          },
        });
        emailSent = true;
      } else {
        console.warn(`⚠️ Email service not configured. Manual invite link for ${email}: ${inviteUrl}`);
      }

      console.log(`${emailSent ? '📧 Platform admin invite sent to' : '🔗 Platform admin invite created for'}: ${email}`);
      return { invite: data, token, inviteUrl, emailSent };
    } catch (error) {
      console.error('Error inviting platform admin:', error);
      throw error;
    }
  }

  /**
   * Aceitar convite de superadmin
   * @returns {Promise<Object>}
   */
  async acceptInvite(token, userId, email) {
    try {
      // Buscar convite
      const { data: invite, error: inviteError } = await this.db
        .from('platform_admin_invites')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        throw new Error('Convite inválido ou expirado');
      }

      // Validar expiração
      if (new Date(invite.expires_at) < new Date()) {
        throw new Error('Convite expirado');
      }

      // Validar email
      if (invite.email !== email) {
        throw new Error('Email não corresponde ao convite');
      }

      // Marcar convite como aceito
      await this.db
        .from('platform_admin_invites')
        .update({
          status: 'accepted',
          accepted_by_user_id: userId,
          accepted_at: new Date().toISOString(),
        })
        .eq('token', token);

      // Criar superadmin
      const { data: admin, error: adminError } = await this.db
        .from('platform_admins')
        .insert({
          user_id: userId,
          email,
          status: 'active',
          created_by: invite.invited_by,
        })
        .select()
        .single();

      if (adminError) throw adminError;

      console.log(`✅ Platform admin created from invite: ${email}`);
      return admin;
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  }

  /**
   * Remover superadmin (soft delete)
   */
  async removePlatformAdmin(adminId, removedByUserId) {
    try {
      // Validar que quem está removendo é superadmin
      const isAdmin = await this.isPlatformAdmin(removedByUserId);
      if (!isAdmin) {
        throw new Error('Only platform admins can remove other admins');
      }

      // Soft delete
      const { data, error } = await this.db
        .from('platform_admins')
        .update({ status: 'inactive' })
        .eq('id', adminId)
        .select()
        .single();

      if (error) throw error;

      console.log(`🗑️ Platform admin deactivated: ${data.email}`);
      return data;
    } catch (error) {
      console.error('Error removing platform admin:', error);
      throw error;
    }
  }

  /**
   * Listar convites pendentes
   */
  async listPendingInvites() {
    try {
      const { data, error } = await this.db
        .from('platform_admin_invites')
        .select('*')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error listing pending invites:', error);
      return [];
    }
  }
}

export default PlatformAdminService;
