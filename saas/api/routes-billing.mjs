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

    // Validação HMAC
    const WEBHOOK_SECRET = process.env.GETNET_WEBHOOK_SECRET || '';
    const signature = req.headers['x-getnet-signature'] || req.headers['x-signature'] || '';

    if (!WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
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
