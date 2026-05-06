/**
 * Presets de integrações conhecidas.
 *
 * Este arquivo é a fonte operacional para defaults, campos obrigatórios e
 * capacidades públicas. Os motores de Billing/Wallet não devem depender de
 * nomes específicos de providers; eles consomem eventos internos normalizados.
 */

export const INTEGRATION_KINDS = Object.freeze({
  PAYMENT: 'payment',
  MARKETPLACE: 'marketplace',
  MESSAGING: 'messaging',
  AI: 'ai',
  CRM: 'crm',
});

export const INTEGRATION_PROVIDER_PRESETS = Object.freeze({
  cakto: {
    key: 'cakto',
    label: 'Cakto',
    kind: INTEGRATION_KINDS.PAYMENT,
    environments: ['production'],
    defaultEnvironment: 'production',
    defaultBaseUrls: {
      production: 'https://api.cakto.com.br',
    },
    requiredCredentials: ['clientId', 'clientSecret'],
    optionalCredentials: ['webhookSecret'],
    paymentMethods: ['pix', 'pix_auto', 'boleto', 'credit_card', 'debit_card', 'picpay', 'nupay', 'applepay', 'googlepay', 'openfinance_nubank'],
    features: ['transparent_checkout', 'hosted_checkout', 'subscriptions', 'tokenization', 'split', 'webhooks', 'refunds', 'chargebacks', 'coupons', 'order_bump', 'upsell', 'affiliate', 'receivables_anticipation', 'interest_pass_through'],
    webhook: {
      defaultPath: '/api/webhooks/cakto',
      signature: 'provider_specific',
      allowUnsignedInSandbox: false,
    },
  },

  getnet: {
    key: 'getnet',
    label: 'Getnet',
    kind: INTEGRATION_KINDS.PAYMENT,
    environments: ['sandbox', 'production'],
    defaultEnvironment: 'sandbox',
    defaultBaseUrls: {
      sandbox: 'https://api-sandbox.getnet.com.br',
      production: 'https://api.getnet.com.br',
    },
    requiredCredentials: ['clientId', 'clientSecret', 'sellerId'],
    optionalCredentials: ['webhookSecret'],
    paymentMethods: ['pix', 'boleto', 'credit_card', 'debit_card', 'wallets'],
    features: ['transparent_checkout', 'hosted_checkout', 'subscriptions', 'tokenization', 'vault', 'webhooks', 'refunds', 'chargebacks', 'reconciliation', 'receivables_anticipation'],
    webhook: {
      defaultPath: '/api/webhooks/getnet',
      signature: 'hmac_or_provider_specific',
      allowUnsignedInSandbox: true,
    },
  },

  stripe: {
    key: 'stripe',
    label: 'Stripe',
    kind: INTEGRATION_KINDS.PAYMENT,
    environments: ['sandbox', 'production'],
    defaultEnvironment: 'sandbox',
    defaultBaseUrls: {
      sandbox: 'https://api.stripe.com',
      production: 'https://api.stripe.com',
    },
    requiredCredentials: ['secretKey'],
    optionalCredentials: ['publishableKey', 'webhookSecret'],
    paymentMethods: ['credit_card', 'debit_card', 'wallets', 'boleto', 'pix'],
    features: ['hosted_checkout', 'payment_intents', 'subscriptions', 'tokenization', 'webhooks', 'refunds', 'chargebacks', 'coupons', 'invoices'],
    webhook: {
      defaultPath: '/api/webhooks/stripe',
      signature: 'stripe_signature',
      allowUnsignedInSandbox: false,
    },
  },

  mercado_pago: {
    key: 'mercado_pago',
    label: 'Mercado Pago',
    kind: INTEGRATION_KINDS.PAYMENT,
    environments: ['sandbox', 'production'],
    defaultEnvironment: 'sandbox',
    defaultBaseUrls: {
      sandbox: 'https://api.mercadopago.com',
      production: 'https://api.mercadopago.com',
    },
    requiredCredentials: ['accessToken'],
    optionalCredentials: ['publicKey', 'webhookSecret'],
    paymentMethods: ['pix', 'boleto', 'credit_card', 'debit_card', 'wallets'],
    features: ['hosted_checkout', 'transparent_checkout', 'subscriptions', 'webhooks', 'refunds', 'chargebacks', 'marketplace_split'],
    webhook: {
      defaultPath: '/api/webhooks/mercado-pago',
      signature: 'provider_specific',
      allowUnsignedInSandbox: false,
    },
  },

  mercado_livre: {
    key: 'mercado_livre',
    label: 'Mercado Livre',
    kind: INTEGRATION_KINDS.MARKETPLACE,
    environments: ['production'],
    defaultEnvironment: 'production',
    defaultBaseUrls: {
      production: 'https://api.mercadolibre.com',
    },
    requiredCredentials: ['clientId', 'clientSecret', 'refreshToken'],
    optionalCredentials: ['webhookSecret'],
    resources: ['orders', 'payments', 'shipments', 'questions', 'messages', 'claims', 'catalog'],
    features: ['oauth', 'webhooks', 'order_sync', 'stock_sync', 'message_sync', 'reconciliation'],
    webhook: {
      defaultPath: '/api/webhooks/mercado-livre',
      signature: 'provider_specific',
      allowUnsignedInSandbox: false,
    },
  },

  uazapi: {
    key: 'uazapi',
    label: 'UAZAPI',
    kind: INTEGRATION_KINDS.MESSAGING,
    environments: ['sandbox', 'production'],
    defaultEnvironment: 'production',
    defaultBaseUrls: {
      sandbox: 'https://free.uazapi.com',
      production: 'https://free.uazapi.com',
    },
    requiredCredentials: ['adminToken'],
    optionalCredentials: ['instanceToken'],
    resources: ['instances', 'messages', 'contacts', 'groups', 'webhooks'],
    features: ['instance_management', 'send_text', 'send_media', 'send_audio', 'presence', 'webhooks', 'contacts', 'groups'],
    webhook: {
      defaultPath: '/api/webhooks/uazapi',
      signature: 'token_or_provider_specific',
      allowUnsignedInSandbox: false,
    },
  },
});

