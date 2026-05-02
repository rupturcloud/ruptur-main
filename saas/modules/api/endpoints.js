/**
 * API Endpoints - Rotas com autenticação e multi-tenant isolation
 *
 * Todas as rotas aqui:
 * - Requerem JWT válido (extraído pelo authMiddleware)
 * - Usam tenantId da sessão (não de query/header)
 * - São protegidas contra rate limiting
 */

import { createResponse, parseBody } from '../../middleware/auth.js';

// ============================================================================
// 1. WALLET - Gerenciar créditos do tenant
// ============================================================================

/**
 * GET /api/wallet/balance
 * Retorna saldo de créditos do tenant autenticado
 */
export async function handleWalletBalance(req, res, url, supabase) {
  const { tenantId } = req.session;

  try {
    // Buscar saldo do tenant
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('tenant_id, balance, updated_at')
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const balance = wallet?.balance || 0;

    return createResponse(res, 200, {
      tenantId,
      balance,
      updated_at: wallet?.updated_at || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Wallet:Balance] Error:', error);
    return createResponse(res, 500, {
      error: 'Failed to fetch wallet balance',
      message: error.message,
    });
  }
}

/**
 * GET /api/wallet/transactions
 * Retorna histórico de transações do tenant
 */
export async function handleWalletTransactions(req, res, url, supabase) {
  const { tenantId } = req.session;
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 100);
  const offset = parseInt(url.searchParams.get('offset')) || 0;

  try {
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return createResponse(res, 200, {
      tenantId,
      count: transactions.length,
      limit,
      offset,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error('[Wallet:Transactions] Error:', error);
    return createResponse(res, 500, {
      error: 'Failed to fetch transactions',
      message: error.message,
    });
  }
}

// ============================================================================
// 2. INSTANCES - Gerenciar instâncias de providers
// ============================================================================

/**
 * GET /api/instances
 * Lista todas as instâncias do tenant
 */
export async function handleListInstances(req, res, url, supabase, providerManager) {
  const { tenantId } = req.session;

  try {
    // Buscar todos os providers do tenant
    const { data: providers, error: providersError } = await supabase
      .from('tenant_providers')
      .select('id, name, provider_name, connected_at')
      .eq('tenant_id', tenantId);

    if (providersError) throw providersError;

    const instances = [];

    // Para cada provider, buscar instâncias
    for (const provider of providers || []) {
      try {
        const { data: providerInstances, error: instancesError } = await supabase
          .from('instance_registry')
          .select('id, remote_instance_id, phone_number, status, last_activity')
          .eq('tenant_provider_id', provider.id);

        if (instancesError) throw instancesError;

        instances.push({
          provider: provider.provider_name,
          providerId: provider.id,
          connected_at: provider.connected_at,
          instances: providerInstances || [],
          count: providerInstances?.length || 0,
        });
      } catch (error) {
        console.warn(`[ListInstances] Provider ${provider.provider_name} error:`, error);
        instances.push({
          provider: provider.provider_name,
          providerId: provider.id,
          error: error.message,
        });
      }
    }

    return createResponse(res, 200, {
      tenantId,
      providers_count: providers?.length || 0,
      total_instances: instances.reduce((sum, p) => sum + (p.count || 0), 0),
      providers: instances,
    });
  } catch (error) {
    console.error('[Instances:List] Error:', error);
    return createResponse(res, 500, {
      error: 'Failed to list instances',
      message: error.message,
    });
  }
}

/**
 * GET /api/instances/:id
 * Retorna detalhes de uma instância específica
 */
export async function handleGetInstance(req, res, url, supabase) {
  const { tenantId } = req.session;
  const instanceId = url.pathname.split('/').pop();

  try {
    // Buscar instância garantindo que pertence ao tenant
    const { data: instance, error } = await supabase
      .from('instance_registry')
      .select(`
        id,
        remote_instance_id,
        phone_number,
        status,
        platform,
        last_activity,
        metadata,
        tenant_provider:tenant_provider_id (
          tenant_id,
          provider_name
        )
      `)
      .eq('id', instanceId)
      .single();

    if (error) throw error;

    // Validar isolamento de tenant
    if (instance?.tenant_provider?.tenant_id !== tenantId) {
      return createResponse(res, 403, { error: 'Access denied to this instance' });
    }

    return createResponse(res, 200, {
      instance,
    });
  } catch (error) {
    console.error('[Instances:Get] Error:', error);
    return createResponse(res, 404, {
      error: 'Instance not found',
      message: error.message,
    });
  }
}

// ============================================================================
// 3. MESSAGES - Enviar mensagens via provider
// ============================================================================

/**
 * POST /api/messages/send
 * Envia mensagem via provider configurado
 */
export async function handleSendMessage(req, res, url, supabase, providerManager) {
  const { tenantId, userId } = req.session;

  try {
    const body = await parseBody(req);
    const { instanceId, to, type = 'text', content, mediaUrl } = body;

    if (!instanceId || !to || !content) {
      return createResponse(res, 400, {
        error: 'Missing required fields: instanceId, to, content',
      });
    }

    // Validar que a instância pertence ao tenant
    const { data: instance, error: instanceError } = await supabase
      .from('instance_registry')
      .select(`
        id,
        remote_instance_id,
        status,
        tenant_provider:tenant_provider_id (
          tenant_id,
          provider_name
        )
      `)
      .eq('id', instanceId)
      .single();

    if (instanceError || !instance) {
      return createResponse(res, 404, { error: 'Instance not found' });
    }

    if (instance.tenant_provider.tenant_id !== tenantId) {
      return createResponse(res, 403, { error: 'Access denied to this instance' });
    }

    // Validar que instância está conectada
    if (instance.status !== 'connected') {
      return createResponse(res, 400, { error: 'Instance is not connected' });
    }

    // Verificar créditos do tenant
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('tenant_id', tenantId)
      .single();

    if (!wallet || wallet.balance < 10) {
      return createResponse(res, 402, {
        error: 'Insufficient credits',
        required: 10,
        available: wallet?.balance || 0,
      });
    }

    // Enviar mensagem via provider
    const result = await providerManager.sendMessage(
      instance.tenant_provider.provider_name,
      instance.remote_instance_id,
      {
        to,
        type,
        content,
        mediaUrl,
      }
    );

    // Debitar créditos
    await supabase
      .from('wallet_transactions')
      .insert({
        tenant_id: tenantId,
        type: 'debit',
        amount: 10,
        description: `Message sent to ${to}`,
        reference: result.messageId,
      });

    // Log de auditoria
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action: 'send_message',
        resource: 'instance',
        resource_id: instanceId,
        details: { to, type, provider: instance.tenant_provider.provider_name },
        status: 'success',
      });

    return createResponse(res, 200, {
      messageId: result.messageId,
      status: 'sent',
      to,
      type,
      creditsDeducted: 10,
    });
  } catch (error) {
    console.error('[Messages:Send] Error:', error);
    return createResponse(res, 500, {
      error: 'Failed to send message',
      message: error.message,
    });
  }
}

