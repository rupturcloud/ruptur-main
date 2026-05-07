/**
 * Testes de WebhookQueueService — Processamento Confiável de Webhooks
 *
 * Valida:
 * - Enfileiramento de webhooks
 * - Processamento de jobs
 * - Estrutura e integração
 * - Status e monitoramento
 *
 * Nota: Testes com mocks em vez de Redis real (não requer infraestrutura).
 * Para testes de integração com Redis, usar Redis local: redis-cli PING
 *
 * Uso: npm test -- tests/webhook-queue.test.js
 */

import { describe, test, expect, beforeAll, jest } from '@jest/globals';
import { WebhookQueueIntegration } from '../modules/webhook-core/webhook-queue-integration.js';

// Mock do WebhookService e WebhookQueue
const createMockWebhookQueue = () => ({
  enqueueWebhook: jest.fn().mockResolvedValue({
    ok: true,
    jobId: 'job_123',
    webhookId: 'webhook_123',
  }),
  getStatus: jest.fn().mockResolvedValue({
    status: 'ok',
    queue: { active: 0, waiting: 0, completed: 5 },
    deadLetterQueue: { failed: 0 },
  }),
  deadLetterQueue: {
    getJobs: jest.fn().mockResolvedValue([]),
  },
});

const createMockWebhookService = () => ({
  processWebhookIdempotent: jest.fn().mockResolvedValue({
    id: 'webhook_001',
    status: 'success',
  }),
  processPaymentStatusUpdate: jest.fn().mockResolvedValue(true),
  processChargeback: jest.fn().mockResolvedValue(true),
});

