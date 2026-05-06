import { describe, expect, test } from '@jest/globals';
import { CommercialAdminService } from '../modules/admin/commercial-admin.service.js';

describe('CommercialAdminService.normalizePayload', () => {
  test('normaliza plano com free tier, destaque e preço anual', () => {
    const row = CommercialAdminService.normalizePayload('plans', {
      name: 'Plano Pro',
      isFreeTier: true,
      isFeatured: true,
      billingPeriod: 'annual',
      priceCents: '9900',
      annualPriceCents: '99000',
      monthlyCredits: '5000',
      maxInstances: '3',
      features: ['Campanhas', 'Aquecimento'],
      gatewayProvider: 'stripe',
    }, 'user-1');

    expect(row.slug).toBe('plano-pro');
    expect(row.is_free_tier).toBe(true);
    expect(row.is_featured).toBe(true);
    expect(row.price_cents).toBe(9900);
    expect(row.annual_price_cents).toBe(99000);
    expect(row.gateway_provider).toBe('stripe');
    expect(row.created_by).toBe('user-1');
  });

  test('normaliza tracking sem expor credencial em campos públicos', () => {
    const row = CommercialAdminService.normalizePayload('tracking-integrations', {
      provider: 'meta_pixel',
      label: 'Meta Pixel Principal',
      pixelId: '123456789',
      token: 'secret-token-1234',
      eventsEnabled: ['lead', 'purchase'],
    });

    expect(row.provider).toBe('meta_pixel');
    expect(row.public_config.pixelId).toBe('123456789');
    expect(row.credential_last4.token).toBe('1234');
    expect(row.credentials_enc).toMatch(/^v1:/);
    expect(row).not.toHaveProperty('token');
  });

  test('bloqueia provider de tracking desconhecido', () => {
    expect(() => CommercialAdminService.normalizePayload('tracking-integrations', {
      provider: 'provider_invalido',
      label: 'Inválido',
    })).toThrow('Provider de tracking inválido');
  });
});
