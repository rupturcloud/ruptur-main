/**
 * Integração de Webhook Queue com WebhookService
 *
 * Enfileira webhooks para processamento confiável com retry automático.
 * Mantém compatibilidade com código existente.
 */

export class WebhookQueueIntegration {
  constructor({ webhookQueue, webhookService }) {
    this.webhookQueue = webhookQueue;
    this.webhookService = webhookService;
  }

  /**
   * Enfileirar webhook para processamento assíncrono
   *
   * @param {Object} params
   * @returns {Promise<Object>} { ok, jobId, webhookId }
   */
  async enqueuePaymentWebhook({
    tenantId,
    externalEventId,
    eventType,
    payload,
    headers = {},
  }) {
    if (!this.webhookQueue) {
      throw new Error('WebhookQueue não inicializada');
    }

    return this.webhookQueue.enqueueWebhook({
      provider: 'getnet',
      payload: {
        tenant_id: tenantId,
        external_event_id: externalEventId,
        event_type: eventType,
        data: payload,
      },
      headers,
      webhookId: `${tenantId}-${externalEventId}`,
    });
  }

  /**
   * Processar webhook (chamado pelo worker da fila)
   * Mantém a lógica de negócio original
   */
  async processPaymentWebhook({
    tenantId,
    externalEventId,
    eventType,
    payload,
  }) {
    if (!this.webhookService) {
      throw new Error('WebhookService não disponível');
    }

    const webhook = await this.webhookService.processWebhookIdempotent(
      tenantId,
      externalEventId,
      eventType || 'payment_status_update',
      payload
    );

    if (webhook.status === 'success' && eventType === 'payment_status_update') {
      await this.webhookService.processPaymentStatusUpdate(
        tenantId,
        payload.transaction_id,
        payload
      );
    }

    return webhook;
  }

  /**
   * Obter status da fila
   */
  async getQueueStatus() {
    if (!this.webhookQueue) {
      return { status: 'not-initialized' };
    }
    return this.webhookQueue.getStatus();
  }

  /**
   * Obter DLQ (dead letter queue) para investigação
   */
  async getDeadLetterQueue() {
    if (!this.webhookQueue?.deadLetterQueue) {
      return { jobs: [] };
    }

    try {
      const dlq = this.webhookQueue.deadLetterQueue;
      const jobs = await dlq.getJobs(
        ['failed', 'completed'],
        0,
        100
      );

      return {
        count: jobs.length,
        jobs: jobs.map((job) => ({
          id: job.id,
          webhookId: job.data?.webhookId,
          provider: job.data?.provider,
          failedAt: job.data?.failedAt,
          error: job.data?.error?.message,
          attemptsMade: job.data?.attemptsMade,
        })),
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}
