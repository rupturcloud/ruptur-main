/**
 * Team Management Routes
 * GET /api/teams/:tenantId/members - Listar membros
 * POST /api/teams/:tenantId/members - Adicionar membro (via convite)
 * PATCH /api/teams/:tenantId/members/:userId - Mudar role
 * DELETE /api/teams/:tenantId/members/:userId - Remover membro
 * POST /api/teams/:tenantId/invites - Enviar convite
 * GET /api/teams/:tenantId/invites - Listar convites pendentes
 * POST /api/teams/:tenantId/invites/:inviteId/accept - Aceitar convite
 * GET /api/teams/:tenantId/audit - Listar logs de auditoria
 */

const express = require('express');
const router = express.Router();
const UserManagementService = require('../../modules/users/user-management.service');
const InviteService = require('../../modules/users/invite.service');
const AuditService = require('../../modules/users/audit.service');
const { authMiddleware, tenantMiddleware } = require('../../middleware/auth');

// Inicializar serviços
const userMgmt = new UserManagementService(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const invites = new InviteService(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const audit = new AuditService(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===== MEMBERS =====

/**
 * GET /api/teams/:tenantId/members
 * Listar usuários do tenant
 */
router.get('/:tenantId/members', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { includeInactive } = req.query;

    const members = await userMgmt.listTenantUsers(tenantId, {
      includeInactive: includeInactive === 'true',
    });

    res.json({
      success: true,
      data: members,
      total: members.length,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PATCH /api/teams/:tenantId/members/:userId
 * Mudar role de um membro
 */
router.patch('/:tenantId/members/:userId', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { tenantId, userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Role is required',
      });
    }

    const updated = await userMgmt.changeUserRole(
      tenantId,
      userId,
      role,
      req.user.id
    );

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/teams/:tenantId/members/:userId
 * Remover membro (soft delete)
 */
router.delete('/:tenantId/members/:userId', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { tenantId, userId } = req.params;
    const { reason } = req.body;

    const removed = await userMgmt.removeUserFromTenant(
      tenantId,
      userId,
      req.user.id,
      reason
    );

    res.json({
      success: true,
      data: removed,
      message: 'Membro removido com sucesso',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// ===== INVITES =====

/**
 * POST /api/teams/:tenantId/invites
 * Enviar convite para novo usuário
 */
router.post('/:tenantId/invites', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { email, role = 'member', message = '' } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const invite = await invites.sendInvite(
      tenantId,
      email,
      role,
      req.user.id,
      message
    );

    res.status(201).json({
      success: true,
      data: invite,
      message: `Convite enviado para ${email}`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/teams/:tenantId/invites
 * Listar convites pendentes
 */
router.get('/:tenantId/invites', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const pendingInvites = await invites.listPendingInvites(tenantId);

    res.json({
      success: true,
      data: pendingInvites,
      total: pendingInvites.length,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/teams/:tenantId/invites/:inviteId
 * Cancelar convite
 */
router.delete('/:tenantId/invites/:inviteId', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { inviteId } = req.params;

    const cancelled = await invites.cancelInvite(inviteId, req.user.id);

    res.json({
      success: true,
      data: cancelled,
      message: 'Convite cancelado',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// ===== AUDIT =====

/**
 * GET /api/teams/:tenantId/audit
 * Listar logs de auditoria
 */
router.get('/:tenantId/audit', authMiddleware, tenantMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { action, userId, limit = 50, offset = 0 } = req.query;

    const logs = await audit.getTenantAuditLogs(tenantId, {
      action,
      userId,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: logs.logs,
      pagination: {
        total: logs.total,
        limit: logs.limit,
        offset: logs.offset,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
