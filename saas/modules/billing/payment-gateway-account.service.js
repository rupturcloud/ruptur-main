import crypto from 'node:crypto';
import {
  getIntegrationPreset,
  getProviderCapabilities,
  getProviderDefaultBaseUrl,
  validateProviderCredentials,
} from '../integrations-core/index.js';

const VALID_PROVIDERS = new Set(['getnet', 'cakto', 'stripe', 'mercado_pago']);
const VALID_ENVIRONMENTS = new Set(['sandbox', 'production']);
const VALID_STATUSES = new Set(['active', 'disabled', 'testing']);

function paymentProviderCapabilities(provider) {
  return getProviderCapabilities(provider);
}

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
  return { baseUrl: getProviderDefaultBaseUrl(provider, environment) };
}

function buildCredentials(provider, payload) {
  const explicit = payload.credentials && typeof payload.credentials === 'object' ? payload.credentials : {};
  const base = {
    ...explicit,
    clientId: String(payload.clientId || explicit.clientId || '').trim(),
    clientSecret: String(payload.clientSecret || explicit.clientSecret || '').trim(),
    sellerId: String(payload.sellerId || payload.seller_id || explicit.sellerId || '').trim(),
    secretKey: String(payload.secretKey || payload.secret_key || explicit.secretKey || '').trim(),
    publishableKey: String(payload.publishableKey || payload.publishable_key || explicit.publishableKey || '').trim(),
    accessToken: String(payload.accessToken || payload.access_token || explicit.accessToken || '').trim(),
    publicKey: String(payload.publicKey || payload.public_key || explicit.publicKey || '').trim(),
  };

  const preset = getIntegrationPreset(provider);
  if (!preset) return base;

  const allowedFields = new Set([...(preset.requiredCredentials || []), ...(preset.optionalCredentials || [])]);
  const credentials = {};
  for (const field of allowedFields) {
    if (field === 'webhookSecret') continue;
    if (base[field]) credentials[field] = base[field];
  }
  return credentials;
}

function validateCredentials(provider, credentials) {
  validateProviderCredentials(provider, credentials);
}

function normalizeList(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return fallback;
}

function buildPublicConfig(provider, payload, credentials) {
  const defaults = paymentProviderCapabilities(provider);
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
    ...(credentials.sellerId ? { sellerId: credentials.sellerId } : {}),
  };
}

function missingTableError(error) {
  const message = String(error?.message || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || message.includes('payment_gateway_accounts');
}

function envFallbackAccounts() {
  const now = new Date().toISOString();
  const accounts = [];

  if (process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET) {
    accounts.push({
      id: 'env:cakto:production',
      provider: 'cakto',
      label: 'Cakto Produção (.env)',
      environment: 'production',
      status: 'active',
      base_url: normalizeUrl(process.env.CAKTO_BASE_URL, 'https://api.cakto.com.br'),
      webhook_url: normalizeUrl(process.env.CAKTO_WEBHOOK_URL, 'https://api.ruptur.cloud/api/webhooks/cakto'),
      credential_last4: {
        clientId: last4(process.env.CAKTO_CLIENT_ID),
        clientSecret: last4(process.env.CAKTO_CLIENT_SECRET),
      },
      webhook_secret_last4: last4(process.env.CAKTO_WEBHOOK_SECRET),
      public_config: buildPublicConfig('cakto', {}, {}),
      metadata: {
        source: 'env',
        note: 'Fallback operacional quando a tabela payment_gateway_accounts ainda não está disponível no Supabase configurado.',
      },
      created_by: null,
      created_at: now,
      updated_at: now,
    });
  }

  if (process.env.GETNET_CLIENT_ID && process.env.GETNET_CLIENT_SECRET && process.env.GETNET_SELLER_ID) {
    accounts.push({
      id: 'env:getnet:production',
      provider: 'getnet',
      label: 'Getnet Produção (.env)',
      environment: process.env.GETNET_SANDBOX === 'true' ? 'sandbox' : 'production',
      status: 'active',
      base_url: normalizeUrl(
        process.env.GETNET_BASE_URL,
        process.env.GETNET_SANDBOX === 'true' ? 'https://api-sandbox.getnet.com.br' : 'https://api.getnet.com.br'
      ),
      webhook_url: normalizeUrl(process.env.GETNET_WEBHOOK_URL, 'https://api.ruptur.cloud/api/webhooks/getnet'),
      credential_last4: {
        clientId: last4(process.env.GETNET_CLIENT_ID),
        clientSecret: last4(process.env.GETNET_CLIENT_SECRET),
        sellerId: last4(process.env.GETNET_SELLER_ID),
      },
      webhook_secret_last4: last4(process.env.GETNET_WEBHOOK_SECRET),
      public_config: buildPublicConfig('getnet', {}, { sellerId: process.env.GETNET_SELLER_ID }),
      metadata: { source: 'env' },
      created_by: null,
      created_at: now,
      updated_at: now,
    });
  }

  return accounts;
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
    if (error) {
      if (missingTableError(error)) return envFallbackAccounts();
      throw error;
    }
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

    const { data: current, error: currentError } = await this.supabase
      .from('payment_gateway_accounts')
      .select('id, provider, environment')
      .eq('id', id)
      .single();
    if (currentError) throw currentError;

    // A migration garante apenas um gateway ativo por provider + environment.
    // Antes de ativar um novo, colocamos os demais em testing para evitar erro
    // de índice único e deixar a ação do painel previsível.
    if (normalized === 'active') {
      const { error: demoteError } = await this.supabase
        .from('payment_gateway_accounts')
        .update({ status: 'testing', updated_at: new Date().toISOString() })
        .eq('provider', current.provider)
        .eq('environment', current.environment)
        .eq('status', 'active')
        .neq('id', id);
      if (demoteError) throw demoteError;
    }

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
