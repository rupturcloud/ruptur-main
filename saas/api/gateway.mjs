/**
 * API Gateway — Ruptur SaaS
 *
 * Servidor dedicado para o client-area (saas.ruptur.cloud)
 * Roda na porta 3001 (ou PORT_API), separado do Warmup Manager (8787).
 *
 * Responsabilidades:
 * - Servir a SPA (dist-client)
 * - Rotas de billing (Getnet / Santander)
 * - Provisioning de tenants
 * - Proxy para API do Warmup Manager (quando necessário)
 * - Autenticação via Supabase JWT
 *
 * Uso:  node api/gateway.mjs
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { BillingService } from '../modules/billing/getnet.js';
import { WebhookService } from '../modules/billing/webhook.service.js';
import { MetricsService } from '../modules/billing/metrics.service.js';
import { AuditService } from '../modules/billing/audit.service.js';
import * as billingRoutes from './routes-billing.mjs';
import TenantService from '../modules/tenants/service.js';
import { extractAndValidateTenantId } from '../middleware/tenant-security.mjs';
import {
  BillingSchemas,
  ReferralSchemas,
  TenantSchemas,
  WalletSchemas,
  PlatformAdminSchemas,
} from '../middleware/validation.mjs';
import { PlatformAdminService } from '../modules/superadmin/platform-admin.service.js';
import { UazapiAccountService } from '../modules/providers/uazapi-account.service.js';
import { PaymentGatewayAccountService } from '../modules/billing/payment-gateway-account.service.js';

// --- Config ---
const HOST = process.env.API_HOST || '0.0.0.0';
const PORT = Number(process.env.PORT_API || process.env.PORT || 3001);
const WARMUP_URL = process.env.WARMUP_RUNTIME_URL || 'http://localhost:8787';
const DIST_DIR = path.resolve(process.cwd(), 'dist-client');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
};

// --- Supabase (service_role para backend) ---
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = supabaseUrl && (supabaseServiceKey || supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
  : null;

// --- Services ---
const billing = new BillingService({
  clientId: process.env.GETNET_CLIENT_ID,
  clientSecret: process.env.GETNET_CLIENT_SECRET,
  sellerId: process.env.GETNET_SELLER_ID,
  sandbox: process.env.GETNET_SANDBOX !== 'false',
  supabase,
});

const webhookService = supabase ? new WebhookService(supabase, null) : null;
const metricsService = supabase ? new MetricsService(supabase, null) : null;
const auditService = supabase ? new AuditService(supabase) : null;

const tenantService = supabase ? new TenantService(supabase) : null;
const platformAdminService = supabase ? new PlatformAdminService(supabase, null) : null;
const uazapiAccountService = supabase ? new UazapiAccountService(supabase) : null;
const paymentGatewayAccountService = supabase ? new PaymentGatewayAccountService(supabase) : null;

// --- Rate Limiter (em memória, por IP) ---
const RATE_LIMIT = {
  windowMs: 60_000,   // 1 minuto
  maxRequests: 120,   // 120 req/min por IP
};
const _hits = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const record = _hits.get(ip);
  if (!record || now - record.start > RATE_LIMIT.windowMs) {
    _hits.set(ip, { start: now, count: 1 });
    return true;
  }
  record.count++;
  if (record.count > RATE_LIMIT.maxRequests) return false;
  return true;
}

// Limpar entries a cada 5 minutos para evitar memory leak
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT.windowMs * 2;
  for (const [ip, rec] of _hits) {
    if (rec.start < cutoff) _hits.delete(ip);
  }
}, 300_000);

// --- Origens CORS permitidas (WHITELIST RIGOROSA) ---
const ALLOWED_ORIGINS = new Set([
  'https://ruptur.cloud',
  'https://www.ruptur.cloud',
  'https://app.ruptur.cloud', // SaaS principal
  'https://saas.ruptur.cloud',
  ...(process.env.NODE_ENV === 'development' ? [
    'http://localhost:5173',   // Vite dev
    'http://localhost:3000',
    'http://localhost:3001',
  ] : []),
]);

/**
 * CORS: Rejeitar se origin não está na whitelist
 * NUNCA usar "*" em produção
 */
function corsOrigin(req) {
  const origin = req.headers.origin;

  // Requisições same-origin, health checks, curl e proxies internos normalmente
  // não enviam Origin. Isso não é tentativa de CORS e não deve gerar alerta.
  if (!origin) return null;

  if (!ALLOWED_ORIGINS.has(origin)) {
    // Rejeitar cross-origin não autorizado
    log('warn', 'CORS: Origin não autorizado', { origin, ip: req.socket.remoteAddress });
    return null; // Não enviar Access-Control-Allow-Origin
  }

  return origin;
}

