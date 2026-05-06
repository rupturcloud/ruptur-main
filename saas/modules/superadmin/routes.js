/**
 * Rotas de Superadmin — Gerenciamento de Plataforma
 *
 * GET  /api/admin/platform/admins      — Listar superadmins (superadmin only)
 * GET  /api/admin/platform/invites     — Listar convites pendentes (superadmin only)
 * POST /api/admin/platform/invite      — Convidar novo superadmin (superadmin only)
 * POST /api/admin/platform/accept-invite — Aceitar convite (público com token)
 */

import { PlatformAdminService } from './platform-admin.service.js';
import { createResponse } from '../../middleware/auth.js';

export function registerPlatformAdminRoutes(app, { supabase, platformAdminMiddleware, emailService }) {
  const adminService = new PlatformAdminService(supabase, emailService);

  // ============================================================================
  // 1. Listar todos os superadmins (superadmin only)
  // ============================================================================
  app.get('/api/admin/platform/admins', platformAdminMiddleware, async (req, res) => {
    try {
      const admins = await adminService.listPlatformAdmins();

      createResponse(res, 200, {
        admins,
        total: admins.length,
      });
    } catch (error) {
      console.error('Error listing platform admins:', error);
      createResponse(res, 500, {
        error: 'Erro ao listar superadmins',
        message: error.message,
      });
    }
  });

  // ============================================================================
  // 2. Listar convites pendentes (superadmin only)
  // ============================================================================
  app.get('/api/admin/platform/invites', platformAdminMiddleware, async (req, res) => {
    try {
      const invites = await adminService.listPendingInvites();

      createResponse(res, 200, {
        invites,
        total: invites.length,
      });
    } catch (error) {
      console.error('Error listing invites:', error);
      createResponse(res, 500, {
        error: 'Erro ao listar convites',
        message: error.message,
      });
    }
  });

  // ============================================================================
  // 3. Convidar novo superadmin (superadmin only)
  // ============================================================================
  app.post('/api/admin/platform/invite', platformAdminMiddleware, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || !email.includes('@')) {
        createResponse(res, 400, {
          error: 'Email inválido',
        });
        return;
      }

      const result = await adminService.invitePlatformAdmin(email, req.session.userId);

      createResponse(res, 201, {
        message: `Convite enviado para ${email}`,
        invite: result.invite,
      });
    } catch (error) {
      console.error('Error inviting platform admin:', error);
      createResponse(res, 400, {
        error: error.message,
      });
    }
  });

  // ============================================================================
  // 4. Aceitar convite de superadmin (público com token válido)
  // ============================================================================
  app.post('/api/admin/platform/accept-invite', async (req, res) => {
    try {
      const { token, userId, email } = req.body;

      if (!token || !userId || !email) {
        createResponse(res, 400, {
          error: 'Token, userId e email são obrigatórios',
        });
        return;
      }

      const admin = await adminService.acceptInvite(token, userId, email);

      createResponse(res, 201, {
        message: `Bem-vindo como superadmin, ${email}!`,
        admin,
      });
    } catch (error) {
      console.error('Error accepting invite:', error);
      createResponse(res, 400, {
        error: error.message,
      });
    }
  });

  // ============================================================================
  // 5. Remover superadmin (superadmin only)
  // ============================================================================
  app.post('/api/admin/platform/remove', platformAdminMiddleware, async (req, res) => {
    try {
      const { adminId } = req.body;

      if (!adminId) {
        createResponse(res, 400, {
          error: 'adminId é obrigatório',
        });
        return;
      }

      const result = await adminService.removePlatformAdmin(adminId, req.session.userId);

      createResponse(res, 200, {
        message: `Superadmin ${result.email} foi desativado`,
        admin: result,
      });
    } catch (error) {
      console.error('Error removing platform admin:', error);
      createResponse(res, 400, {
        error: error.message,
      });
    }
  });
}

export default registerPlatformAdminRoutes;
