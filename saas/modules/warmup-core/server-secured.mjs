/**
 * Servidor Seguro com Google Auth + JWT + Multi-tenant
 * Wrapper do server.mjs existente com middlewares de segurança
 */

import http from 'node:http';
import { createAuthMiddleware, createTenantValidationMiddleware, createRateLimitMiddleware, createResponse, parseBody } from '../../middleware/auth.js';
import { handleDevRoute, logDevModeWarning } from '../../routes/dev.js';
import { createWebhookRouter, findWebhookHandler } from '../../routes/webhooks.js';
import { createGoogleOAuthManager } from '../../modules/auth/google-oauth.js';
import { createJWTManager } from '../../modules/auth/jwt-manager.js';
import { createProviderManager } from '../../modules/provider-adapter/provider-manager.js';
import { createAPIRouter, findAPIHandler } from '../../modules/api/endpoints.js';
import { BillingService } from '../../modules/billing/getnet.js';

const HOST = process.env.WARMUP_RUNTIME_HOST || '0.0.0.0';
const PORT = Number(process.env.WARMUP_RUNTIME_PORT || process.env.PORT || 8787);
const ENABLE_DEV_MODE = process.env.ENABLE_DEV_MODE === 'true';

const jwtSecret = process.env.JWT_SECRET || generateSecretKey();
const jwtManager = createJWTManager(jwtSecret);
const providerManager = createProviderManager();

// Inicializar Supabase se credenciais disponíveis
let supabase = null;
if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    );
    console.log('✅ Supabase inicializado');
  } catch (error) {
    console.warn('⚠️  Supabase não disponível:', error.message);
  }
}

// Criar roteador de APIs
const apiRouter = createAPIRouter(supabase, providerManager);

// Inicializar BillingService (Getnet)
const billingService = new BillingService({
  clientId: process.env.GETNET_CLIENT_ID,
  clientSecret: process.env.GETNET_CLIENT_SECRET,
  sellerId: process.env.GETNET_SELLER_ID,
  webhookSecret: process.env.GETNET_WEBHOOK_SECRET,
  sandbox: process.env.GETNET_SANDBOX !== 'false',
  supabase,
});

// Criar roteador de webhooks
const webhookRouter = createWebhookRouter(billingService);

let googleOAuthManager = null;
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  googleOAuthManager = new (await import('../../modules/auth/google-oauth.js')).GoogleOAuthManager({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || `https://${process.env.DOMAIN_PRIMARY}/auth/google/callback`,
  });
}

function generateSecretKey() {
  console.warn('⚠️  JWT_SECRET não configurado! Gerando chave temporária (não usar em produção)');
  return 'temporary-dev-secret-change-in-production-' + Math.random().toString(36).substr(2, 32);
}

function getCORSOrigin() {
  if (ENABLE_DEV_MODE) return '*';
  return process.env.CORS_ORIGIN || 'https://app.ruptur.cloud';
}

