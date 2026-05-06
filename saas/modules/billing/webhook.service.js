/**
 * WebhookService — Processamento Idempotente de Webhooks
 * Com Rastreamento de Eventos e Refund Handling
 *
 * Funcionalidades:
 * - Idempotência via external_event_id
 * - Rastreamento de status (pending → processing → success/failed)
 * - Refund handling com lock otimista
 * - Auditoria de webhooks
 */

import { EventPublisher } from '../notifications/event-publisher.js';

export class WebhookService {
  constructor(supabase, auditService) {
    this.supabase = supabase;
    this.audit = auditService;
    this.eventPublisher = new EventPublisher();
  }

  /**
   * Registrar e processar webhook de forma idempotente
   * - Se já foi processado, retorna resultado anterior
   * - Senão, marca como pendente e processa
   */
  async processWebhookIdempotent(tenantId, externalEventId, eventType, payload) {
    // 1. Procurar evento existente
    const { data: existingEvent, error: searchError } = await this.supabase
      .from('webhook_events')
      .select('id, status, processed_at')
      .eq('tenant_id', tenantId)
      .eq('external_event_id', externalEventId)
      .maybeSingle();

    if (searchError) {
      throw new Error(`Erro ao procurar webhook existente: ${searchError.message}`);
    }

    // 2. Se já foi processado com sucesso, retorna
    if (existingEvent && existingEvent.status === 'success') {
      return {
        id: existingEvent.id,
        status: 'success',
        isNew: false,
        processedAt: existingEvent.processed_at
      };
    }

    // 3. Se está em processamento, espera ou retorna pendente
    if (existingEvent && existingEvent.status === 'processing') {
      return {
        id: existingEvent.id,
        status: 'processing',
        isNew: false,
        processedAt: null
      };
    }

    // 4. Criar novo evento ou atualizar o existente
    if (existingEvent) {
      // Atualizar evento existente (falhou antes)
      const { data: updated, error: updateError } = await this.supabase
        .from('webhook_events')
        .update({
          status: 'processing',
          payload,
          delivery_attempts: (existingEvent.delivery_attempts || 0) + 1,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', existingEvent.id)
        .select('id')
        .single();

      if (updateError) {
        throw new Error(`Erro ao atualizar webhook: ${updateError.message}`);
      }

      return {
        id: updated.id,
        status: 'processing',
        isNew: false
      };
    } else {
      // Criar novo evento
      const { data: newEvent, error: createError } = await this.supabase
        .from('webhook_events')
        .insert({
          tenant_id: tenantId,
          external_event_id: externalEventId,
          event_type: eventType,
          payload,
          status: 'processing',
          delivery_attempts: 1,
          last_attempt_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (createError) {
        throw new Error(`Erro ao criar webhook event: ${createError.message}`);
      }

      return {
        id: newEvent.id,
        status: 'processing',
        isNew: true
      };
    }
  }

  /**
   * Marcar webhook como processado com sucesso
   */
  async markWebhookSuccess(tenantId, externalEventId, webhookId) {
    const { error } = await this.supabase
      .from('webhook_events')
      .update({
        status: 'success',
        processed_at: new Date().toISOString()
      })
      .eq('id', webhookId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Erro ao marcar webhook como sucesso: ${error.message}`);
    }
  }

  /**
   * Marcar webhook como falha
   */
  async markWebhookFailed(tenantId, webhookId, errorMessage) {
    const { error } = await this.supabase
      .from('webhook_events')
      .update({
        status: 'failed',
        error_message: errorMessage
      })
      .eq('id', webhookId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw new Error(`Erro ao marcar webhook como falha: ${error.message}`);
    }
  }

  /**
   * Processar payment status update do webhook
   * Atualiza payment status e credita wallet se aprovado
   */
  async processPaymentStatusUpdate(tenantId, transactionId, newStatus, webhookId) {
    // 1. Buscar payment (com lock pessimista)
    const { data: payment, error: fetchError } = await this.supabase
      .from('payments')
      .select('id, status, amount_cents, getnet_payment_id')
      .eq('tenant_id', tenantId)
      .eq('getnet_payment_id', transactionId)
      .maybeSingle();

    if (fetchError || !payment) {
      throw new Error(`Payment não encontrado: ${transactionId}`);
    }

    // 2. Se já foi processado com mesmo status (idempotência)
    if (payment.status === newStatus) {
      await this.markWebhookSuccess(tenantId, transactionId, webhookId);
      return {
        success: true,
        reason: 'idempotent_skip',
        payment: {
          id: payment.id,
          status: payment.status
        }
      };
    }

    // 3. Atualizar status do payment
    const { error: updateError } = await this.supabase
      .from('payments')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw new Error(`Erro ao atualizar payment: ${updateError.message}`);
    }

    // 4. Se aprovado, creditar wallet
    if (newStatus === 'APPROVED') {
      const creditsToAdd = Math.floor(payment.amount_cents / 100);

      const { data: creditResult, error: creditError } = await this.supabase
        .rpc('add_wallet_credits', {
          p_tenant_id: tenantId,
          p_amount: creditsToAdd,
          p_reference: payment.getnet_payment_id,
          p_description: `Pagamento aprovado via webhook: ${payment.getnet_payment_id}`
        });

      if (creditError) {
        throw new Error(`Erro ao creditar wallet: ${creditError.message}`);
      }
    } else if (newStatus === 'DECLINED' || newStatus === 'FAILED') {
      // Publicar notificação de falha de pagamento
      await this._publishPaymentFailedNotification(tenantId, payment, newStatus);
    }

    // 5. Marcar webhook como processado
    await this.markWebhookSuccess(tenantId, transactionId, webhookId);

    return {
      success: true,
      reason: 'payment_updated',
      payment: {
        id: payment.id,
        status: newStatus
      }
    };
  }

  /**
   * Processar chargeback/refund do webhook
   * Reverte créditos da wallet
   */
  async processChargeback(tenantId, originalPaymentId, chargebackAmount, webhookId) {
    // 1. Criar registro de refund
    const { data: refund, error: refundError } = await this.supabase
      .from('refunds')
      .insert({
        tenant_id: tenantId,
        original_payment_id: originalPaymentId,
        amount_cents: chargebackAmount,
        reason: 'chargeback',
        status: 'processing'
      })
      .select('id')
      .single();

    if (refundError) {
      throw new Error(`Erro ao criar refund: ${refundError.message}`);
    }

    // 2. Processar refund (deduzir créditos)
    const { data: refundResult, error: processError } = await this.supabase
      .rpc('process_refund', {
        p_tenant_id: tenantId,
        p_payment_id: originalPaymentId,
        p_refund_amount_cents: chargebackAmount
      });

    if (processError) {
      // Atualizar refund como failed
      await this.supabase
        .from('refunds')
        .update({ status: 'failed' })
        .eq('id', refund.id);

      throw new Error(`Erro ao processar refund: ${processError.message}`);
    }

    // 3. Marcar refund como completo
    await this.supabase
      .from('refunds')
      .update({ status: 'completed' })
      .eq('id', refund.id);

    // 4. Marcar webhook como processado
    await this.markWebhookSuccess(tenantId, originalPaymentId, webhookId);

    return {
      success: true,
      reason: 'chargeback_processed',
      refund: {
        id: refund.id,
        amount: chargebackAmount
      }
    };
  }

  /**
   * Obter histórico de webhooks de um tenant
   */
  async getWebhookHistory(tenantId, limit = 50) {
    const { data, error } = await this.supabase
      .from('webhook_events')
      .select('id, external_event_id, event_type, status, created_at, processed_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar webhooks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Obter histórico de refunds de um tenant
   */
  async getRefundHistory(tenantId, limit = 50) {
    const { data, error } = await this.supabase
      .from('refunds')
      .select('id, original_payment_id, amount_cents, reason, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar refunds: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Publicar notificação de falha de pagamento
   * @private
   */
  async _publishPaymentFailedNotification(tenantId, payment, failureReason) {
    try {
      // Buscar primeiro admin do tenant para enviar notificação
      const { data: admin } = await this.supabase
        .from('tenants_users')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', 'owner')
        .limit(1)
        .single();

      if (admin) {
        const { data: user } = await this.supabase
          .from('auth.users')
          .select('id, email, user_metadata')
          .eq('id', admin.user_id)
          .single();

        if (user) {
          const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário';
          const reason = failureReason === 'DECLINED' ? 'Recusa da instituição financeira' : 'Erro no processamento';
          await this.eventPublisher.paymentFailed(
            tenantId,
            { id: user.id, email: user.email, name: userName },
            reason,
            payment.getnet_payment_id
          );
        }
      }
    } catch (error) {
      console.warn(`[Webhook] Falha ao publicar notificação de pagamento falho: ${error.message}`);
      // Não falhar o processamento do webhook se a notificação falhar
    }
  }
}

export default WebhookService;
