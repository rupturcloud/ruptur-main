/**
 * Testes de Idempotência — Semana 2
 *
 * Valida:
 * - Mesma requisição 2x = mesma resposta
 * - Race conditions evitadas com lock otimista
 * - Retry automático funciona
 *
 * Uso: npm test -- tests/idempotency.test.js
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { BillingService } from '../modules/billing/billing.service.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const describeIfSupabase = SUPABASE_KEY ? describe : describe.skip;

describeIfSupabase('Idempotência — Semana 2', () => {
  let supabase;
  let billingService;
  let testTenantId;
  let testUserId;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    billingService = new BillingService(supabase, null, null);

    // TODO: Setup tenant e user de teste
    // testTenantId = ...
    // testUserId = ...
  });

  // =========================================================================
  // Testes de Idempotência
  // =========================================================================

  describe('Idempotência: Mesma Requisição = Mesma Resposta', () => {
    test('2x POST /api/billing/checkout com mesmos params = mesmo ID', async () => {
      // Arrange: packageData
      const packageData = { id: 'credits_100', amountCents: 10000, name: '100 Créditos' };

      // Act: 1ª requisição
      const res1 = await billingService.createCheckoutIdempotent(
        testTenantId,
        testUserId,
        packageData
      );

      // Act: 2ª requisição (mesmos params)
      const res2 = await billingService.createCheckoutIdempotent(
        testTenantId,
        testUserId,
        packageData
      );

      // Assert: IDs iguais (não criou novo)
      expect(res1.id).toBe(res2.id);
      expect(res1.idempotencyKey).toBe(res2.idempotencyKey);
      expect(res1.isNew).toBe(true);
      expect(res2.isNew).toBe(false);
    });

    test('Múltiplas requisições (3x) retornam mesmo payment', async () => {
      const packageData = { id: 'credits_50', amountCents: 5000, name: '50 Créditos' };

      const res1 = await billingService.createCheckoutIdempotent(testTenantId, testUserId, packageData);
      const res2 = await billingService.createCheckoutIdempotent(testTenantId, testUserId, packageData);
      const res3 = await billingService.createCheckoutIdempotent(testTenantId, testUserId, packageData);

      expect(res1.id).toBe(res2.id);
      expect(res2.id).toBe(res3.id);
      expect(res1.isNew).toBe(true);
      expect(res2.isNew).toBe(false);
      expect(res3.isNew).toBe(false);
    });

    test('Requisição diferente (outro amount) = novo payment', async () => {
      const pkg1 = { id: 'credits_100', amountCents: 10000, name: '100 Créditos' };
      const pkg2 = { id: 'credits_200', amountCents: 20000, name: '200 Créditos' };

      const res1 = await billingService.createCheckoutIdempotent(testTenantId, testUserId, pkg1);
      const res2 = await billingService.createCheckoutIdempotent(testTenantId, testUserId, pkg2);

      expect(res1.id).not.toBe(res2.id);
      expect(res1.idempotencyKey).not.toBe(res2.idempotencyKey);
      expect(res2.isNew).toBe(true);
    });
  });

  // =========================================================================
  // Testes de Lock Otimista
  // =========================================================================

  describe('Lock Otimista: Race Conditions Evitadas', () => {
    test('Crédito simultâneo (race condition) usa retry automático', async () => {
      // Arrange: 2 requisições simultâneas de crédito
      const amount = 100;
      const ref1 = 'payment_1';
      const ref2 = 'payment_2';

      // Act: Enviar 2 requisições em paralelo
      const [res1, res2] = await Promise.all([
        billingService.creditWalletWithRetry(testTenantId, amount, ref1),
        billingService.creditWalletWithRetry(testTenantId, amount, ref2)
      ]);

      // Assert: Ambas completaram com sucesso
      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res1.balanceAfter).toBe(res2.balanceBefore + amount);
      expect(res2.balanceAfter).toBe(res1.balanceAfter + amount);
    });

    test('Débito com retry em race condition não duplica redução', async () => {
      // Arrange: wallet com saldo conhecido
      const amount = 50;
      const ref = 'test_debit';

      // Act: 2 débitos simultâneos
      const [res1, res2] = await Promise.all([
        billingService.debitWalletWithRetry(testTenantId, amount, `${ref}_1`),
        billingService.debitWalletWithRetry(testTenantId, amount, `${ref}_2`)
      ]);

      // Assert: Ambas completaram, saldo reduzido em 2x amount
      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);

      const finalWallet = await billingService.getWalletBalance(testTenantId);
      expect(finalWallet.balance).toBe(res1.balanceBefore - (amount * 2));
    });

    test('Version incrementa após cada atualização', async () => {
      const initialWallet = await billingService.getWalletBalance(testTenantId);
      const v1 = initialWallet.version;

      // Crédito 1
      const res1 = await billingService.creditWalletWithRetry(testTenantId, 10, 'test_v1');
      expect(res1.versionAfter).toBe(v1 + 1);

      // Crédito 2
      const res2 = await billingService.creditWalletWithRetry(testTenantId, 10, 'test_v2');
      expect(res2.versionAfter).toBe(v1 + 2);

      // Crédito 3
      const res3 = await billingService.creditWalletWithRetry(testTenantId, 10, 'test_v3');
      expect(res3.versionAfter).toBe(v1 + 3);
    });
  });

  // =========================================================================
  // Testes de Saldo Insuficiente
  // =========================================================================

  describe('Validação: Saldo Insuficiente', () => {
    test('Débito maior que saldo retorna erro', async () => {
      const wallet = await billingService.getWalletBalance(testTenantId);
      const tooMuch = wallet.balance + 1000;

      const res = await billingService.debitWalletWithRetry(testTenantId, tooMuch, 'test_insufficient');

      expect(res.success).toBe(false);
      expect(res.error).toContain('Saldo insuficiente');
    });
  });

  // =========================================================================
  // Testes de Retry Backoff
  // =========================================================================

  describe('Retry Backoff: Espera Exponencial', () => {
    test('Máximo de retries não excede 3 (default)', async () => {
      // Este teste é mais sobre logging que sobre verificação
      // Pode verificar que `attempts` nunca > 3

      const res = await billingService.creditWalletWithRetry(
        testTenantId,
        100,
        'test_retry_limit',
        3 // max retries
      );

      expect(res.attempts).toBeLessThanOrEqual(3);
    });
  });

  afterAll(async () => {
    // Cleanup
  });
});

/**
 * TODO (Próximas Semanas)
 *
 * Semana 3: Webhook + Refunds
 * - Testes de webhook idempotente
 * - Testes de chargeback reversal
 *
 * Semana 4: Performance + Metrics
 * - Testes de carga (load testing)
 * - Testes de métricas de auditoria
 */
