/**
 * Rotas de Integração Bubble
 * Gerencia autenticação e token para Bubble Inbox dentro de Ruptur
 *
 * POST /api/bubble/token - Gera token JWT para acesso ao Bubble
 * POST /api/bubble/validate - Valida token OU webhook UAZAPI
 *   - Com X-Token header: validação de token Bubble
 *   - Com body {event, instance_id}: webhook UAZAPI
 */

/**
 * POST /api/bubble/token
 * Gera um token JWT que prova que o usuário tem permissão de acessar Bubble
 *
 * Request headers:
 *   Authorization: Bearer <JWT_SUPABASE>
 *
 * Response:
 * {
 *   "bubble_url": "https://uazapigo-multiatendimento.bubbleapps.io?token=...",
 *   "token": "eyJhbGc...",
 *   "expires_in": 3600
 * }
 */
export async function handleBubbleToken(req, res, json, supabase) {
  try {
    // 1. Extrair e validar JWT Supabase
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/, '').trim();

    if (!token) {
      return json(res, 401, { error: 'Token não fornecido' }, req);
    }

    // 2. Verificar token com Supabase
    const result = await supabase.auth.getUser(token);
    if (result.error || !result.data?.user) {
      return json(res, 401, { error: 'Token inválido' }, req);
    }

    const user = result.data.user;
    const userId = user.id;
    const email = user.email;

    // 3. Obter tenant do usuário (primeira membership ou a selecionada via header)
    const requestedTenantId = req.headers['x-tenant-id'];

    let tenantId = requestedTenantId;
    if (!tenantId) {
      // Buscar primeiro tenant que o usuário tem acesso
      const { data: memberships, error: membError } = await supabase
        .from('user_tenant_memberships')
        .select('tenant_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (membError || !memberships) {
        return json(res, 403, {
          error: 'Usuário não vinculado a nenhum tenant'
        }, req);
      }

      tenantId = memberships.tenant_id;
    }

    if (!userId || !tenantId) {
      return json(res, 400, {
        error: 'Dados insuficientes: userId ou tenantId ausentes'
      }, req);
    }

    // 4. Gerar token Bubble (base64 encoded JWT)
    const bubbleTokenPayload = {
      user_id: userId,
      email: email,
      tenant_id: tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1h expiry
    };

    const bubbleToken = Buffer.from(JSON.stringify(bubbleTokenPayload)).toString('base64');

    // 5. Construir URL Bubble com token
    const bubbleUrl = process.env.BUBBLE_INBOX_URL || 'https://uazapigo-multiatendimento.bubbleapps.io';
    const bubbleWithToken = `${bubbleUrl}?token=${encodeURIComponent(bubbleToken)}&tenant_id=${encodeURIComponent(tenantId)}`;

    return json(res, 200, {
      bubble_url: bubbleWithToken,
      token: bubbleToken,
      expires_in: 3600,
      tenant_id: tenantId
    }, req);

  } catch (error) {
    console.error('[Bubble] Erro ao gerar token:', error);
    return json(res, 500, { error: error.message }, req);
  }
}

/**
 * POST /api/bubble/validate
 * Valida um token Bubble gerado por Ruptur
 *
 * Request headers:
 *   X-Token: <BUBBLE_TOKEN_FROM_RUPTUR>
 *
 * Response:
 * {
 *   "valid": true,
 *   "user_id": "uuid",
 *   "email": "user@example.com",
 *   "tenant_id": "uuid"
 * }
 */
export async function handleBubbleValidate(req, res, json) {
  try {
    const token = req.headers['x-token'];

    if (!token) {
      return json(res, 401, { error: 'Token não fornecido' }, req);
    }

    // Decodificar token base64
    let decoded;
    try {
      const decoded_str = Buffer.from(token, 'base64').toString('utf-8');
      decoded = JSON.parse(decoded_str);
    } catch (e) {
      return json(res, 401, { error: 'Formato de token inválido' }, req);
    }

    // Validar expiry
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return json(res, 401, { error: 'Token expirado' }, req);
    }

    // Validar campos obrigatórios
    if (!decoded.user_id || !decoded.tenant_id) {
      return json(res, 401, { error: 'Token incompleto' }, req);
    }

    return json(res, 200, {
      valid: true,
      user_id: decoded.user_id,
      email: decoded.email,
      tenant_id: decoded.tenant_id
    }, req);

  } catch (error) {
    console.error('[Bubble] Erro ao validar token:', error);
    return json(res, 500, { error: error.message }, req);
  }
}

/**
 * Validar token Base64 extraído do webhook
 * Token deve estar no header Authorization: Bearer <BASE64_TOKEN>
 */
function validateTokenFromHeader(req) {
  const authHeader = req.headers.authorization || req.headers['x-token'] || '';
  const token = authHeader.replace(/^Bearer\s+/, '').trim();

  if (!token) {
    return { valid: false, error: 'Token não fornecido' };
  }

  try {
    const decoded_str = Buffer.from(token, 'base64').toString('utf-8');
    const decoded = JSON.parse(decoded_str);

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return { valid: false, error: 'Token expirado', code: 'TOKEN_EXPIRED' };
    }

    if (!decoded.user_id || !decoded.tenant_id) {
      return { valid: false, error: 'Token incompleto', code: 'INVALID_TOKEN' };
    }

    return {
      valid: true,
      user_id: decoded.user_id,
      tenant_id: decoded.tenant_id,
      email: decoded.email,
      iat: decoded.iat,
      exp: decoded.exp
    };
  } catch (e) {
    return { valid: false, error: 'Formato de token inválido', code: 'INVALID_FORMAT' };
  }
}

/**
 * Verificar se usuário tem membership no tenant
 */
