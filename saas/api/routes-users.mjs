/**
 * User Management API Routes
 * - POST /api/users/invite - Convida usuário para tenant
 * - POST /api/users/accept-invite - Aceita convite
 * - DELETE /api/users/:userId - Remove usuário de tenant
 * - PATCH /api/users/:userId/role - Muda role de usuário
 * - GET /api/users - Lista usuários de um tenant
 * - GET /api/users/stats - Estatísticas de usuários
 */

import { UserManagementService } from '../modules/users/service.js';
import { parseBody } from '../modules/auth/index.js';

const createResponse = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

export async function handleUserRoutes(req, res) {
  const { method, url, user } = req;
  const path = new URL(url, `http://${req.headers.host}`).pathname;

  // POST /api/users/invite
  if (method === 'POST' && path === '/api/users/invite') {
    return handleInviteUser(req, res, user);
  }

  // POST /api/users/accept-invite
  if (method === 'POST' && path === '/api/users/accept-invite') {
    return handleAcceptInvite(req, res, user);
  }

  // DELETE /api/users/:userId
  if (method === 'DELETE' && path.match(/^\/api\/users\/[a-f0-9-]{36}$/)) {
    const userId = path.split('/')[3];
    return handleRemoveUser(req, res, user, userId);
  }

  // PATCH /api/users/:userId/role
  if (method === 'PATCH' && path.match(/^\/api\/users\/[a-f0-9-]{36}\/role$/)) {
    const userId = path.split('/')[3];
    return handleChangeRole(req, res, user, userId);
  }

  // GET /api/users
  if (method === 'GET' && path === '/api/users') {
    return handleListUsers(req, res, user);
  }

  // GET /api/users/stats
  if (method === 'GET' && path === '/api/users/stats') {
    return handleGetStats(req, res, user);
  }

  createResponse(res, 404, { error: 'Route not found' });
}

/**
 * POST /api/users/invite
 * Body: { tenantId, email, role?, message? }
 */
async function handleInviteUser(req, res, user) {
  try {
    if (!user) {
      return createResponse(res, 401, { error: 'Unauthorized' });
    }

    const body = await parseBody(req);
    const { tenantId, email, role = 'member' } = body;

    if (!tenantId || !email) {
      return createResponse(res, 400, { error: 'Missing required fields: tenantId, email' });
    }

    const invite = await UserManagementService.inviteUser(
      tenantId,
      email,
      role,
      user.id
    );

    createResponse(res, 201, {
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.invitedRole,
        expiresAt: invite.expiresAt,
        status: invite.status
      }
    });
  } catch (error) {
    console.error('[API] inviteUser error:', error.message);
    const statusCode = error.message.includes('Rate limit') ? 429 : 400;
    createResponse(res, statusCode, { error: error.message });
  }
}

/**
 * POST /api/users/accept-invite
 * Body: { token }
 */
async function handleAcceptInvite(req, res, user) {
  try {
    if (!user || !user.email) {
      return createResponse(res, 401, { error: 'Unauthorized' });
    }

    const body = await parseBody(req);
    const { token } = body;

    if (!token) {
      return createResponse(res, 400, { error: 'Missing required field: token' });
    }

    const result = await UserManagementService.acceptInvite(token, user.id, user.email);

    createResponse(res, 200, {
      success: true,
      message: 'Invite accepted',
      data: {
        tenantId: result.tenantId,
        role: result.role,
        acceptedAt: result.acceptedAt
      }
    });
  } catch (error) {
    console.error('[API] acceptInvite error:', error.message);
    createResponse(res, 400, { error: error.message });
  }
}

/**
 * DELETE /api/users/:userId
 * Query: { tenantId }
 */
async function handleRemoveUser(req, res, user, targetUserId) {
  try {
    if (!user) {
      return createResponse(res, 401, { error: 'Unauthorized' });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const tenantId = url.searchParams.get('tenantId');

    if (!tenantId) {
      return createResponse(res, 400, { error: 'Missing required query param: tenantId' });
    }

    const result = await UserManagementService.removeUserFromTenant(
      targetUserId,
      tenantId,
      user.id
    );

    createResponse(res, 200, {
      success: true,
      message: 'User removed from tenant',
      data: {
        userId: result.userId,
        status: result.status,
        removedAt: result.removedAt
      }
    });
  } catch (error) {
    console.error('[API] removeUser error:', error.message);
    const statusCode = error.message.includes('Cannot remove') ? 409 : 400;
    createResponse(res, statusCode, { error: error.message });
  }
}

/**
 * PATCH /api/users/:userId/role
 * Body: { tenantId, role }
 */
async function handleChangeRole(req, res, user, targetUserId) {
  try {
    if (!user) {
      return createResponse(res, 401, { error: 'Unauthorized' });
    }

    const body = await parseBody(req);
    const { tenantId, role } = body;

    if (!tenantId || !role) {
      return createResponse(res, 400, { error: 'Missing required fields: tenantId, role' });
    }

    const result = await UserManagementService.changeUserRole(
      targetUserId,
      tenantId,
      role,
      user.id
    );

    createResponse(res, 200, {
      success: true,
      message: 'User role changed',
      data: {
        userId: result.userId,
        oldRole: result.oldRole,
        newRole: result.newRole,
        changedAt: result.changedAt
      }
    });
  } catch (error) {
    console.error('[API] changeRole error:', error.message);
    const statusCode = error.message.includes('Cannot remove') ? 409 : 400;
    createResponse(res, statusCode, { error: error.message });
  }
}

/**
 * GET /api/users?tenantId=:tenantId&includeInactive=true
 */
async function handleListUsers(req, res, user) {
  try {
    if (!user) {
      return createResponse(res, 401, { error: 'Unauthorized' });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const tenantId = url.searchParams.get('tenantId');
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    if (!tenantId) {
      return createResponse(res, 400, { error: 'Missing required query param: tenantId' });
    }

    const users = await UserManagementService.listTenantUsers(tenantId, includeInactive);

    createResponse(res, 200, {
      success: true,
      users: users.map(u => ({
        userId: u.userId,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        deletedAt: u.deletedAt
      }))
    });
  } catch (error) {
    console.error('[API] listUsers error:', error.message);
    createResponse(res, 400, { error: error.message });
  }
}

/**
 * GET /api/users/stats?tenantId=:tenantId
 */
async function handleGetStats(req, res, user) {
  try {
    if (!user) {
      return createResponse(res, 401, { error: 'Unauthorized' });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const tenantId = url.searchParams.get('tenantId');

    if (!tenantId) {
      return createResponse(res, 400, { error: 'Missing required query param: tenantId' });
    }

    const stats = await UserManagementService.getTenantUserStats(tenantId);

    createResponse(res, 200, {
      success: true,
      stats
    });
  } catch (error) {
    console.error('[API] getStats error:', error.message);
    createResponse(res, 400, { error: error.message });
  }
}

export default handleUserRoutes;
