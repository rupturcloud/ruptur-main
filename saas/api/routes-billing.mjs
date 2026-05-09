/**
 * Rotas de Billing — Integração Webhooks + Refunds + Métricas
 *
 * Funções exportadas para uso no gateway.mjs
 * - handleWebhookGetnet(req, res, webhookService, auditService)
 * - getWebhookHistory(req, res, webhookService)
 * - getRefundHistory(req, res, webhookService)
 * - getMetricsStats(req, res, metricsService)
 * - getHealthCheck(req, res, metricsService)
 * - getAuditReport(req, res, metricsService)
 */

export async function handleWebhookGetnet(req, res, webhookService, auditService, pathname, json) {
  if (pathname !== '/api/webhooks/getnet' || req.method !== 'POST') {
    return null;
  }

  const rawBodyChunks = [];
  req.on('data', c => rawBodyChunks.push(c));
  req.on('end', async () => {
    const rawBody = Buffer.concat(rawBodyChunks).toString();

    // Validação de autenticidade do webhook.
    // Preferência: HMAC via GETNET_WEBHOOK_SECRET, quando a adquirente enviar assinatura.
    // Mitigação para Getnet Plataforma Digital: o Portal Minha Conta permite configurar
    // URLs de callback, mas nem sempre expõe segredo/header de assinatura. Nesse caso,
    // aceitar callback sem assinatura apenas com flag explícita e auditar/idempotenciar.
    const WEBHOOK_SECRET = process.env.GETNET_WEBHOOK_SECRET || '';
    const allowUnsignedWebhook = process.env.GETNET_WEBHOOK_ALLOW_UNSIGNED === 'true';
    const signature = req.headers['x-getnet-signature'] || req.headers['x-signature'] || '';

    if (!WEBHOOK_SECRET && process.env.NODE_ENV === 'production' && !allowUnsignedWebhook) {
      return json(res, 503, { error: 'GETNET_WEBHOOK_SECRET não configurado' }, null);
    }

    let isValid = true;
    if (WEBHOOK_SECRET && !signature) {
      isValid = false;
    } else if (WEBHOOK_SECRET && signature) {
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
      return json(res, 401, { error: 'Invalid signature' }, null);
    }

    let parsedBody;
    try { parsedBody = JSON.parse(rawBody); } catch { parsedBody = {}; }

    json(res, 200, { ok: true }, null);

    try {
      const { external_event_id, event_type, data: payload } = parsedBody;
      const tenantId = parsedBody.tenant_id || payload?.tenant_id;

      if (!tenantId || !external_event_id) {
        console.warn('[Webhook] Missing tenantId or external_event_id');
        return;
      }

      const webhook = await webhookService.processWebhookIdempotent(
        tenantId,
        external_event_id,
        event_type || 'payment_status_update',
        payload
      );

      if (webhook.status === 'success' && event_type === 'payment_status_update') {
        await webhookService.processPaymentStatusUpdate(
          tenantId,
          payload.transaction_id,
          payload.status,
          webhook.id
        );
      }

      if (event_type === 'chargeback' && webhook.status === 'success') {
        await webhookService.processChargeback(
          tenantId,
          payload.original_payment_id,
          payload.amount,
          webhook.id
        );
      }

      console.log('[Webhook] Processado:', { tenantId, external_event_id, status: webhook.status });
    } catch (e) {
      console.error('[Webhook] Erro:', e.message);
    }
  });
}

export async function getWebhookHistory(req, res, webhookService, tenantId, json) {
  try {
    const limit = parseInt(new URL(req.url, 'http://localhost').searchParams.get('limit') || '50');
    const history = await webhookService.getWebhookHistory(tenantId, limit);
    return json(res, 200, { webhooks: history }, null);
  } catch (e) {
    return json(res, 500, { error: e.message }, null);
  }
}

export async function getRefundHistory(req, res, webhookService, tenantId, json) {
  try {
    const limit = parseInt(new URL(req.url, 'http://localhost').searchParams.get('limit') || '50');
    const refunds = await webhookService.getRefundHistory(tenantId, limit);
    return json(res, 200, { refunds }, null);
  } catch (e) {
    return json(res, 500, { error: e.message }, null);
  }
}

export async function getMetricsStats(req, res, metricsService, tenantId, json) {
  try {
    const startDate = new URL(req.url, 'http://localhost').searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new URL(req.url, 'http://localhost').searchParams.get('endDate') || new Date().toISOString();

    const webhookStats = await metricsService.getWebhookStats(tenantId, startDate, endDate);
    const paymentStats = await metricsService.getPaymentStats(tenantId, startDate, endDate);

    return json(res, 200, { webhookStats, paymentStats }, null);
  } catch (e) {
    return json(res, 500, { error: e.message }, null);
  }
}

export async function getHealthCheck(req, res, metricsService, tenantId, json) {
  try {
    const health = await metricsService.getHealthCheck(tenantId);
    return json(res, 200, health, null);
  } catch (e) {
    return json(res, 500, { error: e.message }, null);
  }
}