async function verifyTenantMembership(supabase, userId, tenantId) {
  try {
    const { data, error } = await supabase
      .from('user_tenant_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return { valid: false, error: 'Usuário não tem acesso a este tenant' };
    }

    return { valid: true, membership: data };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Mapeamento de eventos UAZAPI para tabelas Supabase
 */
const EVENT_TABLE_MAP = {
  'messages': 'uazapi_messages',
  'messages.update': 'uazapi_messages_update',
  'messages_update': 'uazapi_messages_update',
  'connection': 'uazapi_connection',
  'presence': 'uazapi_presence',
  'contacts': 'uazapi_contacts',
  'chats': 'uazapi_chats',
  'chat.labels': 'uazapi_chat_labels',
  'chat_labels': 'uazapi_chat_labels',
  'groups': 'uazapi_groups',
  'labels': 'uazapi_labels',
  'call': 'uazapi_call',
  'blocks': 'uazapi_blocks',
  'newsletter.messages': 'uazapi_newsletter_messages',
  'newsletter_messages': 'uazapi_newsletter_messages',
  'history': 'uazapi_history'
};

/**
 * Criar registro na tabela apropriada com tenant_id e created_by
 */
async function createEventRecord(supabase, tableName, eventData, userId, tenantId) {
  try {
    // Preparar dados: adicionar tenant_id e created_by
    const recordData = {
      ...eventData,
      tenant_id: tenantId,
      created_by: userId,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from(tableName)
      .insert([recordData])
      .select();

    if (error) {
      console.error(`[${tableName}] Erro ao criar registro:`, error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data?.[0],
      id: data?.[0]?.id,
      timestamp: new Date().toISOString(),
      status: 201
    };
  } catch (error) {
    console.error(`[${tableName}] Erro ao processar:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * POST /api/bubble/validate
 * Handler para webhooks UAZAPI (message.received, instance.connected, etc)
 *
 * Body:
 * {
 *   "event": "message.received" ou "messages" (event type),
 *   "instance_id": "...",
 *   "data": { "sender": "...", "message": "...", ... }
 * }
 *
 * Headers:
 *   Authorization: Bearer <BASE64_TOKEN>
 *   ou
 *   X-Token: <BASE64_TOKEN>
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {...record created},
 *   "id": "record_id",
 *   "timestamp": "2026-05-08T...",
 *   "status": 201
 * }
 */
export async function handleUAZAPIWebhook(req, res, json, body, supabase) {
  try {
    const { event, instance_id, data } = body || {};

    // Step 0: Validar Token
    const tokenValidation = validateTokenFromHeader(req);
    if (!tokenValidation.valid) {
      return json(res, 401, {
        success: false,
        error: tokenValidation.error,
        code: tokenValidation.code || 'INVALID_TOKEN'
      }, req);
    }

    const { user_id, tenant_id } = tokenValidation;

    // Step 1: Verificar Tenant Membership
    const membershipCheck = await verifyTenantMembership(supabase, user_id, tenant_id);
    if (!membershipCheck.valid) {
      return json(res, 403, {
        success: false,
        error: membershipCheck.error,
        code: 'TENANT_UNAUTHORIZED'
      }, req);
    }

    // Validar payload do webhook
    if (!event || !instance_id || !data) {
      console.warn('[UAZAPI Webhook] Payload incompleto:', body);
      return json(res, 400, {
        success: false,
        error: 'event, instance_id e data são obrigatórios'
      }, req);
    }

    // Step 2: Normalizar evento e encontrar tabela
    const tableName = EVENT_TABLE_MAP[event];
    if (!tableName) {
      console.warn(`[UAZAPI Webhook] Evento não mapeado: ${event}`);
      return json(res, 202, {
        success: true,
        message: `Evento ${event} recebido mas não mapeado`,
        event,
        instance_id
      }, req);
    }

    // Step 3: Criar registro
    const eventData = {
      event,
      instance_id,
      ...data
    };

    const result = await createEventRecord(supabase, tableName, eventData, user_id, tenant_id);

    if (!result.success) {
      return json(res, 500, {
        success: false,
        error: result.error,
        event,
        instance_id
      }, req);
    }

    // Sucesso
    console.log(`[UAZAPI Webhook] ${event} | tenant: ${tenant_id} | user: ${user_id} | instance: ${instance_id} | created: ${result.id}`);

    return json(res, 201, {
      success: true,
      data: result.data,
      id: result.id,
      timestamp: result.timestamp,
      status: result.status,
      event,
      instance_id,
      table: tableName
    }, req);

  } catch (error) {
    console.error('[UAZAPI Webhook] Erro ao processar:', error);
    return json(res, 500, { error: error.message, success: false }, req);
  }
}

/**
 * Router principal para rotas Bubble + webhooks UAZAPI
 */
export async function handleBubbleRoutes(req, res, json, supabase, body) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const { method } = req;

  // POST /api/bubble/token
  if (method === 'POST' && pathname === '/api/bubble/token') {
    return handleBubbleToken(req, res, json, supabase);
  }

  // POST /api/bubble/validate
  if (method === 'POST' && pathname === '/api/bubble/validate') {
    // Se tem event no body → webhook UAZAPI (prioridade)
    const isWebhook = body && body.event && body.instance_id;
    if (isWebhook) {
      return handleUAZAPIWebhook(req, res, json, body, supabase);
    }

    // Se tem X-Token header → validação de token
    const hasTokenHeader = req.headers['x-token'];
    if (hasTokenHeader) {
      return handleBubbleValidate(req, res, json);
    }

    // Sem token header nem webhook → 400
    return json(res, 400, { error: 'Envie X-Token header ou webhook com event/instance_id' }, req);
  }

  return json(res, 404, { error: 'Rota Bubble não encontrada' }, req);
}
