/**
 * NotificationService — Orquestração de Notificações
 * Integra Pub/Sub + Supabase + SendGrid
 */

import sgMail from '@sendgrid/mail';
import { renderTemplate } from './templates.js';

export class NotificationService {
  constructor(supabase, logger = console) {
    this.supabase = supabase;
    this.logger = logger;

    // Setup SendGrid se API key existir
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  /**
   * Processar evento de notificação (chamado por Cloud Function)
   * @param {Object} event - Evento do Pub/Sub
   */
  async processEvent(event) {
    try {
      const { eventId, type, payload } = event;

      this.logger.log(`[Notification] Processing ${type}:${eventId}`);

      // 1. Validar payload básico
      if (!payload.tenantId || !payload.userId || !payload.email) {
        throw new Error('Missing required fields: tenantId, userId, email');
      }

      // 2. Checar preferências do usuário
      const prefs = await this.getPreferences(
        payload.tenantId,
        payload.userId,
        type
      );

      if (!prefs?.email?.enabled) {
        this.logger.log(`[Notification] Email disabled for ${payload.userId}`);
        return { status: 'skipped', reason: 'email_disabled' };
      }

      // 3. Deduplicar (evitar spam do mesmo evento)
      const isDupe = await this.isDuplicate(eventId);
      if (isDupe) {
        this.logger.log(`[Notification] Duplicate event: ${eventId}`);
        return { status: 'skipped', reason: 'duplicate' };
      }

      // 4. Renderizar template
      const { subject, html } = renderTemplate(type, {
        ...payload,
        userName: payload.userName || 'Usuário',
      });

      // 5. Enviar email
      await this.sendEmail({
        to: payload.email,
        subject,
        html,
        eventId,
      });

      // 6. Logar sucesso
      await this.logNotification({
        tenant_id: payload.tenantId,
        user_id: payload.userId,
        event_id: eventId,
        event_type: type,
        channel: 'email',
        payload,
        status: 'sent',
      });

      return { status: 'sent', eventId };
    } catch (err) {
      this.logger.error('[Notification] Error processing event:', err);

      // Logar falha
      try {
        await this.logNotification({
          tenant_id: event.payload?.tenantId,
          user_id: event.payload?.userId,
          event_id: event.eventId,
          event_type: event.type,
          channel: 'email',
          payload: event.payload,
          status: 'failed',
          error_message: err.message,
        });
      } catch (logErr) {
        this.logger.error('[Notification] Failed to log error:', logErr);
      }

      throw err;
    }
  }

  /**
   * Obter preferências de notificação do usuário
   */
  async getPreferences(tenantId, userId, eventType) {
    try {
      const { data, error } = await this.supabase
        .from('notification_preferences')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('event_type', eventType)
        .maybeSingle();

      if (error) {
        this.logger.error('[Notification] Error fetching preferences:', error);
        // Fallback: ativar por padrão
        return { email: { enabled: true }, sms: { enabled: false } };
      }

      // Se não existe preferência, criar padrão (email on, sms off)
      if (!data) {
        await this.createDefaultPreferences(tenantId, userId, eventType);
        return { email: { enabled: true }, sms: { enabled: false } };
      }

      return {
        email: { enabled: data.email_enabled ?? true },
        sms: { enabled: data.sms_enabled ?? false },
        digest: { enabled: data.digest_enabled ?? false },
      };
    } catch (err) {
      this.logger.error('[Notification] Preferences fetch error:', err);
      return { email: { enabled: true }, sms: { enabled: false } };
    }
  }

  /**
   * Criar preferências padrão se não existirem
   */
  async createDefaultPreferences(tenantId, userId, eventType) {
    try {
      await this.supabase
        .from('notification_preferences')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          event_type: eventType,
          email_enabled: true,
          sms_enabled: false,
          digest_enabled: false,
        })
        .select()
        .maybeSingle();
    } catch (err) {
      // Pode falhar se já existe (race condition), okay
      this.logger.debug('[Notification] Default preferences already exist');
    }
  }

  /**
   * Verificar se é duplicata (mesmo eventId nos últimos 60 minutos)
   */
  async isDuplicate(eventId) {
    try {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

      const { data, error } = await this.supabase
        .from('notification_logs')
        .select('id')
        .eq('event_id', eventId)
        .gt('created_at', oneHourAgo)
        .limit(1);

      if (error) {
        this.logger.error('[Notification] Duplicate check error:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (err) {
      this.logger.error('[Notification] Duplicate check failed:', err);
      return false;
    }
  }

  /**
   * Enviar email via SendGrid
   */
  async sendEmail({ to, subject, html, eventId }) {
    if (!process.env.SENDGRID_API_KEY) {
      this.logger.warn('[Notification] SendGrid API key not configured, skipping email');
      return { status: 'skipped', reason: 'no_sendgrid_key' };
    }

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'alerts@ruptur.cloud',
      subject,
      html,
      replyTo: process.env.SENDGRID_REPLY_TO || 'support@ruptur.cloud',
      headers: {
        'X-Event-ID': eventId,
        'X-Service': 'Ruptur-Notifications',
      },
    };

    try {
      const result = await sgMail.send(msg);
      this.logger.log(`[Notification] Email sent to ${to}`, {
        messageId: result[0]?.headers?.['x-message-id'],
        eventId,
      });
      return result[0];
    } catch (err) {
      this.logger.error('[Notification] SendGrid error:', {
        error: err.message,
        to,
        eventId,
      });
      throw err;
    }
  }

  /**
   * Logar notificação (para auditoria e tracking)
   */
  async logNotification({
    tenant_id,
    user_id,
    event_id,
    event_type,
    channel,
    payload,
    status,
    error_message,
  }) {
    try {
      const { error } = await this.supabase
        .from('notification_logs')
        .insert({
          tenant_id,
          user_id,
          event_id,
          event_type,
          channel,
          payload,
          status,
          error_message,
          sent_at: new Date().toISOString(),
        });

      if (error) {
        this.logger.error('[Notification] Log insert error:', error);
      }
    } catch (err) {
      this.logger.error('[Notification] Failed to log notification:', err);
    }
  }

  /**
   * Testar envio (para debugging)
   */
  async testSend(email, eventType = 'campaign_launched') {
    const testData = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      email,
      userName: 'Test User',
      campaignName: 'Test Campaign',
      count: 100,
      balance: 50,
      reason: 'Invalid card',
      instanceName: 'Test Instance',
    };

    return this.processEvent({
      eventId: `test-${Date.now()}`,
      type: eventType,
      payload: testData,
    });
  }
}

export default NotificationService;
