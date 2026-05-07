import Queue from 'bull';
import { logger } from '../../web/client-area/src/utils/logger.js';

/**
 * WebhookQueueService — Job Queue para processamento confiável de webhooks
 *
 * Responsabilidades:
 *   - Enfileira webhooks para processamento assíncrono
 *   - Retry automático com exponential backoff (3, 5, 10, 20 minutos)
 *   - Dead letter queue para falhas permanentes
 *   - Idempotência via webhook ID
 *   - Métricas de sucesso/falha
 */

export class WebhookQueueService {
  constructor({ redisUrl = 'redis://localhost:6379', billingService } = {}) {
    this.billingService = billingService;
    this.redisUrl = redisUrl;
    this.queue = null;
    this.deadLetterQueue = null;
    this.isInitialized = false;
  }

  /**
   * Inicializar filas (chamar uma vez na startup)
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      this.queue = new Queue('webhooks', this.redisUrl, {
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 86400 },
        },
        settings: {
          retryProcessDelay: 5000,
          maxStalledCount: 2,
          stalledInterval: 5000,
        },
      });

      this.deadLetterQueue = new Queue('webhooks-dead-letter', this.redisUrl, {
        defaultJobOptions: {
          removeOnComplete: { age: 604800 },
        },
      });

      // Processar jobs da fila principal
      this.queue.process(async (job) => {
        return this.processWebhookJob(job);
      });

      // Listener para jobs completados
      this.queue.on('completed', (job) => {
        logger.info('[Webhook Queue] Job completado', {
          jobId: job.id,
          webhookId: job.data.webhookId,
          provider: job.data.provider,
          attempts: job.attemptsMade,
        });
      });

      // Listener para jobs que falharam
      this.queue.on('failed', async (job, err) => {
        logger.error('[Webhook Queue] Job falhou', err, {
          jobId: job.id,
          webhookId: job.data.webhookId,
          provider: job.data.provider,
          attempts: job.attemptsMade,
          maxAttempts: job.opts.attempts,
        });

        if (job.attemptsMade >= job.opts.attempts) {
          await this.moveToDeadLetter(job, err);
        }
      });

      this.isInitialized = true;
      logger.info('[Webhook Queue] Inicializado com sucesso', {
        redisUrl: this.redisUrl.replace(/:[^@]*@/, ':***@'),
      });
    } catch (error) {
      logger.error('[Webhook Queue] Erro ao inicializar', error, {});
      throw error;
    }
  }

  /**
   * Enfileirar webhook para processamento assíncrono
   *
   * @param {string} provider - Provider (getnet, etc)
   * @param {Object} payload - Payload do webhook
   * @param {Object} headers - Headers da requisição
   * @returns {Promise<Object>} { ok, jobId, retryAfter }
   */
  async enqueueWebhook({ provider, payload, headers = {}, webhookId = null }) {
    if (!this.isInitialized) {
      throw new Error('WebhookQueueService não foi inicializado. Chame .initialize() primeiro.');
    }

    try {
      const jobData = {
        provider,
        payload,
        headers,
        webhookId: webhookId || `${provider}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        enqueuedAt: new Date().toISOString(),
      };

      const job = await this.queue.add(jobData, {
        jobId: jobData.webhookId,
      });

      logger.info('[Webhook Queue] Webhook enfileirado', {
        jobId: job.id,
        webhookId: jobData.webhookId,
        provider,
      });

      return {
        ok: true,
        jobId: job.id,
        webhookId: jobData.webhookId,
        retryAfter: 5,
      };
    } catch (error) {
      logger.error('[Webhook Queue] Erro ao enfileirar webhook', error, { provider });
      return {
        ok: false,
        error: error.message,
        retryAfter: 60,
      };
    }
  }

  /**
   * Processar job de webhook (executado pelo worker)
   */
  async processWebhookJob(job) {
    const { provider, payload, headers, webhookId } = job.data;
    const startTime = Date.now();

    try {
      logger.debug('[Webhook Queue Worker] Iniciando processamento', {
        jobId: job.id,
        webhookId,
        provider,
        attempt: job.attemptsMade + 1,
      });

      if (!this.billingService?.handleWebhook) {
        throw new Error('billingService.handleWebhook não disponível');
      }

      const result = await this.billingService.handleWebhook(payload, {}, headers);

      const duration = Date.now() - startTime;
      logger.info('[Webhook Queue Worker] Job processado com sucesso', {
        jobId: job.id,
        webhookId,
        provider,
        duration,
        result: result?.action || 'processed',
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.warn('[Webhook Queue Worker] Job falhou', error, {
        jobId: job.id,
        webhookId,
        provider,
        duration,
        attempt: job.attemptsMade + 1,
        nextRetry: job.attemptsMade < job.opts.attempts ? 'sim' : 'não (irá para DLQ)',
      });

      throw error;
    }
  }

  /**
   * Mover job para dead letter queue
   */
  async moveToDeadLetter(job, error) {
    try {
      const dlqData = {
        originalJobId: job.id,
        webhookId: job.data.webhookId,
        provider: job.data.provider,
        payload: job.data.payload,
        headers: job.data.headers,
        error: {
          message: error?.message,
          stack: error?.stack,
        },
        attemptsMade: job.attemptsMade,
        failedAt: new Date().toISOString(),
      };

      const dlqJob = await this.deadLetterQueue.add(dlqData, {
        jobId: `dlq-${job.id}`,
      });

      logger.error('[Webhook DLQ] Job movido para dead letter queue', error, {
        jobId: job.id,
        dlqJobId: dlqJob.id,
        webhookId: job.data.webhookId,
        provider: job.data.provider,
      });
    } catch (dlqError) {
      logger.error('[Webhook DLQ] Erro ao mover para DLQ', dlqError, {
        jobId: job.id,
        webhookId: job.data.webhookId,
      });
    }
  }

  /**
   * Obter status da fila
   */
  async getStatus() {
    if (!this.isInitialized) {
      return { status: 'not-initialized' };
    }

    try {
      const counts = await this.queue.getJobCounts();
      const dlqCounts = await this.deadLetterQueue.getJobCounts();

      return {
        status: 'ok',
        queue: counts,
        deadLetterQueue: dlqCounts,
        redis: this.redisUrl.replace(/:[^@]*@/, ':***@'),
      };
    } catch (error) {
      logger.error('[Webhook Queue] Erro ao obter status', error, {});
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Limpar jobs completados (chamado periodicamente)
   */
  async cleanup() {
    try {
      const removed = await this.queue.clean(3600000, 100);
      logger.info('[Webhook Queue] Limpeza executada', { removed });
    } catch (error) {
      logger.warn('[Webhook Queue] Erro ao limpar', error, {});
    }
  }

  /**
   * Encerrar filas (chamar no shutdown)
   */
  async shutdown() {
    try {
      if (this.queue) await this.queue.close();
      if (this.deadLetterQueue) await this.deadLetterQueue.close();
      this.isInitialized = false;
      logger.info('[Webhook Queue] Encerrado com sucesso', {});
    } catch (error) {
      logger.error('[Webhook Queue] Erro ao encerrar', error, {});
    }
  }
}
