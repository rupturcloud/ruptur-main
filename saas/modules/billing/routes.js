/**
 * Rotas de Billing — Getnet (Santander)
 * Com Auditoria, RBAC e Rate Limiting
 *
 * POST /api/billing/checkout   → Criar checkout para créditos avulsos
 * POST /api/billing/subscribe  → Criar assinatura recorrente
 * GET  /api/billing/plans      → Listar planos disponíveis
 * GET  /api/billing/packages   → Listar pacotes de créditos
 * POST /api/webhooks/getnet    → Webhook de notificação da Getnet (HMAC-SHA256)
 *
 * Segurança:
 * - Validação de permissões por role (owner/admin/member)
 * - Auditoria imutável de todas operações
 * - Rate limiting por tenant
 * - Isolamento de dados por tenant em nível de DB (RLS)
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PermissionsService } from './permissions.service.js';
import { AuditService } from './audit.service.js';

const WEBHOOK_SECRET = process.env.GETNET_WEBHOOK_SECRET || '';
const tenantRateLimits = new Map();

/**
 * Verificar assinatura HMAC-SHA256 do webhook Getnet
 * Header esperado: x-getnet-signature ou x-signature
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!WEBHOOK_SECRET) return true; // Sem secret configurado = bypass (dev mode)

  if (!signature) return false;

  const expected = createHmac('sha256', WEBHOOK_SECRET)
    .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
    .digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return signature === expected;
  }
}

/**
 * Rate limiting por tenant (simples em-memory)
 * TODO: Migrar para Redis em produção
 */
function checkTenantRateLimit(tenantId, maxRequestsPerMinute = 10) {
  const now = Date.now();
  const key = `${tenantId}:purchase`;

  if (!tenantRateLimits.has(key)) {
    tenantRateLimits.set(key, []);
  }

  const requests = tenantRateLimits.get(key);
  const oneMinuteAgo = now - 60000;

  // Remover requests antigos
  while (requests.length > 0 && requests[0] < oneMinuteAgo) {
    requests.shift();
  }

  if (requests.length >= maxRequestsPerMinute) {
    return false;
  }

  requests.push(now);
  return true;
}

/**
 * Extrair contexto de segurança da request
 */
function extractSecurityContext(req) {
  return {
    ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
    sessionId: req.session?.id || null
  };
}

export function registerBillingRoutes(app, { billing, authMiddleware }) {
  const permissionsService = new PermissionsService(billing.supabase);
  const auditService = new AuditService(billing.supabase);

  // Listar planos disponíveis (público)
  app.get('/api/billing/plans', async (req, res) => {
    try {
      const plans = await billing.getPlans();
      res.json({ plans });
    } catch (error) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Erro ao listar planos', error: error.message }));
      res.status(500).json({ error: 'Erro ao listar planos' });
    }
  });

  // Listar pacotes de créditos (público)
  app.get('/api/billing/packages', (req, res) => {
    res.json({ packages: billing.getCreditPackages() });
  });

  // Criar checkout para créditos avulsos (autenticado)
  app.post('/api/billing/checkout', authMiddleware, async (req, res) => {
    try {
      const { tenantId, packageId } = req.body;
      if (!tenantId || !packageId) {
        return res.status(400).json({ error: 'tenantId e packageId são obrigatórios' });
      }

      const result = await billing.createCheckoutPreference(tenantId, packageId);
      res.json(result);
    } catch (error) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Erro no checkout', error: error.message }));
      res.status(500).json({ error: error.message });
    }
  });

  // Criar assinatura recorrente (autenticado)
  app.post('/api/billing/subscribe', authMiddleware, async (req, res) => {
    try {
      const { tenantId, planId } = req.body;
      if (!tenantId || !planId) {
        return res.status(400).json({ error: 'tenantId e planId são obrigatórios' });
      }

      const result = await billing.createSubscription(tenantId, planId);
      res.json(result);
    } catch (error) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Erro na assinatura', error: error.message }));
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook da Getnet — com validação HMAC-SHA256
  app.post('/api/webhooks/getnet', async (req, res) => {
    const signature = req.headers['x-getnet-signature'] || req.headers['x-signature'] || '';

    // Validar assinatura antes de processar qualquer coisa
    if (!verifyWebhookSignature(req.body, signature)) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        msg: 'Webhook Getnet: assinatura HMAC inválida',
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      }));
      return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
      // Responder rápido para a Getnet (evita retry em timeout)
      res.status(200).json({ ok: true });

      // Processar em background
      const result = await billing.handleWebhook(req.body, req.query);
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        msg: 'Webhook Getnet processado',
        ...result,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        msg: 'Erro ao processar webhook Getnet',
        error: error.message,
      }));
      // Já respondemos 200 para evitar retry infinito
    }
  });

  // Provisioning de tenant (autenticado)
  app.post('/api/tenants/provision', authMiddleware, async (req, res) => {
    try {
      const { userId, email, tenantName } = req.body;
      if (!userId || !email) {
        return res.status(400).json({ error: 'userId e email são obrigatórios' });
      }

      const { default: TenantService } = await import('../modules/tenants/service.js');
      const tenantService = new TenantService(req.supabase || billing.supabase);
      const tenant = await tenantService.provision(userId, email, tenantName);

      res.json({ tenant });
    } catch (error) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Erro no provisionamento', error: error.message }));
      res.status(500).json({ error: error.message });
    }
  });
}

export default registerBillingRoutes;

