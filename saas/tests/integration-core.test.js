import { describe, expect, test } from '@jest/globals';
import {
  CaktoPaymentAdapter,
  GetnetPaymentAdapter,
  IntegrationRegistry,
  getProviderCapabilities,
  getProviderDefaultBaseUrl,
  validateProviderCredentials,
} from '../modules/integrations-core/index.js';
import { MemoryIdempotencyStore, WebhookIngestionService, WebhookNormalizerService } from '../modules/webhook-core/index.js';
import { INTERNAL_EVENT_TYPES } from '../modules/integrations-core/contracts.js';

describe('Integration Core', () => {
  test('presets expõem defaults e capabilities sem acoplar billing', () => {
    expect(getProviderDefaultBaseUrl('getnet', 'sandbox')).toBe('https://api-sandbox.getnet.com.br');
    expect(getProviderCapabilities('cakto').paymentMethods).toContain('pix');
    expect(() => validateProviderCredentials('getnet', { clientId: 'a', clientSecret: 'b' })).toThrow('sellerId');
    expect(validateProviderCredentials('getnet', { clientId: 'a', clientSecret: 'b', sellerId: 'c' })).toBe(true);
  });

  test('adapter normaliza webhook de pagamento para evento interno', () => {
    const adapter = new GetnetPaymentAdapter();
    const event = adapter.normalizeWebhook({ transaction_id: 'txn_1', status: 'APPROVED', amount: 1000, metadata: { tenant_id: 't1' } });
    expect(event.provider).toBe('getnet');
    expect(event.type).toBe(INTERNAL_EVENT_TYPES.PAYMENT_APPROVED);
    expect(event.resource).toBe('payment');
    expect(event.externalReference).toBe('txn_1');
    expect(event.tenantId).toBe('t1');
  });

  test('webhook-core deduplica evento normalizado por chave idempotente', async () => {
    const registry = new IntegrationRegistry();
    registry.registerAdapter('cakto', new CaktoPaymentAdapter());

    const normalizer = new WebhookNormalizerService(registry);
    const idempotencyStore = new MemoryIdempotencyStore();
    const ingestion = new WebhookIngestionService({ normalizer, idempotencyStore });

    const payload = { event_id: 'evt_1', status: 'paid', amount: 2500 };
    const first = await ingestion.ingest({ provider: 'cakto', payload });
    const second = await ingestion.ingest({ provider: 'cakto', payload });

    expect(first.accepted).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
  });
});
