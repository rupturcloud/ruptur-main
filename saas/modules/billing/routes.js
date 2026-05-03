/**
 * Rotas de Billing — Getnet (Santander)
 * Com Auditoria, RBAC, Idempotência e Lock Otimista
 *
 * POST /api/billing/checkout   → Criar checkout para créditos avulsos (idempotente)
 * POST /api/billing/subscribe  → Criar assinatura recorrente
 * GET  /api/billing/plans      → Listar planos disponíveis
 * GET  /api/billing/packages   → Listar pacotes de créditos
 * GET  /api/billing/wallet     → Obter saldo da wallet
 * POST /api/webhooks/getnet    → Webhook de notificação da Getnet (HMAC-SHA256)
 *
 * Segurança:
 * - Validação de permissões por role (owner/admin/member)
 * - Auditoria imutável de todas operações
 * - Rate limiting por tenant
 * - Isolamento de dados por tenant em nível de DB (RLS)
 * - Idempotência via idempotency_key (SHA256)
 * - Lock otimista em wallet (version column)
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PermissionsService } from './permissions.service.js';
import { AuditService } from './audit.service.js';
import { BillingService } from './billing.service.js';
import { WebhookService } from './webhook.service.js';

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
  const billingService = new BillingService(billing.supabase, auditService, permissionsService);
  const webhookService = new WebhookService(billing.supabase, auditService);

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

  // Obter saldo da wallet (autenticado)
  app.get('/api/billing/wallet', authMiddleware, async (req, res) => {
    try {
      const { tenantId } = req.query;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId é obrigatório' });
      }

      // Validar permissão de visualizar (pelo menos member)
      try {
        await permissionsService.requireBillingPermission(req.user.id, tenantId, 'view');
      } catch (error) {
        return res.status(403).json({ error: 'Você não tem permissão para visualizar este wallet' });
      }

      const wallet = await billingService.getWalletBalance(tenantId);

      res.json({
        tenantId,
        balance: wallet.balance,
        version: wallet.version,
        updatedAt: wallet.updated_at
      });
    } catch (error) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Erro ao obter wallet', error: error.message }));
      res.status(500).json({ error: error.message });
    }
  });

  // Criar checkout para créditos avulsos (autenticado + RBAC)
  app.post('/api/billing/checkout', authMiddleware, async (req, res) => {
    const securityContext = extractSecurityContext(req);

    try {
      const { tenantId, packageId } = req.body;
      if (!tenantId || !packageId) {
        return res.status(400).json({ error: 'tenantId e packageId são obrigatórios' });
      }

      // 1. Validar rate limit
      if (!checkTenantRateLimit(tenantId)) {
        await auditService.log({
          tenantId,
          userId: req.user.id,
          action: 'purchase_rate_limit_exceeded',
          resourceType: 'payment',
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          actingAsRole: await permissionsService.getUserRole(req.user.id, tenantId)
        });
        return res.status(429).json({ error: 'Muitas requisições. Tente novamente em alguns momentos.' });
      }

      // 2. Validar permissão de compra
      try {
        await permissionsService.requireBillingPermission(req.user.id, tenantId, 'purchase');
      } catch (error) {
        await auditService.log({
          tenantId,
          userId: req.user.id,
          action: 'checkout_permission_denied',
          resourceType: 'payment',
          ipAddress: securityContext.ipAddress,
          metadata: { reason: error.message }
        });
        return res.status(403).json({ error: 'Você não tem permissão para comprar créditos' });
      }

      // 3. Validar limite de compra
      const packageData = billing.getCreditPackages().find(p => p.id === packageId);
      if (!packageData) {
        return res.status(404).json({ error: 'Pacote não encontrado' });
      }

      const { allowed, requiresApproval, reason } = await permissionsService.validatePurchaseLimit(
        tenantId,
        packageData.amountCents
      );

      if (!allowed) {
        await auditService.log({
          tenantId,
          userId: req.user.id,
          action: 'checkout_limit_exceeded',
          resourceType: 'payment',
          ipAddress: securityContext.ipAddress,
          metadata: { reason, packageId }
        });
        return res.status(400).json({ error: `Limite de compra excedido: ${reason}` });
      }

      if (requiresApproval) {
        return res.status(400).json({
          error: 'Esta compra requer aprovação do administrador',
          requiresApproval: true
        });
      }

      // 4. Criar checkout IDEMPOTENTE (mesma requisição = mesma resposta)
      const checkoutResult = await billingService.createCheckoutIdempotent(
        tenantId,
        req.user.id,
        packageData
      );

      // 5. Auditar sucesso (usar ação diferente se foi idempotência)
      const userRole = await permissionsService.getUserRole(req.user.id, tenantId);
      await auditService.log({
        tenantId,
        userId: req.user.id,
        action: checkoutResult.isNew ? 'checkout_created' : 'checkout_idempotent',
        resourceType: 'payment',
        resourceId: checkoutResult.id,
        newValue: {
          amountCents: packageData.amountCents,
          status: checkoutResult.status,
          packageId,
          idempotencyKey: checkoutResult.idempotencyKey,
          isNew: checkoutResult.isNew
        },
        ipAddress: securityContext.ipAddress,
        userAgent: securityContext.userAgent,
        sessionId: securityContext.sessionId,
        actingAsRole: userRole
      });

      res.json({
        id: checkoutResult.id,
        status: checkoutResult.status,
        amountCents: packageData.amountCents,
        packageId,
        idempotencyKey: checkoutResult.idempotencyKey,
        isNew: checkoutResult.isNew
      });
    } catch (error) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Erro no checkout', error: error.message }));
      await auditService.log({
        tenantId: req.body?.tenantId,
        userId: req.user.id,
        action: 'checkout_error',
        resourceType: 'payment',
        ipAddress: securityContext.ipAddress,
        metadata: { error: error.message }
      });
      res.status(500).json({ error: error.message });
    }
  });

  // Criar assinatura recorrente (autenticado + RBAC)
  app.post('/api/billing/subscribe', authMiddleware, async (req, res) => {
    const securityContext = extractSecurityContext(req);

    try {
      const { tenantId, planId } = req.body;
      if (!tenantId || !planId) {
        return res.status(400).json({ error: 'tenantId e planId são obrigatórios' });
      }

      // Validar permissão de gerenciar assinatura
      try {
        await permissionsService.requireBillingPermission(req.user.id, tenantId, 'manage_subscription');
      } catch (error) {
        await auditService.log({
          tenantId,
          userId: req.user.id,
          action: 'subscribe_permission_denied',
          resourceType: 'subscription',
          ipAddress: securityContext.ipAddress,
          metadata: { reason: error.message }
        });
        return res.status(403).json({ error: 'Você não tem permissão para gerenciar assinaturas' });
      }

      const result = await billing.createSubscription(tenantId, planId);

      const userRole = await permissionsService.getUserRole(req.user.id, tenantId);
      await auditService.log({
        tenantId,
        userId: req.user.id,
        action: 'subscription_created',
        resourceType: 'subscription',
        resourceId: result.id,
        newValue: { planId, status: result.status },
        ipAddress: securityContext.ipAddress,
        userAgent: securityContext.userAgent,
        sessionId: securityContext.sessionId,
        actingAsRole: userRole
      });

      res.json(result);
    } catch (error) {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'Erro na assinatura', error: error.message }));
      await auditService.log({
        tenantId: req.body?.tenantId,
        userId: req.user.id,
        action: 'subscription_error',
        resourceType: 'subscription',
        ipAddress: securityContext.ipAddress,
        metadata: { error: error.message }
      });
      res.status(500).json({ error: error.message });
    }
  });

  // Webhook da Getnet — com validação HMAC-SHA256 + validação de tenant
  app.post('/api/webhooks/getnet', async (req, res) => {
    const signature = req.headers['x-getnet-signature'] || req.headers['x-signature'] || '';
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;

    // 1. Validar assinatura HMAC antes de processar
    if (!verifyWebhookSignature(req.body, signature)) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        msg: 'Webhook Getnet: assinatura HMAC inválida',
        ip: ipAddress,
      }));
      return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
      // Responder rápido para a Getnet (evita retry em timeout)
      res.status(200).json({ ok: true });

      // 2. Processar em background com idempotência via webhook_events
      const result = await handleGetnetWebhookWithIdempotency(
        req.body,
        req.query,
        billing,
        billingService,
        webhookService,
        auditService,
        ipAddress
      );

      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'info',
        msg: 'Webhook Getnet processado (idempotente)',
        transactionId: req.body.transaction_id,
        status: req.body.status,
        isNew: result.isNew,
        ...result,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        msg: 'Erro ao processar webhook Getnet',
        error: error.message,
        transactionId: req.body.transaction_id,
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

/**
 * Processar webhook da Getnet com idempotência
 * Usa webhook_events para rastreamento e evita processamento duplicado
 */
