/**
 * Exemplos de integração com middlewares de segurança
 * Como usar Google Auth + JWT + Multi-tenant em seus endpoints
 */

import { createResponse, parseBody } from '../middleware/auth.js';

/**
 * Exemplo 1: Endpoint de Wallet (com autenticação)
 */
export async function handleWalletBalanceRoute(req, res, url) {
  // req.session já foi injetado pelo middleware
  const { tenantId, userId } = req.session;

  try {
    // TODO: Buscar saldo do wallet no Supabase
    const balance = await getWalletBalance(tenantId);

    createResponse(res, 200, {
      balance,
      tenantId,
      userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Wallet] Error:', error);
    createResponse(res, 500, { error: error.message });
  }
}

/**
 * Exemplo 2: Enviar mensagem (com validação de provider)
 */
export async function handleSendMessageRoute(req, res, url, providerManager) {
  const { tenantId, providerId } = req.session;

  try {
    const body = await parseBody(req);

    // Valida que o provider pertence ao tenant
    if (!providerId.includes(body.provider)) {
      return createResponse(res, 403, {
        error: 'Provider não configurado para seu tenant',
      });
    }

    // Busca credenciais do provider (do Supabase)
    const credentials = await getTenantProviderCredentials(
      tenantId,
      body.provider
    );

    // Usa provider agnóstico
    const result = await providerManager.sendMessage(
      body.provider,
      credentials,
      body.instanceId,
      {
        to: body.to,
        type: body.type,
        content: body.content,
      }
    );

    // Log na auditoria
    await logAuditEvent({
      tenantId,
      userId: req.session.userId,
      action: 'send_message',
      resource: 'instance',
      resourceId: body.instanceId,
      details: { provider: body.provider, to: body.to },
      status: 'success',
    });

    createResponse(res, 200, result);
  } catch (error) {
    console.error('[SendMessage] Error:', error);
    createResponse(res, 500, { error: error.message });
  }
}

/**
 * Exemplo 3: Listar Instâncias (com isolamento de tenant)
 */
export async function handleListInstancesRoute(req, res, url, providerManager) {
  const { tenantId, providerId } = req.session;

  try {
    // Busca todos os providers do tenant
    const tenantProviders = await getTenantProviders(tenantId);

    const instances = [];

    for (const provider of tenantProviders) {
      try {
        const creds = await getTenantProviderCredentials(tenantId, provider.name);

        const providerInstances = await providerManager.listInstances(
          provider.name,
          creds
        );

        instances.push({
          provider: provider.name,
          count: providerInstances.length,
          instances: providerInstances,
        });
      } catch (error) {
        console.warn(`[ListInstances] Provider ${provider.name} error:`, error);
        instances.push({
          provider: provider.name,
          error: error.message,
        });
      }
    }

    createResponse(res, 200, {
      tenantId,
      providers: providerId,
      instances,
    });
  } catch (error) {
    console.error('[ListInstances] Error:', error);
    createResponse(res, 500, { error: error.message });
  }
}

/**
 * Exemplo 4: Webhook de Provider (com validação de assinatura)
 */
export async function handleProviderWebhookRoute(req, res, url) {
  try {
    const body = await parseBody(req);

    // TODO: Validar assinatura do webhook
    // const isValid = verifyWebhookSignature(body, req.headers['x-signature']);
    // if (!isValid) return createResponse(res, 401, { error: 'Invalid signature' });

    const { provider, instanceId, event, data } = body;

    // Busca tenant a partir do instanceId
    const tenantProvider = await getTenantProviderByInstance(
      provider,
      instanceId
    );

    // Log no histórico (DNA)
    await updateInstanceDNA(instanceId, {
      type: event,
      status: data.status,
      timestamp: new Date().toISOString(),
      metadata: data,
    });

    // Log de auditoria
    await logAuditEvent({
      tenantId: tenantProvider.tenantId,
      action: `webhook_${event}`,
      resource: 'instance',
      resourceId: instanceId,
      details: { provider, data },
      status: 'success',
    });

    createResponse(res, 200, { received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    createResponse(res, 500, { error: error.message });
  }
}

/**
 * Helpers (implementar com Supabase)
 */

async function getWalletBalance(tenantId) {
  // TODO: SELECT balance FROM wallets WHERE tenant_id = ?
  return { credits: 1000, usd: 50.00 };
}

async function getTenantProviderCredentials(tenantId, provider) {
  // TODO: SELECT credentials_ref FROM tenant_providers
  //       WHERE tenant_id = ? AND provider = ?
  //       THEN decrypt from Supabase Vault
  return {
    serverUrl: 'https://tiatendeai.uazapi.com',
    adminToken: 'xxx',
  };
}

async function getTenantProviders(tenantId) {
  // TODO: SELECT * FROM tenant_providers WHERE tenant_id = ?
  return [
    { name: 'uazapi', accountId: 'xxx' },
  ];
}

async function getTenantProviderByInstance(provider, instanceId) {
  // TODO: SELECT tp.* FROM tenant_providers tp
  //       JOIN instance_registry ir ON tp.id = ir.tenant_provider_id
  //       WHERE ir.remote_instance_id = ?
  return {
    tenantId: 'tenant-123',
    provider,
  };
}

async function updateInstanceDNA(token, event) {
  // TODO: Atualizar arquivo ou tabela de DNA da instância
}

async function logAuditEvent(event) {
  // TODO: INSERT INTO audit_logs VALUES (...)
  console.log('[Audit]', event);
}

/**
 * Exemplo de Roteador
 */
export function createRouterWithSecurity(providerManager) {
  return {
    '/api/wallet/balance': async (req, res, url) => {
      if (req.method !== 'GET') {
        return createResponse(res, 405, { error: 'Method not allowed' });
      }
      return handleWalletBalanceRoute(req, res, url);
    },

    '/api/instances': async (req, res, url) => {
      if (req.method !== 'GET') {
        return createResponse(res, 405, { error: 'Method not allowed' });
      }
      return handleListInstancesRoute(req, res, url, providerManager);
    },

    '/api/send-message': async (req, res, url) => {
      if (req.method !== 'POST') {
        return createResponse(res, 405, { error: 'Method not allowed' });
      }
      return handleSendMessageRoute(req, res, url, providerManager);
    },

    '/api/webhook': async (req, res, url) => {
      if (req.method !== 'POST') {
        return createResponse(res, 405, { error: 'Method not allowed' });
      }
      return handleProviderWebhookRoute(req, res, url);
    },
  };
}
