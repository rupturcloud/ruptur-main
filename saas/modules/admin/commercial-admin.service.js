import crypto from 'node:crypto';

const RESOURCE_MAP = {
  plans: {
    table: 'commercial_plans',
    order: ['display_order', { ascending: true }],
    statuses: ['active', 'draft', 'paused', 'archived'],
  },
  offers: {
    table: 'commercial_offers',
    order: ['created_at', { ascending: false }],
    statuses: ['active', 'draft', 'paused', 'archived'],
  },
  packages: {
    table: 'commercial_credit_packages',
    order: ['display_order', { ascending: true }],
    statuses: ['active', 'draft', 'paused', 'archived'],
  },
  'pricing-rules': {
    table: 'commercial_pricing_rules',
    order: ['created_at', { ascending: false }],
    statuses: ['active', 'draft', 'paused', 'archived'],
  },
  'tracking-integrations': {
    table: 'tracking_integrations',
    order: ['created_at', { ascending: false }],
    statuses: ['active', 'testing', 'disabled'],
  },
  'support-tickets': {
    table: 'support_tickets',
    order: ['created_at', { ascending: false }],
    statuses: ['open', 'pending', 'in_progress', 'resolved', 'closed'],
  },
  'support-ticket-events': {
    table: 'support_ticket_events',
    order: ['created_at', { ascending: false }],
    statuses: [],
  },
};

const CATALOG_RESOURCES = ['plans', 'offers', 'packages', 'pricing-rules', 'tracking-integrations', 'support-tickets'];
const TRACKING_PROVIDERS = new Set(['utmify', 'google_analytics', 'google_tag_manager', 'meta_pixel', 'google_ads', 'custom']);
const GATEWAY_PROVIDERS = new Set(['cakto', 'getnet', 'stripe', 'mercado_pago', 'manual']);

function secretKey() {
  const source = process.env.TRACKING_SECRET_KEY
    || process.env.SECRETS_MASTER_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || 'ruptur-dev-tracking-secret';
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

function asString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'sim', 'on'].includes(value.toLowerCase());
  if (typeof value === 'number') return value === 1;
  return fallback;
}