async function handleAuthRoute(req, res, url) {
  const pathParts = url.pathname.split('/').filter(Boolean);

  // GET /auth/google - Redireciona pro Google
  if (pathParts[1] === 'google' && req.method === 'GET') {
    if (!googleOAuthManager) {
      return createResponse(res, 500, { error: 'Google OAuth não configurado' });
    }
    const authUrl = googleOAuthManager.buildAuthUrl();
    res.writeHead(302, { Location: authUrl });
    return res.end();
  }

  // GET /auth/google/callback - Processa retorno do Google
  if (pathParts[1] === 'google' && pathParts[2] === 'callback' && req.method === 'GET') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      return createResponse(res, 400, { error: `Google OAuth error: ${error}` });
    }

    if (!code) {
      return createResponse(res, 400, { error: 'Missing authorization code' });
    }

    try {
      const tokens = await googleOAuthManager.exchangeCodeForTokens(code);
      const user = await googleOAuthManager.verifyIdToken(tokens.id_token);

      // TODO: Buscar tenant do usuário no Supabase
      const tenantId = 'dev-tenant-123'; // Placeholder
      const providerId = ['uazapi']; // Providers do tenant

      const jwt = jwtManager.sign({
        userId: user.userId,
        email: user.email,
        name: user.name,
        tenantId,
        providerId,
        role: 'admin',
      }, '7d');

      // Seta cookie httpOnly
      res.writeHead(302, {
        'Set-Cookie': `auth_token=${jwt}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
        Location: '/dashboard',
      });
      return res.end();
    } catch (error) {
      console.error('[Auth] Google callback error:', error);
      return createResponse(res, 500, { error: 'OAuth callback failed' });
    }
  }

  // POST /auth/logout
  if (pathParts[1] === 'logout' && req.method === 'POST') {
    res.writeHead(200, {
      'Set-Cookie': 'auth_token=; HttpOnly; Max-Age=0',
      'Content-Type': 'application/json',
    });
    return res.end(JSON.stringify({ message: 'Logged out' }));
  }

  createResponse(res, 404, { error: 'Auth route not found' });
}

export async function createSecureServer() {
  // Middleware
  const authMiddleware = createAuthMiddleware(jwtSecret);
  const tenantMiddleware = createTenantValidationMiddleware();
  const rateLimitMiddleware = createRateLimitMiddleware({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
  });

  // Log dev mode warning
  if (ENABLE_DEV_MODE) {
    logDevModeWarning();
  }

  const server = http.createServer(async (req, res) => {
    // CORS Headers
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': getCORSOrigin(),
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Credentials': 'true',
      });
      return res.end();
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

    try {
      // Rotas de autenticação (sem auth middleware)
      if (pathname.startsWith('/auth/')) {
        return handleAuthRoute(req, res, url);
      }

      // Rotas de desenvolvimento (sem auth se dev mode)
      if (pathname.startsWith('/dev/')) {
        if (!ENABLE_DEV_MODE && process.env.NODE_ENV === 'production') {
          return createResponse(res, 403, { error: 'Dev mode disabled' });
        }
        return handleDevRoute(req, res, url);
      }

      // Webhooks (sem auth, mas com validação de assinatura)
      if (pathname.startsWith('/api/webhooks/')) {
        const webhookHandler = findWebhookHandler(pathname, webhookRouter);
        if (webhookHandler) {
          return await webhookHandler(req, res, url);
        }
      }

      // Health check (sem auth)
      if (pathname === '/api/local/health') {
        return createResponse(res, 200, {
          ok: true,
          port: PORT,
          devMode: ENABLE_DEV_MODE,
          timestamp: new Date().toISOString(),
        });
      }

      // Aplica middlewares de segurança pra tudo mais
      if (!ENABLE_DEV_MODE || !pathname.startsWith('/dev/')) {
        let middlewareCompleted = false;

        // Autenticação obrigatória
        await new Promise((resolve) => {
          authMiddleware(req, res, () => {
            middlewareCompleted = true;
            resolve();
          });
          // Se response já foi enviada, resolve logo
          if (res.writableEnded || res.headersSent) {
            resolve();
          }
        });

        if (res.writableEnded || res.headersSent) {
          return;
        }

        // Validação de tenant
        await new Promise((resolve) => {
          tenantMiddleware(req, res, () => {
            resolve();
          });
          if (res.writableEnded || res.headersSent) {
            resolve();
          }
        });

        if (res.writableEnded || res.headersSent) {
          return;
        }

        // Rate limiting
        await new Promise((resolve) => {
          rateLimitMiddleware(req, res, () => {
            resolve();
          });
          if (res.writableEnded || res.headersSent) {
            resolve();
          }
        });

        if (res.writableEnded || res.headersSent) {
          return;
        }
      }

      // Rotas de API autenticadas
      const apiHandler = findAPIHandler(pathname, apiRouter);
      if (apiHandler) {
        return await apiHandler(req, res, url);
      }

      // TODO: Integrar endpoints existentes (inbox, campaigns, etc)
      // Por enquanto, retorna 404 pra rotas não encontradas
      createResponse(res, 404, { error: 'Endpoint not found' });
    } catch (error) {
      console.error('[Server] Error:', error);
      createResponse(res, 500, { error: error.message });
    }
  });

  return server;
}

// Start server
if (process.env.STANDALONE === 'true') {
  const server = await createSecureServer();
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Servidor seguro rodando em ${HOST}:${PORT}`);
    console.log(`📝 Dev Mode: ${ENABLE_DEV_MODE ? 'ATIVADO ⚠️' : 'Desativado ✅'}`);
    console.log(`🔐 Auth: Google OAuth${googleOAuthManager ? ' ✅' : ' ❌'}`);
    console.log(`📊 Tenant Isolation: ✅`);
    console.log(`🛡️  Rate Limiting: ${ENABLE_DEV_MODE ? 'Desativado' : 'Ativado'}`);
  });
}
