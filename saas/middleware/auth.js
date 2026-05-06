import { createJWTManager } from '../modules/auth/jwt-manager.js';

/**
 * Middleware de autenticação JWT
 * Injeta req.session com dados do usuário autenticado
 */
export function createAuthMiddleware(jwtSecret) {
  const jwtManager = createJWTManager(jwtSecret);

  return async (req, res, next) => {
    // Se for rota de desenvolvimento, pula autenticação
    const pathname = req.url ? new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname : '';
    if (process.env.ENABLE_DEV_MODE && pathname.startsWith('/dev')) {
      req.session = {
        userId: 'dev-user-123',
        tenantId: 'dev-tenant-123',
        providerId: ['uazapi'],
        role: 'admin',
        isDev: true,
      };
      return next();
    }

    try {
      // Tenta extrair token de cookie (httpOnly)
      const token = req.cookies?.auth_token ||
                   req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Unauthorized: No token' }));
      }

      const payload = jwtManager.verify(token);

      req.session = {
        userId: payload.userId,
        email: payload.email,
        tenantId: payload.tenantId,
        providerId: payload.providerId || [],
        role: payload.role || 'user',
        iat: payload.iat,
        exp: payload.exp,
      };

      next();
    } catch (error) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Unauthorized: Invalid token',
        message: error.message,
      }));
    }
  };
}

/**
 * Middleware de validação de tenant
 * Garante que usuário acessa apenas dados do seu tenant
 */
export function createTenantValidationMiddleware() {
  return async (req, res, next) => {
    // Dev mode ignora validação
    if (req.session?.isDev) {
      return next();
    }

    // Rejeita se tenantId vier de query/header
    const tenantFromQuery = req.url.includes('tenantId=');
    const tenantFromHeader = req.headers['x-tenant-id'];

    if (tenantFromQuery || tenantFromHeader) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Forbidden: Tenant must be from session',
      }));
    }

    // Tenant sempre vem da sessão autenticada
    if (!req.session?.tenantId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Bad Request: No tenant in session',
      }));
    }

    next();
  };
}

/**
 * Middleware de rate limiting simples
 */
export function createRateLimitMiddleware(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 min
  const maxRequests = options.maxRequests || 100;
  const stores = new Map(); // tenantId -> { count, resetAt }

  return (req, res, next) => {
    const pathname = req.url ? new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname : '';
    if (process.env.ENABLE_DEV_MODE && pathname.startsWith('/dev')) {
      return next();
    }

    const tenantId = req.session?.tenantId || 'anonymous';
    const now = Date.now();
    const key = tenantId;

    let bucket = stores.get(key);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      stores.set(key, bucket);
    }

    bucket.count++;

    if (bucket.count > maxRequests) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Too many requests',
        retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
      }));
    }

    next();
  };
}

/**
 * Função helper para criar response padronizado
 */
export function createResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'https://app.ruptur.cloud',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

/**
 * Parser simples de body JSON
 */
export async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}