async function handleGetnetWebhookWithIdempotency(
  payload,
  query,
  billing,
  billingService,
  webhookService,
  auditService,
  ipAddress
) {
  const { transaction_id, status } = payload;

  // 1. Registrar webhook de forma idempotente
  const webhookEvent = await webhookService.processWebhookIdempotent(
    null, // tenantId será obtido do payment
    transaction_id,
    'payment_status_update',
    payload
  );

  // Se já foi processado com sucesso, retornar
  if (!webhookEvent.isNew && webhookEvent.status === 'success') {
    return {
      status: 'idempotent_skip',
      transactionId: transaction_id,
      isNew: false
    };
  }

  try {
    // 2. Buscar transação no DB
    const { data: txn, error: txnError } = await billing.supabase
      .from('payments')
      .select('id, tenant_id, amount_cents, status as current_status')
      .eq('getnet_payment_id', transaction_id)
      .maybeSingle();

    if (txnError || !txn) {
      await webhookService.markWebhookFailed(null, webhookEvent.id, `Payment não encontrado: ${transaction_id}`);
      return { status: 'not_found', transactionId: transaction_id, isNew: webhookEvent.isNew };
    }

    const tenantId = txn.tenant_id;

    // 3. Processar payment status update
    const updateResult = await webhookService.processPaymentStatusUpdate(
      tenantId,
      transaction_id,
      status,
      webhookEvent.id
    );

    // 4. Auditar processamento
    await auditService.log({
      tenantId,
      userId: 'system',
      action: 'webhook_processed',
      resourceType: 'webhook',
      resourceId: txn.id,
      oldValue: { status: txn.current_status },
      newValue: { status },
      ipAddress,
      metadata: {
        transaction_id,
        webhook_payload_status: status,
        reason: updateResult.reason,
        webhook_event_id: webhookEvent.id
      }
    });

    return {
      status: 'success',
      transactionId: transaction_id,
      tenantId,
      newStatus: status,
      isNew: webhookEvent.isNew,
      reason: updateResult.reason
    };

  } catch (error) {
    await webhookService.markWebhookFailed(null, webhookEvent.id, error.message);
    return {
      status: 'error',
      transactionId: transaction_id,
      error: error.message,
      isNew: webhookEvent.isNew
    };
  }
}

export default registerBillingRoutes;

