/**
 * Rotas de Billing — REFATORADAS com Permissões e Auditoria
 *
 * Este arquivo mostra como refatorar routes.js para incluir:
 * - Validação de permissões (PermissionsService)
 * - Auditoria (AuditService)
 * - Rate limiting por tenant
 *
 * INSTRUÇÕES:
 * 1. Copie as funções abaixo
 * 2. Substitua as implementações correspondentes em modules/billing/routes.js
 * 3. Adicione imports no topo:
 *    import { PermissionsService } from './permissions.service.js';
 *    import { AuditService } from './audit.service.js';
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { PermissionsService } from './permissions.service.js';
import { AuditService } from './audit.service.js';

const WEBHOOK_SECRET = process.env.GETNET_WEBHOOK_SECRET || '';

/**
 * Verificar assinatura HMAC-SHA256 do webhook Getnet
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
 * Rate limiting por tenant (simples em-memory, replace com Redis em produção)
 */
const tenantRateLimits = new Map();

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

  // Verificar limite
  if (requests.length >= maxRequestsPerMinute) {
    return false; // Limit exceeded
  }

  // Registrar request
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

// ============================================================================
// ROTAS REFATORADAS
// ============================================================================

export function registerBillingRoutes(app, { billing, authMiddleware }) {
  const permissionsService = new PermissionsService(billing.supabase);
  const auditService = new AuditService(billing.supabase);

  // =========================================================================
  // GET /api/billing/plans — Listar planos (público)
  // =========================================================================
  app.get('/api/billing/plans', async (req, res) => {
    try {
      const plans = await billing.getPlans();
      res.json({ plans });
    } catch (error) {
      console.error('Erro ao listar planos:', error.message);
      res.status(500).json({ error: 'Erro ao listar planos' });
    }
  });

  // =========================================================================
  // GET /api/billing/packages — Listar pacotes de créditos (público)
  // =========================================================================
  app.get('/api/billing/packages', (req, res) => {
    res.json({ packages: billing.getCreditPackages() });
  });

  // =========================================================================
  // POST /api/billing/checkout — Criar checkout (REFATORADO)
  // =========================================================================
  app.post('/api/billing/checkout', authMiddleware, async (req, res) => {
    const securityContext = extractSecurityContext(req);

    try {
      const { tenantId, packageId } = req.body;

      // 1. Validações básicas
      if (!tenantId || !packageId) {
        return res.status(400).json({ error: 'tenantId e packageId são obrigatórios' });
      }

      // 2. Validar rate limit
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
        return res.status(429).json({ error: 'Too many requests. Try again later.' });
      }

      // 3. Validar permissão
      try {
        await permissionsService.requireBillingPermission(req.user.id, tenantId, 'purchase');
      } catch (error) {
        await auditService.log({
          tenantId,
          userId: req.user.id,
          action: 'purchase_permission_denied',
          resourceType: 'payment',
          ipAddress: securityContext.ipAddress,
          userAgent: securityContext.userAgent,
          metadata: { reason: error.message }
        });
        return res.status(403).json({ error: 'Você não tem permissão para comprar créditos' });
      }

      // 4. Obter pacote e validar limite
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
          action: 'purchase_limit_exceeded',
          resourceType: 'payment',
          ipAddress: securityContext.ipAddress,
          metadata: { reason, packageId }
        });
        return res.status(400).json({ error: `Limite de compra excedido: ${reason}` });
      }

      if (requiresApproval) {
        // TODO: Implementar fluxo de aprovação
        return res.status(400).json({
          error: 'Esta compra requer aprovação do administrador',
          requiresApproval: true
        });
      }

      // 5. Criar checkout
      const result = await billing.createCheckoutPreference(tenantId, packageId);

      // 6. Auditar sucesso
      const userRole = await permissionsService.getUserRole(req.user.id, tenantId);
      await auditService.log({
        tenantId,
        userId: req.user.id,
        action: 'checkout_created',
        resourceType: 'payment',
        resourceId: result.id,
        newValue: {
          amountCents: result.amountCents,
          status: result.status,
          packageId
        },
        ipAddress: securityContext.ipAddress,
        userAgent: securityContext.userAgent,
        sessionId: securityContext.sessionId,
        actingAsRole: userRole
      });

      res.json(result);
    } catch (error) {
      console.error('Erro no checkout:', error.message);
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

  // =========================================================================
  // POST /api/billing/subscribe — Criar assinatura (REFATORADO)
  // =========================================================================
  app.post('/api/billing/subscribe', authMiddleware, async (req, res) => {
    const securityContext = extractSecurityContext(req);

    try {
      const { tenantId, planId } = req.body;

      if (!tenantId || !planId) {
        return res.status(400).json({ error: 'tenantId e planId são obrigatórios' });
      }

      // Validar permissão
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
        actingAsRole: userRole
      });

      res.json(result);
    } catch (error) {
      console.error('Erro na assinatura:', error.message);
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

  // =========================================================================
  // POST /api/webhooks/getnet — Webhook com validação de tenant (REFATORADO)
  // =========================================================================
  app.post('/api/webhooks/getnet', async (req, res) => {
    const signature = req.headers['x-getnet-signature'] || req.headers['x-signature'] || '';

    // 1. Validar assinatura HMAC
    if (!verifyWebhookSignature(req.body, signature)) {
      console.error('Webhook Getnet: assinatura HMAC inválida', {
        ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
      // Responder rápido para evitar retry
      res.status(200).json({ ok: true });

      // Processar em background
      await handleGetnetWebhook(req.body, billing, auditService);
    } catch (error) {
      console.error('Erro ao processar webhook Getnet:', error.message);
      // Já respondemos 200, não resend
    }
  });

  // =========================================================================
  // GET /api/billing/balance — Saldo de créditos (REFATORADO)
  // =========================================================================
  app.get('/api/billing/balance', authMiddleware, async (req, res) => {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId é obrigatório' });
      }

      // Validar permissão de view
      try {
        await permissionsService.requireBillingPermission(req.user.id, tenantId, 'view');
      } catch {
        return res.status(403).json({ error: 'Você não tem permissão' });
      }

      const wallet = await billing.getWalletBalance(tenantId);
      res.json({ wallet });
    } catch (error) {
      console.error('Erro ao buscar saldo:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // GET /api/billing/transactions — Histórico de transações (REFATORADO)
  // =========================================================================
  app.get('/api/billing/transactions', authMiddleware, async (req, res) => {
    try {
      const { tenantId, limit = 50, offset = 0 } = req.query;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId é obrigatório' });
      }

      // Validar permissão
      try {
        await permissionsService.requireBillingPermission(req.user.id, tenantId, 'view');
      } catch {
        return res.status(403).json({ error: 'Você não tem permissão' });
      }

      const transactions = await billing.getTransactions(tenantId, limit, offset);
      res.json({ transactions });
    } catch (error) {
      console.error('Erro ao listar transações:', error.message);
      res.status(500).json({ error: error.message });
    }
  });
}

// ============================================================================
// FUNÇÕES HELPER
// ============================================================================

/**
 * Processar webhook da Getnet com validação de tenant
 */
async function handleGetnetWebhook(payload, billing, auditService) {
  const { transaction_id, status, metadata } = payload;

  // 1. Buscar transação no DB
  const transaction = await billing.supabase
    .from('payments')
    .select('id, tenant_id, amount_cents, status as current_status')
    .eq('getnet_payment_id', transaction_id)
    .single();

  if (transaction.error || !transaction.data) {
    console.warn(`Webhook: transação ${transaction_id} não encontrada`);
    return;
  }

  const { data: txn } = transaction;
  const tenantId = txn.tenant_id;

  // 2. Idempotência: já processado?
  if (txn.current_status === status) {
    console.log(`Webhook: transação ${transaction_id} já foi processada com status ${status}`);
    await auditService.log({
      tenantId,
      userId: 'system',
      action: 'webhook_idempotent_skip',
      resourceType: 'webhook',
      metadata: { transaction_id, status }
    });
    return;
  }

  // 3. Atualizar transação
  await billing.supabase
    .from('payments')
    .update({
      status,
      updated_at: new Date().toISOString(),
      metadata: JSON.stringify({ ...metadata, webhook_processed_at: new Date().toISOString() })
    })
    .eq('id', txn.id)
    .eq('tenant_id', tenantId); // Validação adicional de tenant

  // 4. Se aprovado, creditar wallet
  if (status === 'APPROVED') {
    const creditsToAdd = txn.amount_cents / 100; // ajuste conforme sua lógica
    await billing.supabase.rpc('add_wallet_credits', {
      p_tenant_id: tenantId,
      p_amount: creditsToAdd,
      p_reference: transaction_id,
      p_description: `Payment approved via Getnet: ${transaction_id}`
    });
  }

  // 5. Auditar
  await auditService.log({
    tenantId,
    userId: 'system',
    action: 'webhook_processed',
    resourceType: 'webhook',
    resourceId: txn.id,
    oldValue: { status: txn.current_status },
    newValue: { status },
    metadata: { transaction_id, webhook_payload: payload }
  });

  console.log(`Webhook: transação ${transaction_id} processada, novo status ${status}`);
}

export default registerBillingRoutes;
