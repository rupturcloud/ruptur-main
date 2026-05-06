import { afterEach, describe, expect, test } from '@jest/globals';
import { BillingService } from '../modules/billing/getnet.js';

const ENV_KEYS = [
  'CAKTO_CREDIT_PACKAGES_JSON',
  'CAKTO_CHECKOUT_URL_PACK_1K',
  'BILLING_POC_INSTANT_CREDIT',
  'BILLING_POC_INSTANT_CREDIT_TENANT_IDS',
];

const snapshot = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
});

describe('Billing credit checkout', () => {
  test('resolve link de checkout Cakto por variável direta do pacote', () => {
    process.env.CAKTO_CHECKOUT_URL_PACK_1K = 'https://checkout.cakto.test/pack-1k';

    const billing = new BillingService();

    expect(billing.getCaktoCheckoutUrl('pack-1k')).toBe('https://checkout.cakto.test/pack-1k');
  });

  test('resolve link de checkout Cakto pelo mapa JSON', () => {
    process.env.CAKTO_CREDIT_PACKAGES_JSON = JSON.stringify({
      'pack-5k': { checkoutUrl: 'https://checkout.cakto.test/pack-5k' },
    });

    const billing = new BillingService();

    expect(billing.getCaktoCheckoutUrl('pack-5k')).toBe('https://checkout.cakto.test/pack-5k');
  });

  test('crédito instantâneo PoC só libera tenants explicitamente permitidos', () => {
    process.env.BILLING_POC_INSTANT_CREDIT = 'true';
    process.env.BILLING_POC_INSTANT_CREDIT_TENANT_IDS = 'tenant-1,tenant-2';

    const billing = new BillingService();

    expect(billing.isPocInstantCreditAllowed('tenant-1')).toBe(true);
    expect(billing.isPocInstantCreditAllowed('tenant-3')).toBe(false);
  });
});
