import crypto from 'node:crypto';

const VALID_PROVIDERS = new Set(['getnet', 'cakto']);
const VALID_ENVIRONMENTS = new Set(['sandbox', 'production']);
const VALID_STATUSES = new Set(['active', 'disabled', 'testing']);

const PROVIDER_CAPABILITIES = {
  cakto: {
    paymentMethods: ['pix', 'pix_auto', 'boleto', 'credit_card', 'debit_card', 'picpay', 'nupay', 'applepay', 'googlepay', 'openfinance_nubank'],
    features: ['transparent_checkout', 'hosted_checkout', 'subscriptions', 'tokenization', 'split', 'webhooks', 'refunds', 'chargebacks', 'coupons', 'order_bump', 'upsell', 'affiliate', 'receivables_anticipation', 'interest_pass_through'],
  },
  getnet: {
    paymentMethods: ['pix', 'boleto', 'credit_card', 'debit_card', 'wallets'],
    features: ['transparent_checkout', 'hosted_checkout', 'subscriptions', 'tokenization', 'vault', 'webhooks', 'refunds', 'chargebacks', 'reconciliation', 'receivables_anticipation'],
  },
};

function secretKey() {
  const source = process.env.PAYMENT_GATEWAY_SECRET_KEY
    || process.env.SECRETS_MASTER_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || 'ruptur-dev-payment-gateway-secret';
  return crypto.createHash('sha256').update(source).digest();
}

function encryptSecret(value) {
  if (value === undefined || value === null || value === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function last4(value) {
  const text = String(value || '');
  return text ? text.slice(-4) : null;
}

function normalizeUrl(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\/+$/, '');
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`.replace(/\/+$/, '');
  return raw;
}

function providerDefaults(provider, environment) {
  if (provider === 'cakto') return { baseUrl: 'https://api.cakto.com.br' };
  if (environment === 'production') return { baseUrl: 'https://api.getnet.com.br' };
  return { baseUrl: 'https://api-sandbox.getnet.com.br' };
}

function buildCredentials(provider, payload) {
  if (provider === 'getnet') {
    return {
      clientId: String(payload.clientId || '').trim(),
      clientSecret: String(payload.clientSecret || '').trim(),
      sellerId: String(payload.sellerId || payload.seller_id || '').trim(),
    };
  }

  if (provider === 'cakto') {
    return {
      clientId: String(payload.clientId || '').trim(),
      clientSecret: String(payload.clientSecret || '').trim(),
    };
  }

  return {};
}

function validateCredentials(provider, credentials) {
  const missing = [];
  if (!credentials.clientId) missing.push('clientId');
  if (!credentials.clientSecret) missing.push('clientSecret');
  if (provider === 'getnet' && !credentials.sellerId) missing.push('sellerId');
  if (missing.length) throw new Error(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
}

function normalizeList(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return fallback;
}

function buildPublicConfig(provider, payload, credentials) {
  const defaults = PROVIDER_CAPABILITIES[provider] || { paymentMethods: [], features: [] };
  const incoming = payload.publicConfig || payload.public_config || {};
  const receivables = {
    enabled: payload.receivablesEnabled ?? incoming.receivables?.enabled ?? true,
    anticipationEnabled: payload.anticipationEnabled ?? incoming.receivables?.anticipationEnabled ?? false,
    settlementPlan: payload.settlementPlan || incoming.receivables?.settlementPlan || 'standard',
    pixRelease: payload.pixRelease || incoming.receivables?.pixRelease || null,
    cardRelease: payload.cardRelease || incoming.receivables?.cardRelease || null,
    boletoRelease: payload.boletoRelease || incoming.receivables?.boletoRelease || null,
    passInterestToCustomer: payload.passInterestToCustomer ?? incoming.receivables?.passInterestToCustomer ?? false,
    reservePolicy: payload.reservePolicy || incoming.receivables?.reservePolicy || 'provider_default',
  };

  return {
    ...incoming,
    paymentMethods: normalizeList(payload.paymentMethods || payload.payment_methods || incoming.paymentMethods, defaults.paymentMethods),
    features: normalizeList(payload.features || incoming.features, defaults.features),
    receivables,
    ...(provider === 'getnet' ? { sellerId: credentials.sellerId } : {}),
  };
}

export class PaymentGatewayAccountService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  publicAccount(row) {
    if (!row) return null;
    const { credentials_enc, webhook_secret_enc, ...safe } = row;
    return safe;
  }

  async listAccounts() {
    const { data, error } = await this.supabase
      .from('payment_gateway_accounts')
      .select('id, provider, label, environment, status, base_url, webhook_url, credential_last4, webhook_secret_last4, public_config, metadata, created_by, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createAccount(payload, actorUserId) {
    const provider = String(payload.provider || '').trim().toLowerCase();
    if (!VALID_PROVIDERS.has(provider)) throw new Error('Gateway inválido');

    const environment = String(payload.environment || (payload.sandbox ? 'sandbox' : 'production')).trim().toLowerCase();
    if (!VALID_ENVIRONMENTS.has(environment)) throw new Error('Ambiente inválido');

    const status = String(payload.status || 'testing').trim().toLowerCase();
    if (!VALID_STATUSES.has(status)) throw new Error('Status inválido');

    const defaults = providerDefaults(provider, environment);
    const credentials = buildCredentials(provider, payload);
    validateCredentials(provider, credentials);

    const webhookSecret = String(payload.webhookSecret || payload.webhook_secret || '').trim();
    const publicConfig = buildPublicConfig(provider, payload, credentials);

    const row = {
      provider,
      label: String(payload.label || `${provider.toUpperCase()} ${environment}`).trim(),
      environment,
      status,
      base_url: normalizeUrl(payload.baseUrl || payload.base_url, defaults.baseUrl),
      webhook_url: normalizeUrl(payload.webhookUrl || payload.webhook_url, null),
      credentials_enc: encryptSecret(JSON.stringify(credentials)),
      credential_last4: {
        clientId: last4(credentials.clientId),
        clientSecret: last4(credentials.clientSecret),
        ...(credentials.sellerId ? { sellerId: last4(credentials.sellerId) } : {}),
      },
      webhook_secret_enc: encryptSecret(webhookSecret),
      webhook_secret_last4: last4(webhookSecret),
      public_config: publicConfig,
      metadata: payload.metadata || {},
      created_by: actorUserId,
    };

    const { data, error } = await this.supabase
      .from('payment_gateway_accounts')
      .insert(row)
      .select('id, provider, label, environment, status, base_url, webhook_url, credential_last4, webhook_secret_last4, public_config, metadata, created_by, created_at, updated_at')
      .single();
    if (error) throw error;
    return data;
  }

  async updateStatus(id, status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (!VALID_STATUSES.has(normalized)) throw new Error('Status inválido');
    const { data, error } = await this.supabase
      .from('payment_gateway_accounts')
      .update({ status: normalized, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, provider, label, environment, status, base_url, webhook_url, credential_last4, webhook_secret_last4, public_config, metadata, created_by, created_at, updated_at')
      .single();
    if (error) throw error;
    return data;
  }
}

export default PaymentGatewayAccountService;
