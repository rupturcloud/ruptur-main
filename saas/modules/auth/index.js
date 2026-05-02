import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://axrwlboyowoskdxeogba.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cndsYm95b3dvc2tkeGVvZ2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzkzNTYsImV4cCI6MjA4OTUxNTM1Nn0.jrVy7OzLgidDYlK2rFuF1NX2SRP0EVmQycx3d_s7vV8';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extrai token JWT do header Authorization
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verifica se o token JWT é válido e retorna o usuário
 */
async function verifyToken(token) {
  if (!token) return null;
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('[Auth] Token verification failed:', error?.message);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('[Auth] Token verification error:', error.message);
    return null;
  }
}

/**
 * Middleware de autenticação para APIs
 */
async function requireAuth(req, res, next) {
  const token = extractToken(req);
  
  if (!token) {
    return createResponse(res, 401, { error: 'Token não fornecido' });
  }
  
  const user = await verifyToken(token);
  
  if (!user) {
    return createResponse(res, 401, { error: 'Token inválido' });
  }
  
  // Adiciona o usuário ao request para uso posterior
  req.user = user;
  next();
}

/**
 * Obtém tenant do usuário autenticado
 */
async function getUserTenant(user) {
  try {
    const { data: tenantMember, error } = await supabase
      .from('user_tenant_memberships')
      .select(`
        tenant_id,
        role,
        tenants:tenant_id (
          id,
          slug,
          name,
          status,
          plan,
          credits_balance
        )
      `)
      .eq('user_id', user.id)
      .eq('tenants.status', 'active')
      .single();
    
    if (error || !tenantMember) {
      console.error('[Auth] No tenant found for user:', error?.message);
      return null;
    }
    
    return {
      tenant: tenantMember.tenants,
      role: tenantMember.role
    };
  } catch (error) {
    console.error('[Auth] Error getting user tenant:', error.message);
    return null;
  }
}

/**
 * Middleware que requer tenant ativo
 */
async function requireTenant(req, res, next) {
  const userTenant = await getUserTenant(req.user);
  
  if (!userTenant) {
    return createResponse(res, 403, { 
      error: 'Usuário não possui tenant ativo vinculado' 
    });
  }
  
  req.tenant = userTenant.tenant;
  req.userRole = userTenant.role;
  next();
}

/**
 * Função auxiliar para criar respostas (importada do server.mjs)
 */
function createResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Parse JSON body from request
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export {
  extractToken,
  verifyToken,
  requireAuth,
  getUserTenant,
  requireTenant,
  parseBody,
  supabase
};
