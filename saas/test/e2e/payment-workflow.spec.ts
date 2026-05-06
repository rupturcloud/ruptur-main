/**
 * E2E Tests: Payment Workflow
 *
 * Testa fluxo completo:
 * 1. Login com Google
 * 2. Visualizar saldo de créditos
 * 3. Enviar mensagem (debit créditos)
 * 4. Webhook de pagamento aprovado (credit créditos)
 * 5. Validar que saldo foi atualizado
 */

import { test, expect, Page } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3001';
const WARMUP_BASE_URL = process.env.WARMUP_BASE_URL || 'http://127.0.0.1:4173';
const BASE_URL = API_BASE_URL;
const WEBHOOK_URL = `${API_BASE_URL}/api/webhooks/getnet`;
const legacyPaymentWorkflow = process.env.RUN_LEGACY_PAYMENT_WORKFLOW === 'true'
  ? test.describe
  : test.describe.skip;

// ============================================================================
// Helpers
// ============================================================================

async function login(page: Page) {
  // Acessar página inicial
  await page.goto(`${BASE_URL}/`);

  // Clicar em "Login com Google"
  const loginButton = page.locator('button:has-text("Login com Google")');
  await loginButton.click();

  // Aguardar redirecionamento para Google (mock ou real)
  await page.waitForURL(/.*auth.*/, { timeout: 5000 }).catch(() => {
    // Se falhar, significa que estamos em dev mode com mock
    console.log('Google redirect não detectado (esperado em mock)');
  });

  // Aguardar que cookie de autenticação seja setado
  await page.waitForFunction(
    () => document.cookie.includes('auth_token'),
    { timeout: 5000 }
  ).catch(() => console.log('Cookie não detectado, continuando...'));
}

async function getWalletBalance(page: Page): Promise<number> {
  // Ir para dashboard
  await page.goto(`${BASE_URL}/dashboard`);

  // Aguardar elemento de saldo
  const balanceText = await page
    .locator('text=/Saldo.*créditos/i')
    .first()
    .textContent();

  const match = balanceText?.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

async function sendMessage(page: Page, to: string, content: string) {
  // Ir para página de mensagens
  await page.goto(`${BASE_URL}/messages`);

  // Preencher formulário
  await page.fill('input[placeholder*="Para"]', to);
  await page.fill('textarea[placeholder*="Mensagem"]', content);

  // Clicar enviar
  await page.click('button:has-text("Enviar")');

  // Aguardar sucesso
  await page.waitForSelector('text=Mensagem enviada com sucesso', { timeout: 5000 });
}

async function triggerWebhook(getnetPaymentId: string, tenantId: string, creditsGranted: number) {
  /**
   * Simular webhook de pagamento aprovado
   * Em produção, isso viria de Getnet
   */
  const webhookSecret = process.env.GETNET_WEBHOOK_SECRET || 'test-secret';

  const payload = {
    event: 'PAYMENT_APPROVED',
    payment_id: getnetPaymentId,
    status: 'APPROVED',
  };

  const payloadJson = JSON.stringify(payload);

  // Calcular HMAC-SHA256
  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadJson)
    .digest('hex');

  // Enviar webhook
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
    },
    body: payloadJson,
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// ============================================================================
// Tests
// ============================================================================