export async function getAuditReport(req, res, metricsService, tenantId, json) {
  try {
    const startDate = new URL(req.url, 'http://localhost').searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new URL(req.url, 'http://localhost').searchParams.get('endDate') || new Date().toISOString();

    const report = await metricsService.getAuditReport(tenantId, startDate, endDate);
    return json(res, 200, { auditReport: report }, null);
  } catch (e) {
    return json(res, 500, { error: e.message }, null);
  }
}

/**
 * Monitoramento da fila de webhooks (admin only)
 */
export async function getWebhookQueueStatus(req, res, webhookQueueIntegration, json) {
  try {
    if (!webhookQueueIntegration) {
      return json(res, 503, { error: 'Webhook queue not available' }, null);
    }

    const status = await webhookQueueIntegration.getQueueStatus();
    const dlq = await webhookQueueIntegration.getDeadLetterQueue();

    return json(res, 200, {
      queueStatus: status,
      deadLetterQueue: dlq,
      timestamp: new Date().toISOString(),
    }, null);
  } catch (e) {
    return json(res, 500, { error: e.message }, null);
  }
}

// ========================================================================
// PLANOS E SUBSCRIPTION — Tier 1 Billing (Trial, Starter, Pro)
// ========================================================================

/**
 * GET /api/billing/plans
 * Retorna todos os planos disponíveis com features hardcodeadas
 */
export function getPlans() {
  return [
    {
      id: 'trial',
      name: 'Trial',
      description: 'Grátis por 7 dias',
      price: { currency: 'BRL', amount: 500, formatted: 'R$ 5,00' },
      credits: 100,
      maxInstances: 1,
      features: {
        canUseInbox: false,
        canUseWorkflows: false,
        canUseAnalytics: false,
        canAccessAPI: false,
        maxCampaignsActive: 1,
        support: 'email',
      },
      displayOrder: 0,
    },
    {
      id: 'starter',
      name: 'Starter',
      description: 'Ideal para começar com automação',
      price: { currency: 'BRL', amount: 9900, formatted: 'R$ 99,00' },
      credits: 10000,
      maxInstances: 5,
      features: {
        canUseInbox: true,
        canUseWorkflows: 'basic',
        canUseAnalytics: false,
        canAccessAPI: false,
        maxCampaignsActive: 10,
        support: 'email',
      },
      displayOrder: 1,
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Para quem quer escalar',
      price: { currency: 'BRL', amount: 29900, formatted: 'R$ 299,00' },
      credits: 50000,
      maxInstances: 20,
      features: {
        canUseInbox: true,
        canUseWorkflows: 'advanced',
        canUseAnalytics: true,
        canAccessAPI: true,
        maxCampaignsActive: 50,
        support: 'priority',
      },
      displayOrder: 2,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Solução customizada para grandes operações',
      price: { currency: 'BRL', amount: null, formatted: 'Personalizado' },
      credits: null,
      maxInstances: 999,
      features: {
        canUseInbox: true,
        canUseWorkflows: 'advanced',
        canUseAnalytics: true,
        canAccessAPI: true,
        maxCampaignsActive: 9999,
        support: 'dedicated',
        whiteLabel: true,
      },
      displayOrder: 3,
    },
  ];
}

/**
 * POST /api/billing/subscribe
 * Cria subscription (trial direto, ou redireciona para checkout)
 *
 * Request: { planId: 'trial' | 'starter' | 'pro' | 'enterprise', paymentMethodId?: 'pm_xxx' }
 * Response: { subscriptionId, status, planId, currentPeriodStart, currentPeriodEnd }
 */
export async function subscribeUser(req, res, tenantId, supabase, json) {
  try {
    const body = JSON.parse(req.headers['x-body'] || '{}');
    const { planId, paymentMethodId } = body;

    if (!planId) {
      return json(res, 400, { error: 'planId é obrigatório' }, null);
    }

    const plans = getPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      return json(res, 400, { error: 'Plano não encontrado' }, null);
    }

    // Se trial, criar subscription direto
    if (planId === 'trial') {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      const { data, error } = await supabase
        .from('subscriptions')
        .insert([
          {
            tenant_id: tenantId,
            plan_id: planId,
            status: 'authorized',
            current_period_start: new Date().toISOString(),
            current_period_end: trialEnd.toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('[Subscribe] Erro ao criar trial subscription:', error);
        return json(res, 500, { error: 'Falha ao criar subscription' }, null);
      }

      return json(res, 201, {
        subscriptionId: data.id,
        status: data.status,
        planId: data.plan_id,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
      }, null);
    }

    // Se não trial, redireciona para checkout
    return json(res, 200, {
      redirect: true,
      checkoutUrl: `/checkout?plan=${planId}`,
      message: 'Redirecionar para checkout Stripe/Getnet',
    }, null);
  } catch (e) {
    console.error('[Subscribe] Erro:', e.message);
    return json(res, 500, { error: e.message }, null);
  }
}

/**
 * GET /api/billing/subscription
 * Retorna status atual da subscription do tenant
 */
export async function getSubscription(req, res, tenantId, supabase, json) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[GetSubscription] Erro:', error);
      return json(res, 500, { error: 'Falha ao buscar subscription' }, null);
    }

    if (!data) {
      return json(res, 200, { subscription: null }, null);
    }

    return json(res, 200, { subscription: data }, null);
  } catch (e) {
    return json(res, 500, { error: e.message }, null);
  }
}

