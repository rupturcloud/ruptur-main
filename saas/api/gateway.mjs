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

import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { BillingService } from '../modules/billing/getnet.js';
import TenantService from '../modules/tenants/service.js';

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

// --- Origens CORS permitidas ---
const ALLOWED_ORIGINS = new Set([
  'https://ruptur.cloud',
  'https://www.ruptur.cloud',
  'https://saas.ruptur.cloud',
  'http://localhost:5173',   // Vite dev
  'http://localhost:3000',
  'http://localhost:3001',
]);

function corsOrigin(req) {
  const origin = req.headers.origin || '';
  return ALLOWED_ORIGINS.has(origin) ? origin : ALLOWED_ORIGINS.values().next().value;
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
  const origin = req ? corsOrigin(req) : '*';
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
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

  // Rate Limiter — bloqueia antes de qualquer processamento
  if (!rateLimit(clientIp)) {
    log('warn', 'Rate limit excedido', { ip: clientIp });
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
    return res.end(JSON.stringify({ error: 'Too many requests' }));
  }

  // CORS Preflight — origens específicas
  if (req.method === 'OPTIONS') {
    const origin = corsOrigin(req);
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
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

    const body = await parseBody(req);
    if (!body.tenantId || !body.packageId) {
      return json(res, 400, { error: 'tenantId e packageId obrigatórios' }, req);
    }

    try {
      const result = await billing.createCheckoutPreference(body.tenantId, body.packageId);
      return json(res, 200, result, req);
    } catch (e) {
      return json(res, 500, { error: e.message }, req);
    }
  }

  if (pathname === '/api/billing/subscribe' && req.method === 'POST') {
    const user = await extractUser(req);
    if (!user) return json(res, 401, { error: 'Não autenticado' }, req);

    const body = await parseBody(req);
    if (!body.tenantId || !body.planId) {
      return json(res, 400, { error: 'tenantId e planId obrigatórios' }, req);
    }

    try {
      const result = await billing.createSubscription(body.tenantId, body.planId);
      return json(res, 200, result, req);
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

    const body = await parseBody(req);
    try {
      const tenant = await tenantService.provision(
        body.userId || user.id,
        body.email || user.email,
        body.tenantName
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

  // --- Proxy: Dashboard Stats, Campaigns, Wallet, Inbox → Warmup Manager ---
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/billing') && !pathname.startsWith('/api/tenants') && !pathname.startsWith('/api/webhooks')) {
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
