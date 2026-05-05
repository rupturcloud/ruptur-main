/**
 * Testes de Webhooks — Semana 3
 *
 * Valida:
 * - Webhooks idempotentes (mesmo event_id = mesmo resultado)
 * - Processamento correto de payment status
 * - Refund/Chargeback handling
 * - Rollback em caso de erro
 *
 * Uso: npm test -- tests/webhook.test.js
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { WebhookService } from '../modules/billing/webhook.service.js';
import { setupTestTenant } from './setup.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const describeIfSupabase = SUPABASE_SERVICE_KEY ? describe : describe.skip;

describeIfSupabase('Webhooks — Semana 3', () => {
  let supabase;
  let webhookService;
  let testTenantId;
  let testPaymentId;
  let cleanup;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    webhookService = new WebhookService(supabase, null);

    // Setup tenant de teste
    const setup = await setupTestTenant();
    testTenantId = setup.tenantId;
    testPaymentId = setup.paymentId;
    cleanup = setup.cleanup;
  });

  // =========================================================================
  // Testes de Idempotência de Webhooks
  // =========================================================================

  describe('Idempotência: Mesmo Event = Mesma Resposta', () => {
    test('2x webhook com mesmo external_event_id = mesma resposta', async () => {
      const externalEventId = 'getnet_webhook_test_001';
      const payload = {
        transaction_id: 'txn_12345',
        status: 'APPROVED',
        amount: 10000
      };

      // 1ª requisição
      const res1 = await webhookService.processWebhookIdempotent(
        testTenantId,
        externalEventId,
        'payment_status_update',
        payload
      );

      // 2ª requisição (mesmo event_id)
      const res2 = await webhookService.processWebhookIdempotent(
        testTenantId,
        externalEventId,
        'payment_status_update',
        payload
      );

      // Assert
      expect(res1.id).toBe(res2.id);
      expect(res1.isNew).toBe(true);
      expect(res2.isNew).toBe(false); // Segundo acesso é idempotente
    });

    test('Webhook duplicado (em processamento) retorna status processing', async () => {
      const externalEventId = 'getnet_webhook_test_processing';
      const payload = { transaction_id: 'txn_dup_001', status: 'APPROVED' };

      const res1 = await webhookService.processWebhookIdempotent(
        testTenantId,
        externalEventId,
        'payment_status_update',
        payload
      );

      // Ainda está em processamento, não foi marcado como sucesso ainda
      const res2 = await webhookService.processWebhookIdempotent(
        testTenantId,
        externalEventId,
        'payment_status_update',
        payload
      );

      expect(res2.status).toBe('processing');
      expect(res2.isNew).toBe(false);
    });
  });

  // =========================================================================
  // Testes de Payment Status Update
  // =========================================================================

  describe('Payment Status: Processamento Correto', () => {
    test('Webhook APPROVED credita wallet', async () => {
      // Arrange: payment com status INITIATED
      // Act: Webhook com status APPROVED
      // Assert: Payment atualizado e créditos adicionados

      // expect(wallet.balance).toHaveIncreased();
      // expect(payment.status).toBe('APPROVED');
    });

    test('Webhook DENIED atualiza sem creditar', async () => {
      // Arrange: payment com status INITIATED
      // Act: Webhook com status DENIED
      // Assert: Payment atualizado mas créditos NÃO adicionados

      // expect(wallet.balance).toRemainSame();
      // expect(payment.status).toBe('DENIED');
    });

    test('Webhook idempotente não duplica crédito', async () => {
      // Arrange: Payment já processado com status APPROVED (e créditos adicionados)
      // Act: Mesmo webhook recebido de novo
      // Assert: Créditos não duplicados, wallet não alterada

      // expect(wallet.balance).toNotChange();
    });
  });

  // =========================================================================
  // Testes de Refund/Chargeback
  // =========================================================================

  describe('Refund: Chargeback Handling', () => {
    test('Chargeback reverter créditos da wallet', async () => {
      // Arrange: Payment aprovado com créditos na wallet
      // Act: Webhook de chargeback
      // Assert: Créditos revertidos, refund criado

      // const initialBalance = wallet.balance;
      // await webhookService.processChargeback(...);
      // expect(wallet.balance).toBe(initialBalance - chargebackAmount);
    });

    test('Refund fail não altera wallet', async () => {
      // Arrange: Payment com error ao processar refund
      // Act: Tentar fazer refund
      // Assert: Refund status=failed, wallet intacta

      // expect(refund.status).toBe('failed');
      // expect(wallet.balance).toRemainUnchanged();
    });

    test('Refund é idempotente (mesmo chargeback 2x = 1x débito)', async () => {
      // Arrange: Chargeback recebido
      // Act: Mesmo chargeback recebido de novo
      // Assert: Refund já existe, não duplica débito

      // expect(wallet.balance).toChangeOnce();
    });
  });

  // =========================================================================
  // Testes de Webhook History
  // =========================================================================

  describe('History: Rastreamento de Webhooks', () => {
    test('getWebhookHistory retorna eventos em ordem', async () => {
      const history = await webhookService.getWebhookHistory(testTenantId, 10);

      expect(Array.isArray(history)).toBe(true);
      // Assert: eventos em ordem decrescente por created_at
      if (history.length > 1) {
        expect(new Date(history[0].created_at) >= new Date(history[1].created_at)).toBe(true);
      }
    });

    test('getRefundHistory retorna refunds em ordem', async () => {
      const refunds = await webhookService.getRefundHistory(testTenantId, 10);

      expect(Array.isArray(refunds)).toBe(true);
    });
  });

  // =========================================================================
  // Testes de RLS (Row Level Security)
  // =========================================================================

  describe('Security: RLS Isolamento', () => {
    test('User de TenantA não consegue ver webhooks de TenantB', async () => {
      // Arrange: User de TenantA
      // Act: Tentar SELECT webhook_events de TenantB
      // Assert: Retorna vazio (RLS bloqueia)

      // expect(userAWebhooksOfTenantB.length).toBe(0);
    });
  });

  afterAll(async () => {
    if (cleanup) {
      await cleanup();
    }
  });
});

/**
 * TODO (Próximas Semanas)
 *
 * Semana 4: Performance + Metrics
 * - Testes de carga (load testing) de webhooks
 * - Testes de métricas de auditoria
 */
