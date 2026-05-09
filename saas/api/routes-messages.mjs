/**
 * Rotas de Mensageria UAZAPI
 *
 * POST /api/messages/send - Enviar mensagem
 * GET  /api/messages        - Listar mensagens de um chat
 */

/**
 * POST /api/messages/send
 * Enviar mensagem via UAZAPI
 *
 * Request body:
 * {
 *   "chat_id": "string",
 *   "instance_id": "string",
 *   "tenant_id": "string",
 *   "body": "string",
 *   "message_type": "text|image|audio|video|document"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message_id": "uuid",
 *   "status": "sent|pending|failed",
 *   "created_at": "2026-05-08T...",
 *   "timestamp": "2026-05-08T..."
 * }
 */
export async function handleMessageSend(req, res, json, body, supabase) {
  try {
    const { chat_id, instance_id, tenant_id, body: messageBody, message_type = 'text' } = body || {};

    // Validar campos obrigatórios
    if (!chat_id || !instance_id || !tenant_id || !messageBody) {
      return json(res, 400, {
        success: false,
        error: 'chat_id, instance_id, tenant_id e body são obrigatórios'
      }, req);
    }

    // Validar tenant_id (apenas base UUID check)
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant_id)) {
      return json(res, 400, {
        success: false,
        error: 'tenant_id inválido'
      }, req);
    }

    // Obter usuário do JWT
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/, '').trim();

    let userId = null;
    if (token) {
      try {
        const result = await supabase.auth.getUser(token);
        userId = result.data?.user?.id;
      } catch (e) {
        console.warn('[Messages] Falha ao validar token:', e.message);
      }
    }

    // Criar registro de mensagem
    const messageData = {
      tenant_id,
      created_by: userId,
      instance_id,
      chat_id,
      contact_id: null, // Será preenchido depois pelo webhook
      message_type,
      direction: 'outbound',
      body: messageBody.trim(),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('uazapi_messages')
      .insert([messageData])
      .select();

    if (error) {
      console.error('[Messages] Erro ao salvar mensagem:', error);
      return json(res, 500, {
        success: false,
        error: 'Erro ao salvar mensagem'
      }, req);
    }

    const message = data?.[0];

    // IMPORTANTE: Aqui você faria a chamada real para UAZAPI
    // Para este PoC, apenas salvamos no banco e retornamos success
    // await uazapiClient.sendMessage({ instance_id, chat_id, body: messageBody })

    console.log(`[Messages] Mensagem enviada | tenant: ${tenant_id} | chat: ${chat_id} | id: ${message.id}`);

    return json(res, 201, {
      success: true,
      message_id: message.id,
      status: message.status,
      created_at: message.created_at,
      timestamp: new Date().toISOString()
    }, req);

  } catch (error) {
    console.error('[Messages Send] Erro:', error);
    return json(res, 500, {
      success: false,
      error: error.message || 'Erro ao enviar mensagem'
    }, req);
  }
}

/**
 * GET /api/messages
 * Listar mensagens de um chat com paginação
 *
 * Query params:
 * - chat_id (obrigatório)
 * - instance_id (obrigatório)
 * - tenant_id (obrigatório)
 * - limit (default 50, max 100)
 * - offset (default 0)
 *
 * Response:
 * {
 *   "success": true,
 *   "messages": [...],
 *   "total": number,
 *   "has_more": boolean,
 *   "unread_count": number
 * }
 */
export async function handleMessageList(req, res, json, supabase) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const chatId = url.searchParams.get('chat_id');
    const instanceId = url.searchParams.get('instance_id');
    const tenantId = url.searchParams.get('tenant_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validar parâmetros
    if (!chatId || !instanceId || !tenantId) {
      return json(res, 400, {
        success: false,
        error: 'chat_id, instance_id e tenant_id são obrigatórios'
      }, req);
    }

    // Contar total de mensagens
    const { count, error: countError } = await supabase
      .from('uazapi_messages')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('chat_id', chatId);

    if (countError) {
      console.error('[Messages List] Erro ao contar:', countError);
      return json(res, 500, {
        success: false,
        error: 'Erro ao contar mensagens'
      }, req);
    }

    // Buscar mensagens
    const { data: messages, error } = await supabase
      .from('uazapi_messages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Messages List] Erro ao buscar:', error);
      return json(res, 500, {
        success: false,
        error: 'Erro ao buscar mensagens'
      }, req);
    }

    // Contar não lidas (status = 'sent' ou 'pending' para mensagens inbound)
    const unreadCount = messages.filter(
      m => m.direction === 'inbound' && ['sent', 'pending'].includes(m.status)
    ).length;

    const hasMore = offset + limit < (count || 0);

    console.log(`[Messages List] tenant: ${tenantId} | chat: ${chatId} | total: ${count} | offset: ${offset}`);

    return json(res, 200, {
      success: true,
      messages: messages || [],
      total: count || 0,
      has_more: hasMore,
      unread_count: unreadCount,
      limit,
      offset
    }, req);

  } catch (error) {
    console.error('[Messages List] Erro:', error);
    return json(res, 500, {
      success: false,
      error: error.message || 'Erro ao listar mensagens'
    }, req);
  }
}

/**
 * Router principal para rotas de mensagens
 */
export async function handleMessageRoutes(req, res, json, supabase, body) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const { method } = req;

  // POST /api/messages/send
  if (method === 'POST' && pathname === '/api/messages/send') {
    return handleMessageSend(req, res, json, body, supabase);
  }

  // GET /api/messages
  if (method === 'GET' && pathname === '/api/messages') {
    return handleMessageList(req, res, json, supabase);
  }

  return null;
}