// ============================================================================
// 4. HEALTH - Status do sistema
// ============================================================================

/**
 * GET /api/health
 * Health check autenticado (valida JWT e tenant)
 */
export async function handleHealthCheck(req, res, url, supabase) {
  const { tenantId, userId, role } = req.session;

  try {
    return createResponse(res, 200, {
      ok: true,
      authenticated: true,
      tenantId,
      userId,
      role,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return createResponse(res, 500, { error: 'Health check failed' });
  }
}

/**
 * Criar roteador com todos os endpoints
 */
export function createAPIRouter(supabase, providerManager) {
  return {
    // Wallet
    '/api/wallet/balance': async (req, res, url) => {
      if (req.method !== 'GET') return createResponse(res, 405, { error: 'Method not allowed' });
      return handleWalletBalance(req, res, url, supabase);
    },

    '/api/wallet/transactions': async (req, res, url) => {
      if (req.method !== 'GET') return createResponse(res, 405, { error: 'Method not allowed' });
      return handleWalletTransactions(req, res, url, supabase);
    },

    // Instances
    '/api/instances': async (req, res, url) => {
      if (req.method === 'GET') {
        return handleListInstances(req, res, url, supabase, providerManager);
      }
      return createResponse(res, 405, { error: 'Method not allowed' });
    },

    '/api/instances/:id': async (req, res, url) => {
      if (req.method === 'GET') {
        return handleGetInstance(req, res, url, supabase);
      }
      return createResponse(res, 405, { error: 'Method not allowed' });
    },

    // Messages
    '/api/messages/send': async (req, res, url) => {
      if (req.method !== 'POST') return createResponse(res, 405, { error: 'Method not allowed' });
      return handleSendMessage(req, res, url, supabase, providerManager);
    },

    // Health
    '/api/health': async (req, res, url) => {
      if (req.method !== 'GET') return createResponse(res, 405, { error: 'Method not allowed' });
      return handleHealthCheck(req, res, url, supabase);
    },
  };
}

/**
 * Encontrar handler baseado no path
 */
export function findAPIHandler(pathname, apiRouter) {
  // Verificar rotas exatas
  if (apiRouter[pathname]) {
    return apiRouter[pathname];
  }

  // Verificar rotas com parâmetros (e.g., /api/instances/:id)
  const parts = pathname.split('/');
  if (parts[2] === 'instances' && parts[3]) {
    // Rota: /api/instances/:id
    return apiRouter['/api/instances/:id'];
  }

  return null;
}
