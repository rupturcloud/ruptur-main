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
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return json(res, 401, { error: 'Token não fornecido' }, req);
    }

    // 2. Verificar token com Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json(res, 401, { error: 'Token inválido' }, req);
    }

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
 * POST /api/bubble/validate
 * Handler para webhooks UAZAPI (message.received, instance.connected, etc)
 *
 * Body:
 * {
 *   "event": "message.received",
 *   "instance_id": "...",
 *   "data": { "sender": "...", "message": "...", ... }
 * }
 *
 * Response: { "ok": true }
 */
export async function handleUAZAPIWebhook(req, res, json, body) {
  try {
    const { event, instance_id, data } = body || {};

    if (!event || !instance_id) {
      console.warn('[UAZAPI Webhook] Payload incompleto:', body);
      return json(res, 400, { error: 'event e instance_id obrigatórios' }, req);
    }

    console.log(`[UAZAPI Webhook] ${event} | instance: ${instance_id} | data:`, JSON.stringify(data, null, 2));

    // Todos os eventos são logados e processáveis
    // TODO: Implementar handlers específicos por tipo de evento:
    // - message.received → criar msg na Bubble
    // - instance.connected → atualizar status
    // - instance.disconnected → atualizar status
    // - presence.changed → atualizar online/offline

    return json(res, 200, { ok: true, event, instance_id }, req);

  } catch (error) {
    console.error('[UAZAPI Webhook] Erro ao processar:', error);
    return json(res, 500, { error: error.message }, req);
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
    // Se tem X-Token header → validação de token
    // Se tem event no body → webhook UAZAPI
    const hasTokenHeader = req.headers['x-token'];
    const isWebhook = body && body.event && body.instance_id;

    if (isWebhook) {
      return handleUAZAPIWebhook(req, res, json, body);
    }

    if (hasTokenHeader) {
      return handleBubbleValidate(req, res, json);
    }

    // Sem token header nem webhook → 400
    return json(res, 400, { error: 'Envie X-Token header ou webhook com event/instance_id' }, req);
  }

  return json(res, 404, { error: 'Rota Bubble não encontrada' }, req);
}
