/**
 * ROTA DE DESENVOLVIMENTO
 * Desativa TODA segurança para desenvolvimento rápido
 *
 * ⚠️  NUNCA usar em produção
 * ⚠️  APENAS quando ENABLE_DEV_MODE=true
 */

import { createJWTManager } from '../modules/auth/jwt-manager.js';

export async function handleDevRoute(req, res, url) {
  const jwtSecret = process.env.JWT_SECRET || 'temporary-dev-secret-change-in-production-' + Math.random().toString(36).substr(2, 32);
  const jwtManager = createJWTManager(jwtSecret);
  if (process.env.NODE_ENV === 'production') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Dev mode disabled in production' }));
  }

  const pathParts = url.pathname.split('/').filter(Boolean);

  // GET /dev/status - Status completo (sem auth)
  if (pathParts[1] === 'status' && req.method === 'GET') {
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      message: '✅ Dev mode ativo - Segurança desativada',
      warning: '⚠️  Use apenas em desenvolvimento',
      features: {
        authBypass: true,
        tenantValidation: false,
        rateLimit: false,
        corsRestriction: false,
      },
      session: {
        userId: 'dev-user-123',
        tenantId: 'dev-tenant-123',
        providerId: ['uazapi'],
        role: 'admin',
      },
    }));
  }

  // POST /dev/reset - Limpa estado (útil para testes)
  if (pathParts[1] === 'reset' && req.method === 'POST') {
    // Aqui você poderia resetar estado, limpar cache, etc
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      message: 'Sistema resetado para testes',
      timestamp: new Date().toISOString(),
    }));
  }

  // POST /dev/seed - Popula dados de teste
  if (pathParts[1] === 'seed' && req.method === 'POST') {
    const mockInstances = [
      {
        id: 'uazapi-mock-1',
        name: 'Instância Mock 1',
        status: 'connected',
        number: '5531999999999',
        isBusiness: true,
        platform: 'Android',
      },
      {
        id: 'uazapi-mock-2',
        name: 'Instância Mock 2',
        status: 'connected',
        number: '5531988888888',
        isBusiness: false,
        platform: 'iOS',
      },
    ];

    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      message: 'Dados de teste criados',
      instances: mockInstances,
    }));
  }

  // GET /dev/mock/instances - Lista instâncias mock
  if (pathParts[1] === 'mock' && pathParts[2] === 'instances' && req.method === 'GET') {
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify([
      {
        id: 'mock-1',
        name: 'Test Instance 1',
        status: 'connected',
        number: '5531987654321',
        isBusiness: true,
        platform: 'Web',
        metadata: {
          token: 'mock-token-1',
          adminField01: 'admin-1',
          adminField02: 'field-2',
        },
      },
      {
        id: 'mock-2',
        name: 'Test Instance 2',
        status: 'disconnected',
        number: null,
        isBusiness: false,
        platform: 'Android',
        metadata: {
          token: 'mock-token-2',
        },
      },
    ]));
  }

  // POST /dev/mock/webhook - Processa webhook de teste
  if (pathParts[1] === 'mock' && pathParts[2] === 'webhook' && req.method === 'POST') {
    let body = '';
    return new Promise((resolve) => {
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            received: true,
            payload,
            timestamp: new Date().toISOString(),
          }));
          resolve();
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          resolve();
        }
      });
    });
  }

  // GET /dev/mock/token - Gera JWT válido pra testes
  if (pathParts[1] === 'mock' && pathParts[2] === 'token' && req.method === 'GET') {
    const token = jwtManager.sign({
      userId: 'dev-user',
      tenantId: 'dev-tenant',
      email: 'dev@ruptur.local',
      name: 'Dev User',
      providerId: ['uazapi'],
      role: 'admin',
    }, '24h');

    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      token,
      decoded: {
        userId: 'dev-user',
        tenantId: 'dev-tenant',
        email: 'dev@ruptur.local',
        role: 'admin',
      },
      usage: 'Use no header: Authorization: Bearer <token>',
      expiresIn: '24h',
    }));
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Dev route not found' }));
}

/**
 * Adiciona mensagens de aviso quando dev mode está ativo
 */
export function logDevModeWarning() {
  const warnings = [
    '',
    '╔════════════════════════════════════════════════════════════╗',
    '║                 ⚠️  DEV MODE ATIVO                         ║',
    '║                                                            ║',
    '║  SEGURANÇA TOTALMENTE DESATIVADA                          ║',
    '║  - Auth bypass (qualquer /dev rota)                       ║',
    '║  - Sem validação de tenant                                ║',
    '║  - Sem rate limiting                                      ║',
    '║  - CORS aberto (*)                                        ║',
    '║                                                            ║',
    '║  ❌ NUNCA use em PRODUÇÃO ❌                              ║',
    '║                                                            ║',
    '║  Para desativar dev mode:                                 ║',
    '║  ENABLE_DEV_MODE=false                                    ║',
    '╚════════════════════════════════════════════════════════════╝',
    '',
  ];

  warnings.forEach(line => console.log(line));
}
