/**
 * Processadores de Webhook
 *
 * Implementa validação de assinatura e processamento de webhooks
 * de diferentes provedores (Getnet, etc)
 */

import { createResponse } from '../middleware/auth.js';

/**
 * Parser de body bruto para validação de assinatura
 * Retorna body parseado mantendo o bruto para validação
 */
export async function parseRawBody(req) {
  return new Promise((resolve, reject) => {
    let rawData = '';

    req.on('data', chunk => {
      rawData += chunk.toString();
    });

    req.on('end', () => {
      try {
        const body = JSON.parse(rawData);
        // Injetar body bruto para validação de assinatura
        body._rawBody = rawData;
        resolve(body);
      } catch (error) {
        reject(new Error('Invalid JSON in webhook body'));
      }
    });

    req.on('error', reject);
  });
}

/**
 * Handler para webhooks Getnet
 * Endpoint: POST /api/webhooks/getnet
 */
export async function handleGetnetWebhook(req, res, url, billingService) {
  try {
    // Parse body com validação de assinatura
    const body = await parseRawBody(req);
    const rawBody = body._rawBody;
    delete body._rawBody;

    const headers = req.headers;

    console.log('[Webhook:Getnet] Recebido:', {
      event: body.event || body.type,
      paymentId: body.payment_id || body.data?.payment_id,
      timestamp: new Date().toISOString(),
    });

    // Processar webhook
    const result = await billingService.handleWebhook(body, {}, {
      'x-signature': headers['x-signature'],
      'X-Signature': headers['X-Signature'],
      '_rawBody': rawBody,
    });

    // Log de sucesso
    console.log('[Webhook:Getnet] Processado com sucesso:', result);

    return createResponse(res, 200, {
      ok: true,
      received: true,
      action: result.action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Webhook:Getnet] Erro ao processar:', error.message);

    // Não expor detalhes de erro em resposta (segurança)
    const statusCode = error.message.includes('signature') ? 401 : 500;

    return createResponse(res, statusCode, {
      ok: false,
      error: error.message.includes('signature')
        ? 'Webhook signature validation failed'
        : 'Failed to process webhook',
    });
  }
}

/**
 * Handler para webhooks de teste (dev mode)
 * Endpoint: POST /api/webhooks/test
 */
export async function handleTestWebhook(req, res, url) {
  try {
    const body = await parseRawBody(req);

    console.log('[Webhook:Test] Recebido:', body);

    return createResponse(res, 200, {
      ok: true,
      received: true,
      echo: body,
      headers: {
        'x-signature': req.headers['x-signature'],
        'user-agent': req.headers['user-agent'],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Webhook:Test] Erro:', error.message);
    return createResponse(res, 400, { error: error.message });
  }
}

/**
 * Status de webhooks (para monitoramento)
 * Endpoint: GET /api/webhooks/status
 */
export async function handleWebhookStatus(req, res, url) {
  return createResponse(res, 200, {
    status: 'ok',
    webhooks: {
      getnet: {
        endpoint: '/api/webhooks/getnet',
        method: 'POST',
        validation: 'HMAC-SHA256',
        status: process.env.GETNET_WEBHOOK_SECRET ? '✅ Configured' : '⚠️ Not configured',
      },
      test: {
        endpoint: '/api/webhooks/test',
        method: 'POST',
        validation: 'None (dev only)',
        status: '✅ Available',
      },
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Criar roteador de webhooks
 */
export function createWebhookRouter(billingService) {
  return {
    '/api/webhooks/getnet': async (req, res, url) => {
      if (req.method !== 'POST') {
        return createResponse(res, 405, { error: 'Method not allowed' });
      }
      return handleGetnetWebhook(req, res, url, billingService);
    },

    '/api/webhooks/test': async (req, res, url) => {
      if (req.method !== 'POST') {
        return createResponse(res, 405, { error: 'Method not allowed' });
      }
      return handleTestWebhook(req, res, url);
    },

    '/api/webhooks/status': async (req, res, url) => {
      if (req.method !== 'GET') {
        return createResponse(res, 405, { error: 'Method not allowed' });
      }
      return handleWebhookStatus(req, res, url);
    },
  };
}

/**
 * Encontrar handler de webhook
 */
export function findWebhookHandler(pathname, webhookRouter) {
  return webhookRouter[pathname] || null;
}