function asJson(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function slugify(value, fallback = 'item') {
  const base = asString(value, fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || fallback;
}

function missingCommercialTable(error) {
  const message = String(error?.message || '');
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || message.includes('commercial_')
    || message.includes('tracking_integrations')
    || message.includes('support_tickets');
}

function resolveResource(resource) {
  const key = String(resource || '').trim();
  const config = RESOURCE_MAP[key];
  if (!config) throw new Error('Recurso administrativo inválido');
  return { key, ...config };
}

function normalizeGatewayProvider(value) {
  const provider = asString(value || 'manual', 'manual').toLowerCase();
  if (!GATEWAY_PROVIDERS.has(provider)) throw new Error('Gateway vinculado inválido');
  return provider;
}

export class CommercialAdminService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  static normalizePayload(resource, payload = {}, actorUserId = null) {
    const { key } = resolveResource(resource);

    if (key === 'plans') {
      const name = asString(payload.name, 'Novo plano');
      return {
        slug: slugify(payload.slug || name, 'plano'),
        name,
        description: asString(payload.description, null),
        status: asString(payload.status, 'draft'),
        is_free_tier: asBool(payload.isFreeTier ?? payload.is_free_tier, false),
        is_featured: asBool(payload.isFeatured ?? payload.is_featured, false),
        billing_period: asString(payload.billingPeriod ?? payload.billing_period, 'monthly'),
        price_cents: asNumber(payload.priceCents ?? payload.price_cents, 0),
        annual_price_cents: payload.annualPriceCents || payload.annual_price_cents ? asNumber(payload.annualPriceCents ?? payload.annual_price_cents, 0) : null,
        currency: asString(payload.currency, 'BRL').toUpperCase(),
        monthly_credits: asNumber(payload.monthlyCredits ?? payload.monthly_credits, 0),
        credit_unit_price_cents: payload.creditUnitPriceCents || payload.credit_unit_price_cents ? asNumber(payload.creditUnitPriceCents ?? payload.credit_unit_price_cents, 0) : null,
        max_instances: asNumber(payload.maxInstances ?? payload.max_instances, 1),
        trial_days: asNumber(payload.trialDays ?? payload.trial_days, 0),
        features: asJson(payload.features, []),
        limits: asJson(payload.limits, {}),
        display_order: asNumber(payload.displayOrder ?? payload.display_order, 100),
        gateway_provider: normalizeGatewayProvider(payload.gatewayProvider ?? payload.gateway_provider),
        external_price_refs: asJson(payload.externalPriceRefs ?? payload.external_price_refs, {}),
        metadata: asJson(payload.metadata, {}),
        ...(actorUserId ? { created_by: actorUserId } : {}),
      };
    }

    if (key === 'offers') {
      const name = asString(payload.name, 'Nova oferta');
      return {
        slug: slugify(payload.slug || name, 'oferta'),
        name,
        description: asString(payload.description, null),
        status: asString(payload.status, 'draft'),
        is_featured: asBool(payload.isFeatured ?? payload.is_featured, false),
        starts_at: payload.startsAt || payload.starts_at || null,
        ends_at: payload.endsAt || payload.ends_at || null,
        target_audience: asString(payload.targetAudience ?? payload.target_audience, 'all'),
        discount_type: asString(payload.discountType ?? payload.discount_type, 'none'),
        discount_value: asNumber(payload.discountValue ?? payload.discount_value, 0),
        plans: asJson(payload.plans, []),
        packages: asJson(payload.packages, []),
        metadata: asJson(payload.metadata, {}),
        ...(actorUserId ? { created_by: actorUserId } : {}),
      };
    }

    if (key === 'packages') {
      const name = asString(payload.name, 'Novo pacote');
      return {
        slug: slugify(payload.slug || name, 'pacote'),
        name,
        description: asString(payload.description, null),
        status: asString(payload.status, 'draft'),
        is_featured: asBool(payload.isFeatured ?? payload.is_featured, false),
        credits_amount: asNumber(payload.creditsAmount ?? payload.credits_amount, 0),
        bonus_credits: asNumber(payload.bonusCredits ?? payload.bonus_credits, 0),
        price_cents: asNumber(payload.priceCents ?? payload.price_cents, 0),
        currency: asString(payload.currency, 'BRL').toUpperCase(),
        credit_unit_price_cents: payload.creditUnitPriceCents || payload.credit_unit_price_cents ? asNumber(payload.creditUnitPriceCents ?? payload.credit_unit_price_cents, 0) : null,
        validity_days: payload.validityDays || payload.validity_days ? asNumber(payload.validityDays ?? payload.validity_days, 0) : null,
        gateway_provider: normalizeGatewayProvider(payload.gatewayProvider ?? payload.gateway_provider),
        external_price_refs: asJson(payload.externalPriceRefs ?? payload.external_price_refs, {}),
        metadata: asJson(payload.metadata, {}),
        display_order: asNumber(payload.displayOrder ?? payload.display_order, 100),
        ...(actorUserId ? { created_by: actorUserId } : {}),
      };
    }

    if (key === 'pricing-rules') {
      return {
        name: asString(payload.name, 'Regra de preço'),
        scope: asString(payload.scope, 'global'),
        metric: asString(payload.metric, 'message'),
        unit: asString(payload.unit, 'unit'),
        unit_price_cents: asNumber(payload.unitPriceCents ?? payload.unit_price_cents, 0),
        currency: asString(payload.currency, 'BRL').toUpperCase(),
        status: asString(payload.status, 'active'),
        applies_to_plans: asJson(payload.appliesToPlans ?? payload.applies_to_plans, []),
        metadata: asJson(payload.metadata, {}),
        ...(actorUserId ? { created_by: actorUserId } : {}),
      };
    }

    if (key === 'tracking-integrations') {
      const provider = asString(payload.provider, 'custom').toLowerCase();
      if (!TRACKING_PROVIDERS.has(provider)) throw new Error('Provider de tracking inválido');
      const credentials = payload.credentials && typeof payload.credentials === 'object'
        ? payload.credentials
        : {
          apiKey: payload.apiKey || payload.api_key || '',
          token: payload.token || '',
          secret: payload.secret || '',
        };
      const cleanCredentials = Object.fromEntries(Object.entries(credentials).filter(([, value]) => value));
      const credentialLast4 = Object.fromEntries(Object.entries(cleanCredentials).map(([field, value]) => [field, last4(value)]));
      const publicConfig = {
        ...asJson(payload.publicConfig ?? payload.public_config, {}),
        measurementId: payload.measurementId || payload.measurement_id || undefined,
        containerId: payload.containerId || payload.container_id || undefined,
        pixelId: payload.pixelId || payload.pixel_id || undefined,
        tagId: payload.tagId || payload.tag_id || undefined,
      };
      Object.keys(publicConfig).forEach((field) => publicConfig[field] === undefined && delete publicConfig[field]);
      return {
        provider,
        label: asString(payload.label, provider),
        status: asString(payload.status, 'testing'),
        public_config: publicConfig,
        credentials_enc: Object.keys(cleanCredentials).length ? encryptSecret(JSON.stringify(cleanCredentials)) : null,
        credential_last4: credentialLast4,
        events_enabled: asJson(payload.eventsEnabled ?? payload.events_enabled, ['lead', 'purchase']),
        metadata: asJson(payload.metadata, {}),
        ...(actorUserId ? { created_by: actorUserId } : {}),
      };
    }

    if (key === 'support-tickets') {
      return {
        tenant_id: payload.tenantId || payload.tenant_id || null,
        requester_user_id: payload.requesterUserId || payload.requester_user_id || actorUserId || null,
        subject: asString(payload.subject, 'Ticket sem assunto'),
        description: asString(payload.description, null),
        status: asString(payload.status, 'open'),
        priority: asString(payload.priority, 'normal'),
        category: asString(payload.category, 'general'),
        assigned_to: payload.assignedTo || payload.assigned_to || null,
        metadata: asJson(payload.metadata, {}),
        ...(actorUserId ? { created_by: actorUserId } : {}),
      };
    }

    if (key === 'support-ticket-events') {
      return {
        ticket_id: payload.ticketId || payload.ticket_id,
        actor_user_id: payload.actorUserId || payload.actor_user_id || actorUserId || null,
        event_type: asString(payload.eventType ?? payload.event_type, 'comment'),
        message: asString(payload.message, null),
        metadata: asJson(payload.metadata, {}),
      };
    }

    throw new Error('Recurso administrativo inválido');
  }

  safeRow(row) {
    if (!row) return null;
    const { credentials_enc, ...safe } = row;
    return safe;
  }

  async listResource(resource) {
    const config = resolveResource(resource);
    const [column, options] = config.order;
    const { data, error } = await this.supabase
      .from(config.table)
      .select('*')
      .order(column, options);
    if (error) {
      if (missingCommercialTable(error)) return { items: [], migrationPending: true };
      throw error;
    }
    return { items: (data || []).map((row) => this.safeRow(row)), migrationPending: false };
  }

  async getCatalog() {
    const entries = await Promise.all(CATALOG_RESOURCES.map(async (resource) => [resource, await this.listResource(resource)]));
    return Object.fromEntries(entries);
  }

  async createResource(resource, payload, actorUserId) {
    const config = resolveResource(resource);
    const row = CommercialAdminService.normalizePayload(resource, payload, actorUserId);
    const { data, error } = await this.supabase
      .from(config.table)
      .insert(row)
      .select('*')
      .single();
    if (error) {
      if (missingCommercialTable(error)) throw new Error('Migration 015 pendente: aplique migrations/015_commercial_admin_tracking_support.sql antes de cadastrar este recurso.');
      throw error;
    }
    return this.safeRow(data);
  }

  async updateResource(resource, id, payload) {
    const config = resolveResource(resource);
    const row = CommercialAdminService.normalizePayload(resource, payload, null);
    delete row.created_by;
    const { data, error } = await this.supabase
      .from(config.table)
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (missingCommercialTable(error)) throw new Error('Migration 015 pendente: aplique migrations/015_commercial_admin_tracking_support.sql antes de editar este recurso.');
      throw error;
    }
    return this.safeRow(data);
  }

  async updateStatus(resource, id, status) {
    const config = resolveResource(resource);
    if (!config.statuses.includes(status)) throw new Error('Status inválido para este recurso');
    const patch = { status };
    if (config.key === 'support-tickets' && status === 'resolved') patch.resolved_at = new Date().toISOString();
    if (config.key === 'support-tickets' && status === 'closed') patch.closed_at = new Date().toISOString();
    const { data, error } = await this.supabase
      .from(config.table)
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (missingCommercialTable(error)) throw new Error('Migration 015 pendente: aplique migrations/015_commercial_admin_tracking_support.sql antes de alterar status.');
      throw error;
    }
    return this.safeRow(data);
  }
}

export { RESOURCE_MAP, missingCommercialTable };