// --- Structured Logger ---
function log(level, msg, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// --- Helpers ---
const MAX_BODY_SIZE = 1_048_576; // 1MB limite de body

function json(res, status, data, req) {
  const origin = req ? corsOrigin(req) : null;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  // Apenas enviar CORS headers se origin está na whitelist
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
  }

  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Body excede limite de 1MB'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * Middleware: extrair e validar JWT do Supabase
 */
async function extractUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  if (!supabase) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

async function requirePlatformAdmin(req, res) {
  const user = await extractUser(req);
  if (!user) {
    json(res, 401, { error: 'Não autenticado' }, req);
    return null;
  }

  if (!platformAdminService) {
    json(res, 503, { error: 'Supabase não configurado' }, req);
    return null;
  }

  const isPlatformAdmin = await platformAdminService.isPlatformAdmin(user.id);
  if (!isPlatformAdmin) {
    json(res, 403, { error: 'Acesso negado: requer permissão de superadmin' }, req);
    return null;
  }

  return user;
}


function providerMigrationError(e) {
  const message = String(e?.message || '');
  if (e?.code === '42P01' || e?.code === '42703' || e?.code === 'PGRST205' || message.includes('provider_accounts') || message.includes('api_leases')) {
    return 'Migration 012 pendente: execute migrations/012_provider_accounts_and_leases.sql no Supabase antes de gerenciar APIs UAZAPI.';
  }
  return null;
}

function paymentGatewayMigrationError(e) {
  const message = String(e?.message || '');
  if (e?.code === '42P01' || e?.code === '42703' || e?.code === 'PGRST205' || message.includes('payment_gateway_accounts')) {
    return 'Migration 013 pendente: execute migrations/013_payment_gateway_accounts.sql no Supabase antes de gerenciar gateways de pagamento.';
  }
  return null;
}

async function listAdminClients(search = '') {
  let query = supabase
    .from('tenants')
    .select('id, slug, name, email, plan, status, credits_balance, max_instances, created_at, users(id,email,role)')
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  const { data: tenants, error } = await query;
  if (error) throw error;

  const tenantIds = (tenants || []).map((tenant) => tenant.id);
  if (tenantIds.length === 0) return [];

  const { data: providers } = await supabase
    .from('tenant_providers')
    .select('id, tenant_id, provider, is_active')
    .in('tenant_id', tenantIds);

  const providerIds = (providers || []).map((provider) => provider.id);
  const { data: instances } = providerIds.length
    ? await supabase
      .from('instance_registry')
      .select('id, tenant_provider_id, status, instance_number, instance_name, platform, last_seen_at')
      .in('tenant_provider_id', providerIds)
    : { data: [] };

  const providersByTenant = new Map();
  for (const provider of providers || []) {
    if (!providersByTenant.has(provider.tenant_id)) providersByTenant.set(provider.tenant_id, []);
    providersByTenant.get(provider.tenant_id).push(provider);
  }

  const instancesByProvider = new Map();
  for (const instance of instances || []) {
    if (!instancesByProvider.has(instance.tenant_provider_id)) instancesByProvider.set(instance.tenant_provider_id, []);
    instancesByProvider.get(instance.tenant_provider_id).push(instance);
  }

  return (tenants || []).map((tenant) => {
    const tenantProviders = providersByTenant.get(tenant.id) || [];
    const tenantInstances = tenantProviders.flatMap((provider) => instancesByProvider.get(provider.id) || []);
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      email: tenant.email,
      plan: tenant.plan,
      status: tenant.status,
      balance: tenant.credits_balance || 0,
      maxInstances: tenant.max_instances || 0,
      instances: tenantInstances.length,
      connectedInstances: tenantInstances.filter((instance) => instance.status === 'connected').length,
      users: tenant.users || [],
      createdAt: tenant.created_at,
    };
  });
}

/**
 * Servir arquivo estático do dist-client
 */
