/**
 * Webhook Queue Service
 *
 * Processa webhooks assincronamente com retry automático e dead-letter queue.
 * Garante idempotência via constraint UNIQUE(tenant_id, external_event_id).
 *
 * Fluxo:
 * 1. POST /api/webhooks/stripe → INSERT webhook_events (raw)
 * 2. Return 202 Accepted imediatamente
 * 3. Background job processa com retry exponencial
 * 4. Se falhar 5x → dead-letter queue (manual fix)
 */

export class WebhookQueueService {
  constructor(supabase, logger = console) {
    this.supabase = supabase;
    this.logger = logger;
    this.MAX_RETRIES = 5;
    this.RETRY_DELAY_MS = 1000; // 1s, exponencial: 1s, 2s, 4s, 8s, 16s
  }

  /**
   * Enqueue webhook para processamento assíncrono
   * Retorna imediatamente (202 Accepted)
   */
  async enqueueWebhook(provider, payload, signature, context = {}) {
    try {
      const { error } = await this.supabase
        .from('webhook_events')
        .insert({
          tenant_id: context.tenantId || null,
          provider: provider,
          external_event_id: payload.id || payload.event_id,
          status: 'pending', // pending, processing, completed, failed
          retry_count: 0,
          payload_json: payload,
          signature: signature,
          error_message: null,
          processed_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        // UNIQUE constraint: webhook já existe (duplicata)
        if (error.code === '23505') {
          this.logger.warn(
            `⚠️ Webhook duplicado: ${provider}/${payload.id} (ignorando)`
          );
          return { enqueued: false, duplicate: true };
        }
        throw error;
      }

      this.logger.info(
        `✅ Webhook enqueued: ${provider}/${payload.id}`
      );
      return { enqueued: true, duplicate: false };
    } catch (error) {
      this.logger.error('❌ Erro enqueueing webhook:', error.message);
      throw error;
    }
  }

  /**
   * Processa webhooks pendentes (com retry automático)
   * Deve ser chamado periodicamente (e.g., background job a cada 30s)
   */
  async processPendingWebhooks(paymentGatewayService) {
    try {
      const { data: pendingEvents, error: fetchError } = await this.supabase
        .from('webhook_events')
        .select('*')
        .eq('status', 'pending')
        .lt('retry_count', this.MAX_RETRIES)
        .order('created_at', { ascending: true })
        .limit(10); // Processa 10 por vez (não sobrecarrega)

      if (fetchError) throw fetchError;

      if (!pendingEvents || pendingEvents.length === 0) {
        return { processed: 0, failed: 0 };
      }

      let processed = 0;
      let failed = 0;

      for (const event of pendingEvents) {
        try {
          await this.processWebhookEvent(event, paymentGatewayService);
          processed++;
        } catch (error) {
          this.logger.error(
            `❌ Erro processando webhook ${event.id}:`,
            error.message
          );

          // Atualiza retry_count
          const retryDelay = Math.pow(2, event.retry_count) * this.RETRY_DELAY_MS;
          const nextRetryAt = new Date(
            Date.now() + retryDelay
          ).toISOString();

          const { error: updateError } = await this.supabase
            .from('webhook_events')
            .update({
              retry_count: event.retry_count + 1,
              error_message: error.message.substring(0, 500), // Limita tamanho
              updated_at: new Date().toISOString(),
              next_retry_at: nextRetryAt,
              status:
                event.retry_count + 1 >= this.MAX_RETRIES
                  ? 'dead-letter'
                  : 'pending'
            })
            .eq('id', event.id);

          if (updateError) {
            this.logger.error('❌ Erro atualizando retry_count:', updateError.message);
          }

          failed++;
        }
      }

      this.logger.info(
        `✅ Webhook processing complete: ${processed} processed, ${failed} failed`
      );
      return { processed, failed };
    } catch (error) {
      this.logger.error('❌ Erro processando pending webhooks:', error.message);
      throw error;
    }
  }

  /**
   * Processa um webhook event específico
   */
  async processWebhookEvent(event, paymentGatewayService) {
    // Marca como processando
    await this.supabase
      .from('webhook_events')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', event.id);

    try {
      // Valida assinatura
      const gateway = await paymentGatewayService.getAdapter(event.provider);
      const isValid = gateway.validateWebhookSignature(
        JSON.stringify(event.payload_json),
        event.signature
      );

      if (!isValid) {
        throw new Error('Signature validation failed');
      }

      // Normaliza webhook
      const normalized = gateway.normalizeWebhook(event.payload_json, {
        tenantId: event.tenant_id,
        providerEventId: event.external_event_id
      });

      // Processa evento normalizado (salva em payments, wallet_transactions, etc)
      await paymentGatewayService.processNormalizedEvent(normalized);

      // Marca como completo
      await this.supabase
        .from('webhook_events')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);

      this.logger.info(
        `✅ Webhook processed: ${event.provider}/${event.external_event_id}`
      );
    } catch (error) {
      // Error será tratado no retry logic
      throw error;
    }
  }

  /**
   * Retorna estatísticas da fila
   */
  async getQueueStats() {
    try {
      const { data: stats, error } = await this.supabase.rpc(
        'get_webhook_queue_stats'
      );

      if (error) {
        this.logger.error('❌ Erro getting queue stats:', error.message);
        return null;
      }

      return stats;
    } catch (error) {
      this.logger.error('❌ Erro em getQueueStats:', error.message);
      return null;
    }
  }

  /**
   * Limpa webhooks muito antigos (> 30 dias)
   */
  async cleanup() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await this.supabase
        .from('webhook_events')
        .delete()
        .lt('created_at', thirtyDaysAgo)
        .eq('status', 'completed');

      if (error) {
        this.logger.error('❌ Erro limpando webhooks antigos:', error.message);
        return;
      }

      this.logger.info('✅ Webhook cleanup completed');
    } catch (error) {
      this.logger.error('❌ Erro em cleanup:', error.message);
    }
  }
}

export default WebhookQueueService;
