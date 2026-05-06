import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';

const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3001';
const WEBHOOK_SECRET = process.env.GETNET_WEBHOOK_SECRET || 'playwright-getnet-secret';

function signPayload(payload: unknown) {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return { rawBody, signature };
}

test.describe('Santander Getnet — smoke automatizado do gateway', () => {
  test('Gateway SaaS responde health e informa estado do billing', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('ruptur-saas-gateway');
    expect(typeof body.billing).toBe('boolean');
  });

  test('Pacotes de créditos Getnet estão disponíveis sem autenticação', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/billing/packages`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.packages)).toBe(true);
    expect(body.packages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'pack-1k',
          credits: 1000,
          price_cents: 4900,
        }),
      ]),
    );
  });

  test('Checkout Getnet exige autenticação', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/billing/checkout`, {
      data: {
        tenantId: 'tenant-smoke',
        packageId: 'pack-1k',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('Webhook Getnet rejeita assinatura inválida', async ({ request }) => {
    const payload = {
      external_event_id: `invalid-${Date.now()}`,
      event_type: 'payment_status_update',
      data: { transaction_id: `pay-${Date.now()}`, status: 'APPROVED' },
    };

    const response = await request.post(`${API_BASE_URL}/api/webhooks/getnet`, {
      data: payload,
      headers: {
        'x-getnet-signature': 'invalid-signature',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('Webhook Getnet rejeita assinatura ausente quando há segredo configurado', async ({ request }) => {
    const payload = {
      external_event_id: `missing-${Date.now()}`,
      event_type: 'payment_status_update',
      data: { transaction_id: `pay-${Date.now()}`, status: 'APPROVED' },
    };

    const response = await request.post(`${API_BASE_URL}/api/webhooks/getnet`, {
      data: payload,
    });

    expect(response.status()).toBe(401);
  });

  test('Webhook Getnet aceita HMAC válido', async ({ request }) => {
    const payload = {
      external_event_id: `valid-${Date.now()}`,
      event_type: 'payment_status_update',
      data: { transaction_id: `pay-${Date.now()}`, status: 'APPROVED' },
    };
    const { rawBody, signature } = signPayload(payload);

    const response = await request.post(`${API_BASE_URL}/api/webhooks/getnet`, {
      data: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-getnet-signature': signature,
      },
    });

    expect(response.status()).toBe(200);
    await expect(response).toBeOK();
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