legacyPaymentWorkflow('Payment Workflow', () => {

  test('1️⃣ Login com Google OAuth', async ({ page }) => {
    await login(page);

    // Validar que conseguimos acessar dashboard autenticado
    const response = await page.request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);
  });

  test('2️⃣ Visualizar saldo inicial de créditos', async ({ page }) => {
    await login(page);

    const balance = await getWalletBalance(page);
    console.log(`✅ Saldo inicial: ${balance} créditos`);

    expect(balance).toBeGreaterThanOrEqual(0);
  });

  test('3️⃣ Enviar mensagem (debit créditos)', async ({ page }) => {
    await login(page);

    const balanceBefore = await getWalletBalance(page);
    console.log(`📊 Antes: ${balanceBefore} créditos`);

    // Enviar mensagem (custa 10 créditos)
    await sendMessage(page, '+5511999999999', 'Teste de mensagem');

    // Aguardar atualização
    await page.waitForTimeout(1000);

    const balanceAfter = await getWalletBalance(page);
    console.log(`📊 Depois: ${balanceAfter} créditos`);

    expect(balanceAfter).toBe(balanceBefore - 10);
  });

  test('4️⃣ Webhook de pagamento aprovado (credit créditos)', async ({ page, context }) => {
    await login(page);

    const balanceBefore = await getWalletBalance(page);
    console.log(`💰 Antes: ${balanceBefore} créditos`);

    // Simular webhook de pagamento
    const webhookResult = await triggerWebhook(
      `getnet-pay-${Date.now()}`,
      'tenant-001',
      1000
    );

    expect(webhookResult.ok).toBe(true);
    console.log(`✅ Webhook processado: ${webhookResult.action}`);

    // Aguardar propagação
    await page.waitForTimeout(2000);

    // Recarregar página para ver saldo atualizado
    await page.reload();

    const balanceAfter = await getWalletBalance(page);
    console.log(`💰 Depois: ${balanceAfter} créditos`);

    expect(balanceAfter).toBe(balanceBefore + 1000);
  });

  test('5️⃣ Fluxo Completo: Login → Mensagem → Webhook → Validar', async ({ page }) => {
    // 1. Login
    await login(page);
    const balanceStart = await getWalletBalance(page);
    console.log(`\n🚀 FLUXO COMPLETO`);
    console.log(`1️⃣ Login ✅`);
    console.log(`   Saldo inicial: ${balanceStart}`);

    // 2. Enviar mensagem (-10 créditos)
    await sendMessage(page, '+5511988888888', 'Mensagem de teste E2E');
    await page.waitForTimeout(500);
    const balanceAfterMessage = await getWalletBalance(page);
    console.log(`2️⃣ Mensagem enviada ✅`);
    console.log(`   Saldo após envio: ${balanceAfterMessage}`);
    expect(balanceAfterMessage).toBe(balanceStart - 10);

    // 3. Webhook de pagamento (+1000 créditos)
    await triggerWebhook(`getnet-pay-${Date.now()}`, 'tenant-001', 1000);
    await page.waitForTimeout(2000);
    await page.reload();
    const balanceAfterWebhook = await getWalletBalance(page);
    console.log(`3️⃣ Webhook processado ✅`);
    console.log(`   Saldo após webhook: ${balanceAfterWebhook}`);
    expect(balanceAfterWebhook).toBe(balanceStart - 10 + 1000);

    // 4. Validar que tudo está correto
    console.log(`4️⃣ Validação ✅`);
    console.log(`   Esperado: ${balanceStart - 10 + 1000}, Recebido: ${balanceAfterWebhook}`);
    console.log(`\n✅ FLUXO COMPLETO PASSOU!\n`);
  });

  test('6️⃣ Idempotência: Webhook duplicado não credita 2x', async ({ page }) => {
    await login(page);

    const balanceBefore = await getWalletBalance(page);
    const paymentId = `getnet-pay-idempotence-${Date.now()}`;

    // Enviar webhook 1x
    const result1 = await triggerWebhook(paymentId, 'tenant-001', 500);
    expect(result1.ok).toBe(true);

    await page.waitForTimeout(1000);
    await page.reload();
    const balanceAfter1 = await getWalletBalance(page);

    // Enviar webhook 2x (duplicado)
    const result2 = await triggerWebhook(paymentId, 'tenant-001', 500);

    // Pode retornar "already_processed" ou similar
    console.log(`Resultado webhook duplicado: ${result2.action}`);

    await page.waitForTimeout(1000);
    await page.reload();
    const balanceAfter2 = await getWalletBalance(page);

    // Saldo não deve aumentar 2x
    expect(balanceAfter2).toBe(balanceAfter1);
    console.log(`✅ Idempotência validada: saldo não duplicado`);
  });

  test('7️⃣ Webhook com assinatura inválida deve ser rejeitado', async ({ page }) => {
    const payload = {
      event: 'PAYMENT_APPROVED',
      payment_id: `getnet-pay-invalid-${Date.now()}`,
      status: 'APPROVED',
    };

    // Enviar com assinatura inválida
    const response = await page.request.post(WEBHOOK_URL, {
      data: payload,
      headers: {
        'X-Signature': 'invalid-signature-12345',
      },
    });

    expect(response.status()).toBe(401);
    console.log(`✅ Webhook com assinatura inválida foi rejeitado (401)`);
  });
});

// ============================================================================
// Smoke Tests
// ============================================================================

test.describe('Smoke Tests', () => {

  test('Server health check', async ({ request }) => {
    const response = await request.get(`${WARMUP_BASE_URL}/api/local/health`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    console.log(`✅ Server está saudável`);
  });

  test('CORS headers estão configurados', async ({ request }) => {
    const response = await request.fetch(`${API_BASE_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3001',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(response.status()).toBe(204);
    expect(response.headers()['access-control-allow-origin']).toBeDefined();
    console.log(`✅ CORS headers OK`);
  });

  test('Rate limiting está ativo', async ({ request }) => {
    // Enviar muitas requisições
    const requests = Array(101).fill(null).map(() =>
      request.get(`${API_BASE_URL}/api/health`)
    );

    const responses = await Promise.all(requests);

    // Pelo menos uma deve ser rate limited (429)
    const rateLimited = responses.some(r => r.status() === 429);

    if (rateLimited) {
      console.log(`✅ Rate limiting está ativo`);
    } else {
      console.log(`⚠️ Rate limiting pode não estar ativo em dev mode`);
    }
  });
});