describe('WebhookQueueIntegration — Wrapper de Compatibilidade', () => {
  let integration;
  let mockWebhookQueue;
  let mockWebhookService;

  beforeAll(() => {
    mockWebhookQueue = createMockWebhookQueue();
    mockWebhookService = createMockWebhookService();

    integration = new WebhookQueueIntegration({
      webhookQueue: mockWebhookQueue,
      webhookService: mockWebhookService,
    });
  });

  describe('Enfileiramento', () => {
    test('enqueuePaymentWebhook deve transformar params e chamar queue', async () => {
      const result = await integration.enqueuePaymentWebhook({
        tenantId: 'tenant_123',
        externalEventId: 'evt_001',
        eventType: 'payment_status_update',
        payload: { status: 'APPROVED' },
        headers: { 'x-signature': 'sig123' },
      });

      expect(mockWebhookQueue.enqueueWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'getnet',
          webhookId: 'tenant_123-evt_001',
        })
      );
      expect(result.ok).toBe(true);
      expect(result.jobId).toBe('job_123');
    });

    test('enqueuePaymentWebhook sem queue deve lançar erro', async () => {
      const integrationWithoutQueue = new WebhookQueueIntegration({
        webhookQueue: null,
        webhookService: mockWebhookService,
      });

      await expect(
        integrationWithoutQueue.enqueuePaymentWebhook({
          tenantId: 'tenant_123',
          externalEventId: 'evt_002',
          eventType: 'payment_status_update',
          payload: {},
        })
      ).rejects.toThrow('não inicializada');
    });

    test('enqueuePaymentWebhook deve incluir signature em headers', async () => {
      const mockQueue = createMockWebhookQueue();
      const integration2 = new WebhookQueueIntegration({
        webhookQueue: mockQueue,
        webhookService: mockWebhookService,
      });

      await integration2.enqueuePaymentWebhook({
        tenantId: 'tenant_456',
        externalEventId: 'evt_789',
        eventType: 'chargeback',
        payload: { amount: 5000 },
        headers: { 'x-getnet-signature': 'sig_abc' },
      });

      expect(mockQueue.enqueueWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-getnet-signature': 'sig_abc',
          }),
        })
      );
    });
  });

  describe('Processamento', () => {
    test('processPaymentWebhook deve processar via webhookService', async () => {
      const result = await integration.processPaymentWebhook({
        tenantId: 'tenant_123',
        externalEventId: 'evt_003',
        eventType: 'payment_status_update',
        payload: { transaction_id: 'txn_001', status: 'APPROVED' },
      });

      expect(mockWebhookService.processWebhookIdempotent).toHaveBeenCalledWith(
        'tenant_123',
        'evt_003',
        'payment_status_update',
        expect.any(Object)
      );
      expect(result.status).toBe('success');
    });

    test('processPaymentWebhook sem service deve lançar erro', async () => {
      const integrationWithoutService = new WebhookQueueIntegration({
        webhookQueue: mockWebhookQueue,
        webhookService: null,
      });

      await expect(
        integrationWithoutService.processPaymentWebhook({
          tenantId: 'tenant_123',
          externalEventId: 'evt_004',
          eventType: 'payment_status_update',
          payload: {},
        })
      ).rejects.toThrow('não disponível');
    });

    test('processPaymentWebhook com eventType payment_status_update deve atualizar status', async () => {
      const mockService = createMockWebhookService();
      const integration2 = new WebhookQueueIntegration({
        webhookQueue: mockWebhookQueue,
        webhookService: mockService,
      });

      await integration2.processPaymentWebhook({
        tenantId: 'tenant_789',
        externalEventId: 'evt_update',
        eventType: 'payment_status_update',
        payload: { transaction_id: 'txn_999', status: 'APPROVED' },
      });

      expect(mockService.processPaymentStatusUpdate).toHaveBeenCalled();
    });
  });

  describe('Monitoramento', () => {
    test('getQueueStatus deve retornar status da fila', async () => {
      const mockQueue = createMockWebhookQueue();
      const integration2 = new WebhookQueueIntegration({
        webhookQueue: mockQueue,
        webhookService: mockWebhookService,
      });

      const status = await integration2.getQueueStatus();

      expect(mockQueue.getStatus).toHaveBeenCalled();
      expect(status.status).toBe('ok');
      expect(status.queue).toBeDefined();
    });

    test('getQueueStatus com queue não inicializada deve retornar not-initialized', async () => {
      const integration2 = new WebhookQueueIntegration({
        webhookQueue: null,
        webhookService: mockWebhookService,
      });

      const status = await integration2.getQueueStatus();
      expect(status.status).toBe('not-initialized');
    });

    test('getDeadLetterQueue deve retornar jobs da DLQ', async () => {
      const mockQueue = createMockWebhookQueue();
      mockQueue.deadLetterQueue.getJobs.mockResolvedValue([
        {
          id: 'job_failed_1',
          data: {
            webhookId: 'webhook_fail_1',
            provider: 'getnet',
            error: new Error('Permanent failure'),
          },
        },
      ]);

      const integration2 = new WebhookQueueIntegration({
        webhookQueue: mockQueue,
        webhookService: mockWebhookService,
      });

      const dlq = await integration2.getDeadLetterQueue();
      expect(dlq.count).toBe(1);
      expect(dlq.jobs[0].webhookId).toBe('webhook_fail_1');
    });

    test('getDeadLetterQueue sem DLQ configurada deve retornar jobs vazio', async () => {
      const mockQueueNoDLQ = {
        getStatus: jest.fn().mockResolvedValue({ status: 'ok' }),
        deadLetterQueue: null,
      };

      const integration2 = new WebhookQueueIntegration({
        webhookQueue: mockQueueNoDLQ,
        webhookService: mockWebhookService,
      });

      const dlq = await integration2.getDeadLetterQueue();
      expect(dlq.jobs).toEqual([]);
    });
  });

  describe('Integração com Routes', () => {
    test('Dados enfileirados devem conter provider e tenant_id', async () => {
      const mockQueue = createMockWebhookQueue();
      const integration2 = new WebhookQueueIntegration({
        webhookQueue: mockQueue,
        webhookService: mockWebhookService,
      });

      await integration2.enqueuePaymentWebhook({
        tenantId: 'tenant_prod',
        externalEventId: 'evt_prod_001',
        eventType: 'payment_status_update',
        payload: { transaction_id: 'txn_prod_001' },
      });

      const callArgs = mockQueue.enqueueWebhook.mock.calls[0][0];
      expect(callArgs.payload.tenant_id).toBe('tenant_prod');
      expect(callArgs.payload.external_event_id).toBe('evt_prod_001');
      expect(callArgs.provider).toBe('getnet');
    });
  });
});
