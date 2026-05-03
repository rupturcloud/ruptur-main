/**
 * Middleware: Validação de Tenant Context
 *
 * CRÍTICO: Garante que:
 * - Usuário está autenticado (JWT válido)
 * - tenantId é resolvido APENAS de contexto autenticado
 * - Usuário tem permissão no tenant acessado
 *
 * Nunca aceita tenantId de query param, header ou metadados não validados
 */

/**
 * Extrai e valida o tenantId do contexto autenticado do usuário
 *
 * @param {Object} user - Usuário extraído de JWT (de extractUser())
 * @param {String} requestedTenantId - tenantId solicitado na requisição
 * @param {Function} supabase - Cliente Supabase
 * @returns {Promise<String|null>} tenantId validado ou null se não autorizado
 */
export async function validateTenantAccess(user, requestedTenantId, supabase) {
  if (!user || !user.id) {
    return null; // Não autenticado
  }

  if (!requestedTenantId) {
    return null; // Sem tenantId na requisição
  }

  try {
    // Buscar memberships do usuário no Supabase
    const { data: memberships, error } = await supabase
      .from('user_tenant_memberships')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('tenant_id', requestedTenantId)
      .single();

    if (error || !memberships) {
      console.warn(`[Tenant Security] Usuário ${user.id} sem acesso a tenant ${requestedTenantId}`);
      return null; // Usuário não tem acesso a este tenant
    }

    // Validação passou: retornar o tenantId
    return requestedTenantId;
  } catch (err) {
    console.error(`[Tenant Security] Erro ao validar acesso: ${err.message}`);
    return null;
  }
}

/**
 * Extrai tenantId seguramente de uma requisição autenticada
 *
 * IMPORTANTE: Apenas aceita tenantId de:
 * 1. Query parameter (mas VALIDA contra JWT)
 * 2. Header x-tenant-id (mas VALIDA contra JWT)
 *
 * NUNCA aceita sem validação de autorização
 *
 * @param {Object} url - URL parseada
 * @param {Object} req - Requisição HTTP
 * @param {Object} user - Usuário extraído de JWT
 * @param {Function} supabase - Cliente Supabase
 * @returns {Promise<String|null>} tenantId validado
 */
export async function extractAndValidateTenantId(url, req, user, supabase) {
  if (!user) {
    return null; // Não autenticado
  }

  // Tentar extrair de query param ou header
  const requestedTenantId =
    url.searchParams.get('tenant_id') ||
    url.searchParams.get('tenantId') ||
    req.headers['x-tenant-id'];

  if (!requestedTenantId) {
    return null; // Sem tenantId solicitado
  }

  // Validar que o usuário tem permissão
  return validateTenantAccess(user, requestedTenantId, supabase);
}

/**
 * Resolver tenantId padrão do usuário (primeiro tenant que tem acesso)
 *
 * @param {Object} user - Usuário extraído de JWT
 * @param {Function} supabase - Cliente Supabase
 * @returns {Promise<String|null>} tenantId padrão do usuário
 */
export async function getDefaultTenantForUser(user, supabase) {
  if (!user || !user.id) {
    return null;
  }

  try {
    const { data: memberships, error } = await supabase
      .from('user_tenant_memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !memberships) {
      return null;
    }

    return memberships.tenant_id;
  } catch (err) {
    console.error(`[Tenant Security] Erro ao buscar tenant padrão: ${err.message}`);
    return null;
  }
}

/**
 * Middleware que rejeita requisições sem autenticação + tenant válido
 *
 * Uso:
 * ```
 * const user = await extractUser(req);
 * const tenantId = await extractAndValidateTenantId(url, req, user, supabase);
 * if (!tenantId) {
 *   return json(res, 403, { error: 'Tenant access denied' });
 * }
 * ```
 */
