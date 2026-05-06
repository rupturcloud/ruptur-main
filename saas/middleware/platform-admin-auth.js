/**
 * Middleware de autenticação para rotas de superadmin
 * Verifica se usuário tem permissão de plataforma
 */

import { PlatformAdminService } from '../modules/superadmin/platform-admin.service.js';

export function createPlatformAdminMiddleware(supabase) {
  const adminService = new PlatformAdminService(supabase);

  return async (req, res, next) => {
    try {
      // Verificar se usuário está autenticado
      if (!req.session?.userId) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized: Not authenticated' }));
      }

      // Verificar se é superadmin
      const isPlatformAdmin = await adminService.isPlatformAdmin(req.session.userId);

      if (!isPlatformAdmin) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'Forbidden: Platform admin access required',
        }));
      }

      // Adicionar flag de superadmin à sessão
      req.session.isPlatformAdmin = true;

      next();
    } catch (error) {
      console.error('Error in platform admin middleware:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }));
    }
  };
}

export default createPlatformAdminMiddleware;