async function serveStatic(res, pathname, req) {
  let filePath = path.join(DIST_DIR, pathname);

  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch {
    // SPA fallback: qualquer rota não-estática → index.html
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!existsSync(filePath)) {
    return json(res, 404, { error: 'Not found' }, req);
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
}

// --- Request Handler ---
async function handler(req, res) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

  // Redirecionar ruptur.cloud (sem www) para www.ruptur.cloud
  const host = (req.headers.host || '').toLowerCase();
  if (host === 'ruptur.cloud' || host.startsWith('ruptur.cloud:')) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const newUrl = `${protocol}://www.ruptur.cloud${req.url}`;
    res.writeHead(301, { 'Location': newUrl });
    return res.end();
  }

  // Rate Limiter — bloqueia antes de qualquer processamento
  if (!rateLimit(clientIp)) {
    log('warn', 'Rate limit excedido', { ip: clientIp });
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
    return res.end(JSON.stringify({ error: 'Too many requests' }));
  }

  // CORS Preflight — rejeitar se não autorizado
  if (req.method === 'OPTIONS') {
    const origin = corsOrigin(req);

    if (!origin) {
      // Origin não está na whitelist
      log('warn', 'CORS Preflight rejeitado', {
        origin: req.headers.origin,
        ip: clientIp,
      });
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Origin not allowed' }));
    }

    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    });
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  // ================================================================
  //  API Routes
  // ================================================================

  // --- Health ---
  if (pathname === '/api/health') {
    return json(res, 200, {
      ok: true,
      service: 'ruptur-saas-gateway',
      port: PORT,
      supabase: !!supabase,
      billing: !!billing.clientId,
      rateLimitClients: _hits.size,
      timestamp: new Date().toISOString(),
    }, req);
  }

  if (pathname === '/api/billing/plans' && req.method === 'GET') {
    try {
      const plans = await billing.getPlans();
      return json(res, 200, { plans }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Billing: Listar pacotes de créditos ---
  if (pathname === '/api/billing/packages' && req.method === 'GET') {
    return json(res, 200, { packages: billing.getCreditPackages() }, req);
  }

  if (pathname === '/api/billing/checkout' && req.method === 'POST') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);

    // SECURITY: Validar schema do payload
    const validation = await BillingSchemas.checkout.safeParseAsync(await parseBody(req));
    if (!validation.success) {
      log('warn', 'Validação de payload falhou', {
        endpoint: '/api/billing/checkout',
        errors: validation.error.errors,
        user: user.id,
        ip: clientIp,
      });
      return json(res, 400, {
        error: 'Validação falhou',
        details: validation.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, req);
    }

    const { tenantId, packageId } = validation.data;

    // SECURITY: Validar que o usuário tem acesso ao tenant
    const validatedTenantId = await extractAndValidateTenantId(url, req, user, supabase);
    if (!validatedTenantId || validatedTenantId !== tenantId) {
      log('warn', 'Tentativa de acesso não autorizado a tenant', {
        user: user.id,
        requestedTenant: tenantId,
        ip: clientIp,
      });
      return json(res, 403, { error: 'Acesso negado ao tenant' }, req);
    }

    try {
      const result = await billing.createCheckoutPreference(tenantId, packageId);
      return json(res, 200, result, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  if (pathname === '/api/billing/subscribe' && req.method === 'POST') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);

    // SECURITY: Validar schema do payload
    const validation = await BillingSchemas.subscribe.safeParseAsync(await parseBody(req));
    if (!validation.success) {
      log('warn', 'Validação de payload falhou', {
        endpoint: '/api/billing/subscribe',
        errors: validation.error.errors,
        user: user.id,
        ip: clientIp,
      });
      return json(res, 400, {
        error: 'Validação falhou',
        details: validation.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, req);
    }

    const { tenantId, planId } = validation.data;

    // SECURITY: Validar que o usuário tem acesso ao tenant
    const validatedTenantId = await extractAndValidateTenantId(url, req, user, supabase);
    if (!validatedTenantId || validatedTenantId !== tenantId) {
      log('warn', 'Tentativa de acesso não autorizado a tenant', {
        user: user.id,
        requestedTenant: tenantId,
        ip: clientIp,
      });
      return json(res, 403, { error: 'Acesso negado ao tenant' }, req);
    }

    try {
      const result = await billing.createSubscription(tenantId, planId);
      return json(res, 200, result, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Referral: Obter/gerar link de referral ---
  if (pathname === '/api/referrals/my-link' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    if (!supabase) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      // SECURITY: Validar tenantId de forma segura
      const requestedTenantId = url.searchParams.get('tenant_id') || url.searchParams.get('tenantId');
      const tenantId = await extractAndValidateTenantId(url, req, user, supabase);

      if (!tenantId) {
        log('warn', 'Tentativa de acesso não autorizado a tenant (referral)', {
          user: user.id,
          requestedTenant: requestedTenantId,
          ip: clientIp,
        });
        return json(res, 403, { error: 'Acesso negado ao tenant' }, req);
      }

      // Buscar link existente ativo
      let { data: refLink } = await supabase
        .from('referral_links')
        .select('id, ref_code, created_at')
        .eq('referrer_tenant_id', tenantId)
        .eq('status', 'active')
        .single();

      // Se não existe, gerar novo
      if (!refLink) {
        const { randomBytes } = await import('node:crypto');
        const random = randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
        const refCode = `${tenantId.slice(0, 8)}_${random}`;

        const { data: newLink } = await supabase
          .from('referral_links')
          .insert({
            referrer_tenant_id: tenantId,
            ref_code: refCode,
            status: 'active',
          })
          .select('id, ref_code, created_at')
          .single();
        refLink = newLink;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'https://app.ruptur.cloud';
      return json(res, 200, {
        refCode: refLink.ref_code,
        link: `${frontendUrl}/ref/${refLink.ref_code}`,
        createdAt: refLink.created_at,
      }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Referral: Resumo de indicações ---
  if (pathname === '/api/referrals/summary' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    if (!supabase) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      // SECURITY: Validar tenantId de forma segura
      const requestedTenantId = url.searchParams.get('tenant_id') || url.searchParams.get('tenantId');
      const tenantId = await extractAndValidateTenantId(url, req, user, supabase);

      if (!tenantId) {
        log('warn', 'Tentativa de acesso não autorizado a tenant (referral summary)', {
          user: user.id,
          requestedTenant: requestedTenantId,
          ip: clientIp,
        });
        return json(res, 403, { error: 'Acesso negado ao tenant' }, req);
      }

      const { data: summary } = await supabase
        .from('referral_summary')
        .select('*')
        .eq('referrer_tenant_id', tenantId)
        .single();

      return json(res, 200, summary || {
        referrer_tenant_id: tenantId,
        total_referrals: 0,
        active_referrals: 0,
        paying_referrals: 0,
        total_commission_cents: 0,
        commission_30d_cents: 0,
        last_commission_date: null,
      }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Webhooks: Processar eventos da adquirente ---
  if (pathname === '/api/webhooks/getnet' && req.method === 'POST') {
    billingRoutes.handleWebhookGetnet(
      req, res, webhookService, auditService, pathname, json
    );
    return;
  }

  // --- Webhooks: Histórico ---
  if (pathname === '/api/billing/webhooks' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    const tenantId = await extractAndValidateTenantId(url, req, user, supabase);
    if (!tenantId) return json(res, 403, { error: 'Acesso negado ao tenant' }, req);
    return billingRoutes.getWebhookHistory(req, res, webhookService, tenantId, json);
  }

  // --- Refunds: Histórico ---
  if (pathname === '/api/billing/refunds' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    const tenantId = await extractAndValidateTenantId(url, req, user, supabase);
    if (!tenantId) return json(res, 403, { error: 'Acesso negado ao tenant' }, req);
    return billingRoutes.getRefundHistory(req, res, webhookService, tenantId, json);
  }

  // --- Metrics: Estatísticas ---
  if (pathname === '/api/billing/metrics/stats' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    const tenantId = await extractAndValidateTenantId(url, req, user, supabase);
    if (!tenantId) return json(res, 403, { error: 'Acesso negado ao tenant' }, req);
    return billingRoutes.getMetricsStats(req, res, metricsService, tenantId, json);
  }

  // --- Billing: Health Check ---
  if (pathname === '/api/billing/health' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    const tenantId = await extractAndValidateTenantId(url, req, user, supabase);
    if (!tenantId) return json(res, 403, { error: 'Acesso negado ao tenant' }, req);
    return billingRoutes.getHealthCheck(req, res, metricsService, tenantId, json);
  }

  // --- Billing: Auditoria ---
  if (pathname === '/api/billing/audit' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    const tenantId = await extractAndValidateTenantId(url, req, user, supabase);
    if (!tenantId) return json(res, 403, { error: 'Acesso negado ao tenant' }, req);
    return billingRoutes.getAuditReport(req, res, metricsService, tenantId, json);
  }

  // --- Tenant: Provisioning (autenticado) ---
  if (pathname === '/api/tenants/provision' && req.method === 'POST') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    if (!tenantService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    // SECURITY: Validar schema do payload
    const validation = await TenantSchemas.provision.safeParseAsync(await parseBody(req));
    if (!validation.success) {
      log('warn', 'Validação de payload falhou', {
        endpoint: '/api/tenants/provision',
        errors: validation.error.errors,
        user: user.id,
        ip: clientIp,
      });
      return json(res, 400, {
        error: 'Validação falhou',
        details: validation.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, req);
    }

    const { email, tenantName, userId } = validation.data;

    try {
      const tenant = await tenantService.provision(
        userId || user.id,
        email || user.email,
        tenantName
      );
      return json(res, 200, { tenant }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Tenant: Dados do tenant logado ---
  if (pathname === '/api/tenants/me' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    if (!tenantService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const tenant = await tenantService.getByUserId(user.id);
      if (!tenant) return json(res, 404, { error: 'Tenant não encontrado' }, req);
      return json(res, 200, { tenant }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Referral: Reivindicar via código (quando novo usuário se inscreve) ---
  if (pathname.match(/^\/api\/referrals\/claim\/[a-zA-Z0-9_]+$/) && req.method === 'POST') {
    const refCode = pathname.split('/').pop();
    if (!supabase) return json(res, 503, { error: 'Supabase não configurado' }, req);

    // SECURITY: Validar schema do payload
    const validation = await ReferralSchemas.claimCode.safeParseAsync(await parseBody(req));
    if (!validation.success) {
      log('warn', 'Validação de payload falhou', {
        endpoint: '/api/referrals/claim/*',
        errors: validation.error.errors,
        ip: clientIp,
      });
      return json(res, 400, {
        error: 'Validação falhou',
        details: validation.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, req);
    }

    const { newTenantId } = validation.data;

    try {
      // Buscar referral_link
      const { data: refLink } = await supabase
        .from('referral_links')
        .select('id, referrer_tenant_id, referee_tenant_id, status')
        .eq('ref_code', refCode)
        .single();

      if (!refLink) return json(res, 404, { error: 'Código de referral inválido' }, req);
      if (refLink.status !== 'active') return json(res, 400, { error: 'Código não está ativo' }, req);
      if (refLink.referee_tenant_id && refLink.referee_tenant_id !== newTenantId) {
        return json(res, 400, { error: 'Código já foi utilizado' }, req);
      }

      // Atualizar com o novo tenant
      await supabase
        .from('referral_links')
        .update({ referee_tenant_id: newTenantId })
        .eq('id', refLink.id);

      return json(res, 200, {
        success: true,
        referrerTenantId: refLink.referrer_tenant_id,
      }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Referral: Registrar clique (tracking) ---
  if (pathname.match(/^\/api\/referrals\/click\/[a-zA-Z0-9_]+$/) && req.method === 'POST') {
    const refCode = pathname.split('/').pop();
    if (!supabase) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const { data: refLink } = await supabase
        .from('referral_links')
        .select('id')
        .eq('ref_code', refCode)
        .single();

      if (refLink) {
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress;

        await supabase.from('referral_clicks').insert({
          referral_link_id: refLink.id,
          ip_address: ipAddress,
          user_agent: userAgent,
        });
      }

      return json(res, 200, { ok: true }, req);
    } catch (e) {
      // Falha silenciosa em tracking
      console.log('[Referral] Aviso de tracking:', e.message);
      return json(res, 200, { ok: true }, req);
    }
  }

  // --- Platform Admin: Verificar se é superadmin (sem restrição) ---
  if (pathname === '/api/admin/platform/check' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    if (!platformAdminService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const isPlatformAdmin = await platformAdminService.isPlatformAdmin(user.id);
      return json(res, 200, { isPlatformAdmin }, req);
    } catch (e) {
      return json(res, 200, { isPlatformAdmin: false }, req);
    }
  }

  // --- Platform Admin: Listar superadmins ---
  if (pathname === '/api/admin/platform/admins' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    if (!platformAdminService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const isPlatformAdmin = await platformAdminService.isPlatformAdmin(user.id);
      if (!isPlatformAdmin) return json(res, 403, { error: 'Acesso negado: requer permissão de superadmin' }, req);

      const admins = await platformAdminService.listPlatformAdmins();
      return json(res, 200, { data: admins, total: admins.length }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Platform Admin: Listar convites pendentes ---
  if (pathname === '/api/admin/platform/invites' && req.method === 'GET') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    if (!platformAdminService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const isPlatformAdmin = await platformAdminService.isPlatformAdmin(user.id);
      if (!isPlatformAdmin) return json(res, 403, { error: 'Acesso negado: requer permissão de superadmin' }, req);

      const invites = await platformAdminService.listPendingInvites();
      return json(res, 200, { invites, total: invites.length }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Platform Admin: Convidar novo superadmin ---
  if (pathname === '/api/admin/platform/invite' && req.method === 'POST') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    if (!platformAdminService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    // SECURITY: Validar schema do payload
    const validation = await PlatformAdminSchemas.invite.safeParseAsync(await parseBody(req));
    if (!validation.success) {
      log('warn', 'Validação de payload falhou', {
        endpoint: '/api/admin/platform/invite',
        errors: validation.error.errors,
        user: user.id,
        ip: clientIp,
      });
      return json(res, 400, {
        error: 'Validação falhou',
        details: validation.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, req);
    }

    const { email } = validation.data;

    try {
      const isPlatformAdmin = await platformAdminService.isPlatformAdmin(user.id);
      if (!isPlatformAdmin) return json(res, 403, { error: 'Acesso negado: requer permissão de superadmin' }, req);

      const result = await platformAdminService.invitePlatformAdmin(email, user.id);
      return json(res, 201, {
        message: result.emailSent === false
          ? `Convite criado para ${email}. Copie o link manualmente.`
          : `Convite criado para ${email}`,
        invite: result.invite,
        token: result.token,
        inviteUrl: result.inviteUrl,
      }, req);
    } catch (e) {
      return json(res, 400, { error: e.message }, req);
    }
  }

  // --- Platform Admin: Aceitar convite ---
  if (pathname === '/api/admin/platform/accept-invite' && req.method === 'POST') {
    // SECURITY: Validar schema do payload
    const validation = await PlatformAdminSchemas.acceptInvite.safeParseAsync(await parseBody(req));
    if (!validation.success) {
      log('warn', 'Validação de payload falhou', {
        endpoint: '/api/admin/platform/accept-invite',
        errors: validation.error.errors,
        ip: clientIp,
      });
      return json(res, 400, {
        error: 'Validação falhou',
        details: validation.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, req);
    }

    const { token, userId, email } = validation.data;

    if (!platformAdminService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const admin = await platformAdminService.acceptInvite(token, userId, email);
      return json(res, 201, {
        message: `Bem-vindo como superadmin, ${email}!`,
        admin,
      }, req);
    } catch (e) {
      return json(res, 400, { error: e.message }, req);
    }
  }

  // --- Platform Admin: Remover superadmin ---
  if (pathname === '/api/admin/platform/remove' && req.method === 'POST') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
    if (!platformAdminService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    // SECURITY: Validar schema do payload
    const validation = await PlatformAdminSchemas.remove.safeParseAsync(await parseBody(req));
    if (!validation.success) {
      log('warn', 'Validação de payload falhou', {
        endpoint: '/api/admin/platform/remove',
        errors: validation.error.errors,
        user: user.id,
        ip: clientIp,
      });
      return json(res, 400, {
        error: 'Validação falhou',
        details: validation.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, req);
    }

    const { adminId } = validation.data;

    try {
      const isPlatformAdmin = await platformAdminService.isPlatformAdmin(user.id);
      if (!isPlatformAdmin) return json(res, 403, { error: 'Acesso negado: requer permissão de superadmin' }, req);

      const result = await platformAdminService.removePlatformAdmin(adminId, user.id);
      return json(res, 200, {
        message: `Superadmin ${result.email} foi desativado`,
        admin: result,
      }, req);
    } catch (e) {
      return json(res, 400, { error: e.message }, req);
    }
  }

  // --- Admin: Estatísticas operacionais ---
  if (pathname === '/api/admin/stats' && req.method === 'GET') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;

    try {
      const clients = await listAdminClients('');
      return json(res, 200, {
        clients: clients.length,
        active: clients.filter((client) => client.status === 'active').length,
        suspended: clients.filter((client) => client.status === 'suspended').length,
        credits: clients.reduce((sum, client) => sum + Number(client.balance || 0), 0),
        instances: clients.reduce((sum, client) => sum + Number(client.instances || 0), 0),
        connectedInstances: clients.reduce((sum, client) => sum + Number(client.connectedInstances || 0), 0),
      }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Admin: Clientes/Tenants ---
  if (pathname === '/api/admin/clients' && req.method === 'GET') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;

    try {
      const clients = await listAdminClients(url.searchParams.get('search') || '');
      return json(res, 200, { clients, total: clients.length }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Admin: Instâncias por tenant/provider ---
  if (pathname === '/api/admin/instances' && req.method === 'GET') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;

    try {
      let providersQuery = supabase
        .from('tenant_providers')
        .select('id, tenant_id, provider, account_id, is_active, tenants(id,slug,name,email)');

      const tenantId = url.searchParams.get('tenantId');
      if (tenantId) providersQuery = providersQuery.eq('tenant_id', tenantId);

      const { data: providers, error: providersError } = await providersQuery;
      if (providersError) throw providersError;

      const providerIds = (providers || []).map((provider) => provider.id);
      const { data: instances, error: instancesError } = providerIds.length
        ? await supabase
          .from('instance_registry')
          .select('id, tenant_provider_id, remote_instance_id, status, instance_number, instance_name, platform, is_business, last_seen_at, updated_at')
          .in('tenant_provider_id', providerIds)
          .order('updated_at', { ascending: false })
        : { data: [], error: null };
      if (instancesError) throw instancesError;

      const providerById = new Map((providers || []).map((provider) => [provider.id, provider]));
      const rows = (instances || []).map((instance) => {
        const provider = providerById.get(instance.tenant_provider_id);
        return {
          ...instance,
          provider: provider?.provider,
          providerActive: provider?.is_active,
          tenant: provider?.tenants || null,
        };
      });

      return json(res, 200, { instances: rows, total: rows.length }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }


  // --- Admin: Contas/provedores UAZAPI ---
  if (pathname === '/api/admin/provider-accounts' && req.method === 'GET') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;
    if (!uazapiAccountService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const accounts = await uazapiAccountService.listAccounts();
      return json(res, 200, { accounts, total: accounts.length }, req);
    } catch (e) {
      const migrationError = providerMigrationError(e);
      return json(res, migrationError ? 503 : 500, { error: migrationError || e.message }, req);
    }
  }

  if (pathname === '/api/admin/provider-accounts' && req.method === 'POST') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;
    if (!uazapiAccountService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const body = await parseBody(req);
      const account = await uazapiAccountService.createAccount(body, adminUser.id);
      return json(res, 201, { account }, req);
    } catch (e) {
      const migrationError = providerMigrationError(e);
      return json(res, migrationError ? 503 : 400, { error: migrationError || e.message }, req);
    }
  }

  const providerRotateMatch = pathname.match(/^\/api\/admin\/provider-accounts\/([^/]+)\/rotate$/);
  if (providerRotateMatch && req.method === 'POST') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;
    if (!uazapiAccountService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const body = await parseBody(req);
      const account = await uazapiAccountService.rotateAccount(providerRotateMatch[1], body.adminToken || body.admin_token, adminUser.id);
      return json(res, 200, { account }, req);
    } catch (e) {
      const migrationError = providerMigrationError(e);
      return json(res, migrationError ? 503 : 400, { error: migrationError || e.message }, req);
    }
  }

  const providerStatusMatch = pathname.match(/^\/api\/admin\/provider-accounts\/([^/]+)\/status$/);
  if (providerStatusMatch && req.method === 'POST') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;
    if (!uazapiAccountService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const body = await parseBody(req);
      const account = await uazapiAccountService.updateStatus(providerStatusMatch[1], body.status, adminUser.id);
      return json(res, 200, { account }, req);
    } catch (e) {
      const migrationError = providerMigrationError(e);
      return json(res, migrationError ? 503 : 400, { error: migrationError || e.message }, req);
    }
  }

  const providerSyncMatch = pathname.match(/^\/api\/admin\/provider-accounts\/([^/]+)\/sync$/);
  if (providerSyncMatch && req.method === 'POST') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;
    if (!uazapiAccountService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const result = await uazapiAccountService.syncAccount(providerSyncMatch[1], adminUser.id);
      return json(res, 200, result, req);
    } catch (e) {
      const migrationError = providerMigrationError(e);
      return json(res, migrationError ? 503 : 400, { error: migrationError || e.message }, req);
    }
  }

  // --- Admin: Gateways de pagamento (Getnet, Cakto, etc.) ---
  if (pathname === '/api/admin/payment-gateways' && req.method === 'GET') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;
    if (!paymentGatewayAccountService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const gateways = await paymentGatewayAccountService.listAccounts();
      return json(res, 200, { gateways, total: gateways.length }, req);
    } catch (e) {
      const migrationError = paymentGatewayMigrationError(e);
      return json(res, migrationError ? 503 : 500, { error: migrationError || e.message }, req);
    }
  }

  if (pathname === '/api/admin/payment-gateways' && req.method === 'POST') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;
    if (!paymentGatewayAccountService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const body = await parseBody(req);
      const gateway = await paymentGatewayAccountService.createAccount(body, adminUser.id);
      return json(res, 201, { gateway }, req);
    } catch (e) {
      const migrationError = paymentGatewayMigrationError(e);
      return json(res, migrationError ? 503 : 400, { error: migrationError || e.message }, req);
    }
  }

  const paymentGatewayStatusMatch = pathname.match(/^\/api\/admin\/payment-gateways\/([^/]+)\/status$/);
  if (paymentGatewayStatusMatch && req.method === 'POST') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;
    if (!paymentGatewayAccountService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const body = await parseBody(req);
      const gateway = await paymentGatewayAccountService.updateStatus(paymentGatewayStatusMatch[1], body.status);
      return json(res, 200, { gateway }, req);
    } catch (e) {
      const migrationError = paymentGatewayMigrationError(e);
      return json(res, migrationError ? 503 : 400, { error: migrationError || e.message }, req);
    }
  }

  if (pathname === '/api/admin/instances/create' && req.method === 'POST') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;
    if (!uazapiAccountService) return json(res, 503, { error: 'Supabase não configurado' }, req);

    try {
      const body = await parseBody(req);
      const result = await uazapiAccountService.createManagedInstance(body, adminUser.id);
      return json(res, 201, result, req);
    } catch (e) {
      const migrationError = providerMigrationError(e);
      return json(res, migrationError ? 503 : 400, { error: migrationError || e.message }, req);
    }
  }

  // --- Admin: Lançar créditos ---
  if (pathname === '/api/admin/credits' && req.method === 'POST') {
    const adminUser = await requirePlatformAdmin(req, res);
    if (!adminUser) return;

    try {
      const body = await parseBody(req);
      const tenantId = String(body.tenantId || '').trim();
      const amount = Number(body.amount || 0);
      const description = String(body.description || 'Crédito administrativo').trim();

      if (!tenantId) return json(res, 400, { error: 'tenantId obrigatório' }, req);
      if (!Number.isFinite(amount) || amount <= 0) return json(res, 400, { error: 'amount deve ser positivo' }, req);

      const { data: tenant, error: readErr } = await supabase
        .from('tenants')
        .select('credits_balance')
        .eq('id', tenantId)
        .single();
      if (readErr || !tenant) return json(res, 404, { error: 'Tenant não encontrado' }, req);

      const newBalance = Number(tenant.credits_balance || 0) + amount;
      const { error: updateErr } = await supabase
        .from('tenants')
        .update({ credits_balance: newBalance })
        .eq('id', tenantId);
      if (updateErr) throw updateErr;

      await supabase.from('wallet_transactions').insert({
        tenant_id: tenantId,
        type: 'credit',
        amount,
        balance_after: newBalance,
        source: 'admin',
        reference_id: adminUser.id,
        reference_type: 'platform_admin',
        description,
      });

      return json(res, 200, { tenantId, amount, balance: newBalance }, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  // --- Health local do gateway SaaS ---
  if (pathname === '/api/local/health' && req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      service: 'ruptur-saas-gateway',
      supabase: Boolean(supabase),
      billingConfigured: Boolean(
        (process.env.GETNET_CLIENT_ID && process.env.GETNET_CLIENT_SECRET && process.env.GETNET_SELLER_ID)
        || (process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET)
      ),
      paymentGateways: {
        getnet: Boolean(process.env.GETNET_CLIENT_ID && process.env.GETNET_CLIENT_SECRET && process.env.GETNET_SELLER_ID),
        cakto: Boolean(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET),
      },
      warmupProxy: WARMUP_URL,
      ts: new Date().toISOString(),
    }, req);
  }

  // --- Proxy: Dashboard Stats, Campaigns, Wallet, Inbox → Warmup Manager ---
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/billing') && !pathname.startsWith('/api/tenants') && !pathname.startsWith('/api/webhooks') && !pathname.startsWith('/api/referrals') && !pathname.startsWith('/api/admin')) {
    // Proxy para o Warmup Manager existente
    try {
      const proxyUrl = `${WARMUP_URL}${pathname}${url.search}`;
      const proxyRes = await fetch(proxyUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...( req.headers.authorization ? { 'Authorization': req.headers.authorization } : {}),
        },
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(await parseBody(req)) : undefined,
      });

      const data = await proxyRes.json();
      return json(res, proxyRes.status, data, req);
    } catch (e) {
      return json(res, 502, { error: `Warmup Manager indisponível: ${e.message}` }, req);
    }
  }

  // ================================================================
  //  Static Files (SPA)
  // ================================================================
  return serveStatic(res, pathname, req);
}

// --- Start ---
const server = http.createServer(handler);

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║     🚀 Ruptur SaaS Gateway                  ║');
  console.log(`  ║     http://${HOST}:${PORT}                    ║`);
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  Supabase:    ${supabase ? '✅ Conectado' : '⚠️  Não configurado'}          ║`);
  console.log(`  ║  Billing:     ${billing.clientId ? '✅ Getnet ativo' : '⚠️  Sem credenciais'}       ║`);
  console.log(`  ║  Warmup Proxy: ${WARMUP_URL}       ║`);
  console.log(`  ║  Static:       ${existsSync(DIST_DIR) ? '✅ dist-client' : '⚠️  sem build'}             ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
});

export { server };
