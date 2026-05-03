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

const tenantService = supabase ? new TenantService(supabase) : null;
const platformAdminService = supabase ? new PlatformAdminService(supabase, null) : null;

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
  const origin = req.headers.origin || '';

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

  // --- Webhook Getnet (público) ---
  if (pathname === '/api/webhooks/getnet' && req.method === 'POST') {
    const rawBodyChunks = [];
    req.on('data', c => rawBodyChunks.push(c));
    req.on('end', async () => {
      const rawBody = Buffer.concat(rawBodyChunks).toString();
      
      // Validação HMAC (se houver secret)
      const WEBHOOK_SECRET = process.env.GETNET_WEBHOOK_SECRET || '';
      const signature = req.headers['x-getnet-signature'] || req.headers['x-signature'] || '';
      
      let isValid = true;
      if (WEBHOOK_SECRET && signature) {
        const crypto = await import('node:crypto');
        const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
        try {
          const sigBuf = Buffer.from(signature, 'hex');
          const expBuf = Buffer.from(expected, 'hex');
          if (sigBuf.length !== expBuf.length) isValid = false;
          else isValid = crypto.timingSafeEqual(sigBuf, expBuf);
        } catch {
          isValid = (signature === expected);
        }
      }

      if (!isValid) {
        log('error', 'Assinatura HMAC inválida no webhook Getnet', { ip: clientIp });
        return json(res, 401, { error: 'Invalid signature' }, req);
      }

      let parsedBody;
      try { parsedBody = JSON.parse(rawBody); } catch { parsedBody = {}; }

      // Responder imediatamente para a adquirente
      json(res, 200, { ok: true }, req);

      // Processar em background
      try {
        const result = await billing.handleWebhook(parsedBody, Object.fromEntries(url.searchParams));
        console.log('[Gateway] Webhook Getnet processado:', result);
      } catch (e) {
        console.error('[Gateway] Erro no webhook Getnet:', e);
      }
    });
    return;
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
        message: `Convite enviado para ${email}`,
        invite: result.invite,
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