/**
 * GET /api/billing/features
 * Retorna features desbloqueadas para o tenant baseado no plano
 */
export async function getFeatures(req, res, tenantId, supabase, json) {
  try {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[GetFeatures] Erro:', error);
      return json(res, 500, { error: 'Falha ao buscar features' }, null);
    }

    const planId = subscription?.plan_id || 'trial';
    const plans = getPlans();
    const plan = plans.find((p) => p.id === planId);

    if (!plan) {
      return json(res, 200, { features: {}, planId: 'trial' }, null);
    }

    return json(res, 200, {
      planId,
      features: plan.features,
      maxInstances: plan.maxInstances,
      credits: plan.credits,
    }, null);
  } catch (e) {
    return json(res, 500, { error: e.message }, null);
  }
}

/**
 * POST /api/billing/validate-feature
 * Verifica se um feature está desbloqueado
 *
 * Request: { feature: 'canUseInbox' | 'canUseWorkflows', ... }
 * Response: { allowed: boolean, reason?: string }
 */
export async function validateFeature(req, res, tenantId, supabase, json) {
  try {
    const body = JSON.parse(req.headers['x-body'] || '{}');
    const { feature } = body;

    if (!feature) {
      return json(res, 400, { error: 'feature é obrigatório' }, null);
    }

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return json(res, 500, { error: 'Falha ao validar feature' }, null);
    }

    const planId = subscription?.plan_id || 'trial';
    const plans = getPlans();
    const plan = plans.find((p) => p.id === planId);

    if (!plan) {
      return json(res, 200, { allowed: false, reason: 'Plano não encontrado' }, null);
    }

    const featureValue = plan.features[feature];
    const allowed = featureValue !== false && featureValue !== undefined;

    return json(res, 200, {
      allowed,
      feature,
      planId,
      value: featureValue,
      reason: !allowed ? `Feature ${feature} não disponível no plano ${planId}` : undefined,
    }, null);
  } catch (e) {
    return json(res, 500, { error: e.message }, null);
  }
}

/**
 * Handler de webhook com Job Queue (versão confiável)
 * Enfileira o webhook para processamento assíncrono com retry automático
 */
export async function handleWebhookGetnetWithQueue(req, res, webhookQueueIntegration, pathname, json) {
  if (pathname !== '/api/webhooks/getnet' || req.method !== 'POST') {
    return null;
  }

  const rawBodyChunks = [];
  req.on('data', c => rawBodyChunks.push(c));
  req.on('end', async () => {
    const rawBody = Buffer.concat(rawBodyChunks).toString();

    const WEBHOOK_SECRET = process.env.GETNET_WEBHOOK_SECRET || '';
    const allowUnsignedWebhook = process.env.GETNET_WEBHOOK_ALLOW_UNSIGNED === 'true';
    const signature = req.headers['x-getnet-signature'] || req.headers['x-signature'] || '';

    if (!WEBHOOK_SECRET && process.env.NODE_ENV === 'production' && !allowUnsignedWebhook) {
      return json(res, 503, { error: 'GETNET_WEBHOOK_SECRET não configurado' }, null);
    }

    let isValid = true;
    if (WEBHOOK_SECRET && !signature) {
      isValid = false;
    } else if (WEBHOOK_SECRET && signature) {
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
      return json(res, 401, { error: 'Invalid signature' }, null);
    }

    let parsedBody;
    try { parsedBody = JSON.parse(rawBody); } catch { parsedBody = {}; }

    const { external_event_id, event_type, data: payload } = parsedBody;
    const tenantId = parsedBody.tenant_id || payload?.tenant_id;

    if (!tenantId || !external_event_id) {
      console.warn('[Webhook:Queue] Missing tenantId or external_event_id');
      return json(res, 400, { error: 'Missing tenantId or external_event_id' }, null);
    }

    try {
      const result = await webhookQueueIntegration.enqueuePaymentWebhook({
        tenantId,
        externalEventId: external_event_id,
        eventType: event_type || 'payment_status_update',
        payload,
        headers: {
          'x-signature': signature,
          'x-getnet-signature': req.headers['x-getnet-signature'],
        },
      });

      console.log('[Webhook:Queue] Enfileirado:', {
        tenantId,
        external_event_id,
        jobId: result.jobId,
      });

      return json(res, 202, {
        ok: true,
        received: true,
        queued: true,
        jobId: result.jobId,
        webhookId: result.webhookId,
        status: 'processing',
      }, null);
    } catch (error) {
      console.error('[Webhook:Queue] Erro ao enfileirar:', error.message);
      return json(res, 500, {
        ok: false,
        error: 'Failed to queue webhook',
        message: error.message,
      }, null);
    }
  });
}
