/**
 * Admin Tenant Configuration Routes
 * GET/PATCH /api/admin/tenants/:tenantId/settings
 * GET /api/admin/tenants/:tenantId/members
 * PATCH /api/admin/tenants/:tenantId/members/:userId/role
 * GET /api/admin/tenants/:tenantId/billing
 * GET /api/admin/tenants/:tenantId/audit
 */

import { TenantConfigService } from '../modules/admin/tenant-config.service.js';
import { parseBody } from '../modules/auth/index.js';

const createResponse = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

export async function handleAdminTenantRoutes(req, res, supabase) {
  const { method, url, user } = req;
  const path = new URL(url, `http://${req.headers.host}`).pathname;

  // Verificar se usuário é owner do tenant
  const tenantMatch = path.match(/^\/api\/admin\/tenants\/([a-f0-9-]{36})/);
  if (!tenantMatch) {
    return createResponse(res, 404, { error: 'Route not found' });
  }

  const tenantId = tenantMatch[1];

  // Verificar permissão: apenas owners podem acessar admin
  const { data: userRole } = await supabase
    .from('user_tenant_roles')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (!userRole || userRole.role !== 'owner') {
    return createResponse(res, 403, { error: 'Acesso negado: requer permissão de owner' });
  }

  const tenantService = new TenantConfigService(supabase);

  // GET /api/admin/tenants/:tenantId/settings
  if (method === 'GET' && path === `/api/admin/tenants/${tenantId}/settings`) {
    return handleGetTenantSettings(res, tenantId, tenantService);
  }

  // PATCH /api/admin/tenants/:tenantId/settings
  if (method === 'PATCH' && path === `/api/admin/tenants/${tenantId}/settings`) {
    return handleUpdateTenantSettings(req, res, tenantId, user.id, tenantService);
  }

  // GET /api/admin/tenants/:tenantId/members
  if (method === 'GET' && path === `/api/admin/tenants/${tenantId}/members`) {
    return handleGetMembers(req, res, tenantId, tenantService);
  }

  // PATCH /api/admin/tenants/:tenantId/members/:userId/role
  const memberMatch = path.match(/^\/api\/admin\/tenants\/[a-f0-9-]{36}\/members\/([a-f0-9-]{36})\/role$/);
  if (method === 'PATCH' && memberMatch) {
    const memberUserId = memberMatch[1];
    return handleUpdateMemberRole(req, res, tenantId, memberUserId, user.id, tenantService);
  }

  // GET /api/admin/tenants/:tenantId/billing
  if (method === 'GET' && path === `/api/admin/tenants/${tenantId}/billing`) {
    return handleGetBilling(res, tenantId, tenantService);
  }

  // GET /api/admin/tenants/:tenantId/audit
  if (method === 'GET' && path === `/api/admin/tenants/${tenantId}/audit`) {
    return handleGetAudit(req, res, tenantId, tenantService);
  }

  createResponse(res, 404, { error: 'Route not found' });
}

/**
 * GET /api/admin/tenants/:tenantId/settings
 */
async function handleGetTenantSettings(res, tenantId, tenantService) {
  try {
    const settings = await tenantService.getTenantSettings(tenantId);
    createResponse(res, 200, {
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('[API] getTenantSettings error:', error.message);
    createResponse(res, 400, { error: error.message });
  }
}

/**
 * PATCH /api/admin/tenants/:tenantId/settings
 * Body: { name?, email?, plan?, status?, creditsBalance? }
 */
async function handleUpdateTenantSettings(req, res, tenantId, userId, tenantService) {
  try {
    const body = await parseBody(req);
    const result = await tenantService.updateTenantSettings(tenantId, body, userId);

    createResponse(res, 200, {
      success: true,
      message: result.message,
      data: {
        id: result.tenant.id,
        slug: result.tenant.slug,
        name: result.tenant.name,
        plan: result.tenant.plan,
        status: result.tenant.status
      }
    });
  } catch (error) {
    console.error('[API] updateTenantSettings error:', error.message);
    createResponse(res, 400, { error: error.message });
  }
}

/**
 * GET /api/admin/tenants/:tenantId/members?includeInactive=true
 */
async function handleGetMembers(req, res, tenantId, tenantService) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const members = await tenantService.getTenantMembers(tenantId, includeInactive);

    createResponse(res, 200, {
      success: true,
      total: members.length,
      members
    });
  } catch (error) {
    console.error('[API] getMembers error:', error.message);
    createResponse(res, 400, { error: error.message });
  }
}

/**
 * PATCH /api/admin/tenants/:tenantId/members/:userId/role
 * Body: { role: 'owner' | 'admin' | 'member' }
 */
async function handleUpdateMemberRole(req, res, tenantId, memberUserId, userId, tenantService) {
  try {
    const body = await parseBody(req);
    const { role } = body;

    if (!role) {
      return createResponse(res, 400, { error: 'Missing required field: role' });
    }

    const result = await tenantService.updateMemberRole(tenantId, memberUserId, role, userId);

    createResponse(res, 200, {
      success: true,
      message: result.message,
      data: {
        userId: memberUserId,
        oldRole: result.oldRole,
        newRole: result.newRole
      }
    });
  } catch (error) {
    console.error('[API] updateMemberRole error:', error.message);
    const statusCode = error.message.includes('Apenas owners') ? 403 : 400;
    createResponse(res, statusCode, { error: error.message });
  }
}

/**
 * GET /api/admin/tenants/:tenantId/billing
 */
async function handleGetBilling(res, tenantId, tenantService) {
  try {
    const billing = await tenantService.getTenantBilling(tenantId);

    createResponse(res, 200, {
      success: true,
      data: billing
    });
  } catch (error) {
    console.error('[API] getBilling error:', error.message);
    createResponse(res, 400, { error: error.message });
  }
}

/**
 * GET /api/admin/tenants/:tenantId/audit?limit=50
 */
async function handleGetAudit(req, res, tenantId, tenantService) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const logs = await tenantService.getTenantAudit(tenantId, limit);

    createResponse(res, 200, {
      success: true,
      total: logs.length,
      logs
    });
  } catch (error) {
    console.error('[API] getAudit error:', error.message);
    createResponse(res, 400, { error: error.message });
  }
}

export default handleAdminTenantRoutes;