export function normalizeProviderKey(provider) {
  return String(provider || '').trim().toLowerCase().replace(/-/g, '_');
}

export function getIntegrationPreset(provider) {
  return INTEGRATION_PROVIDER_PRESETS[normalizeProviderKey(provider)] || null;
}

export function listIntegrationPresets({ kind } = {}) {
  return Object.values(INTEGRATION_PROVIDER_PRESETS)
    .filter((preset) => !kind || preset.kind === kind)
    .map((preset) => ({ ...preset }));
}

export function getProviderDefaultBaseUrl(provider, environment) {
  const preset = getIntegrationPreset(provider);
  if (!preset) return null;
  const env = environment || preset.defaultEnvironment;
  return preset.defaultBaseUrls?.[env] || preset.defaultBaseUrls?.[preset.defaultEnvironment] || null;
}

export function getProviderCapabilities(provider) {
  const preset = getIntegrationPreset(provider);
  if (!preset) return { paymentMethods: [], features: [], resources: [] };
  return {
    paymentMethods: preset.paymentMethods || [],
    features: preset.features || [],
    resources: preset.resources || [],
  };
}

export function validateProviderCredentials(provider, credentials = {}) {
  const preset = getIntegrationPreset(provider);
  if (!preset) throw new Error(`Provider não suportado: ${provider}`);

  const missing = (preset.requiredCredentials || []).filter((field) => !String(credentials[field] || '').trim());
  if (missing.length) {
    throw new Error(`Campos obrigatórios ausentes para ${preset.label}: ${missing.join(', ')}`);
  }

  return true;
}
