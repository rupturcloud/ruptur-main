import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://axrwlboyowoskdxeogba.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cndsYm95b3dvc2tkeGVvZ2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzkzNTYsImV4cCI6MjA4OTUxNTM1Nn0.jrVy7OzLgidDYlK2rFuF1NX2SRP0EVmQycx3d_s7vV8';

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { transport: ws },
});

// Lazy-load client com service role (para criação de tenants, etc)
let supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    supabaseAdmin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { realtime: { transport: ws } })
      : supabase;
  }
  return supabaseAdmin;
}

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
 * Tenta user_tenant_roles primeiro (novo modelo), depois user_tenant_memberships (legacy)
 */
async function getUserTenant(user) {
  try {
    // Tenta o novo modelo: user_tenant_roles
    const { data: tenantRole, error: roleError } = await supabase
      .from('user_tenant_roles')
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
      .eq('status', 'active')
      .in('tenants.status', ['active', 'suspended', 'trial'])
      .single();

    if (!roleError && tenantRole) {
      return {
        tenant: tenantRole.tenants,
        role: tenantRole.role
      };
    }

    // Fallback: tenta o modelo legacy: user_tenant_memberships
    const { data: tenantMember, error: memberError } = await supabase
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
      .in('tenants.status', ['active', 'suspended', 'trial'])
      .single();

    if (memberError || !tenantMember) {
      console.log('[Auth] No tenant found in user_tenant_roles or user_tenant_memberships:', {
        userId: user.id,
        roleError: roleError?.message,
        memberError: memberError?.message
      });
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
 * Auto-provisiona tenant para novo usuário se não tiver um
 */
async function getOrCreateUserTenant(user) {
  try {
    console.log('[Auth] getOrCreateUserTenant called for user:', user.id);

    // Tenta obter tenant existente (query simples sem relationship)
    const { data: existingRoles, error: rolesError } = await supabase
      .from('user_tenant_roles')
      .select('tenant_id,role')
      .eq('user_id', user.id)
      .limit(1);

    console.log('[Auth] Existing roles query:', { rolesError: rolesError?.message, found: existingRoles?.length });

    if (existingRoles && existingRoles.length > 0) {
      // Já tem tenant, busca os detalhes (usando service role para RLS)
      const { data: tenant } = await getSupabaseAdmin()
        .from('tenants')
        .select('*')
        .eq('id', existingRoles[0].tenant_id)
        .single();

      if (tenant) {
        console.log('[Auth] Found existing tenant:', tenant.id);
        return {
          tenant,
          role: existingRoles[0].role || 'member'
        };
      }
    }

    // Se não tiver, cria um novo tenant
    console.log('[Auth] No existing tenant found, creating new one...');
    const tenantName = user.email?.split('@')[0] || user.id;
    const tenantSlug = `tenant-${user.id.slice(0, 8)}`;

    const { data: newTenant, error: tenantError } = await getSupabaseAdmin()
      .from('tenants')
      .insert({
        slug: tenantSlug,
        name: `${tenantName}'s Workspace`,
        email: user.email || `user+${user.id}@ruptur.cloud`,
        plan: 'trial',
        status: 'active',
        credits_balance: 1000,
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select('*')
      .single();

    console.log('[Auth] Insert tenant result:', { error: tenantError?.message, tenantId: newTenant?.id });

    if (tenantError) {
      console.error('[Auth] Erro ao criar tenant:', { message: tenantError.message, code: tenantError.code, details: tenantError.details });
      return null;
    }

    // Vincula usuário ao novo tenant como owner (usando service role)
    const { error: roleError } = await getSupabaseAdmin()
      .from('user_tenant_roles')
      .insert({
        user_id: user.id,
        tenant_id: newTenant.id,
        role: 'owner'
      });

    if (roleError) {
      console.error('[Auth] Erro ao vincular usuário ao tenant (roles):', roleError.message);
      // Mesmo com erro, retorna o tenant que foi criado
    }

    // Também vincula em user_tenant_memberships para compatibilidade (silenciosamente)
    try {
      await getSupabaseAdmin()
        .from('user_tenant_memberships')
        .insert({
          user_id: user.id,
          tenant_id: newTenant.id,
          role: 'owner'
        });
    } catch {
      // ignora erros do legacy
    }

    return {
      tenant: newTenant,
      role: 'owner'
    };
  } catch (error) {
    console.error('[Auth] Erro em getOrCreateUserTenant:', error.message);
    return null;
  }
}

/**
 * Middleware que requer tenant ativo (com auto-provisioning)
 */
async function requireTenant(req, res, next) {
  const userTenant = await getOrCreateUserTenant(req.user);

  if (!userTenant) {
    return createResponse(res, 403, {
      error: 'Falha ao provisionar tenant para usuário'
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
  getOrCreateUserTenant,
  requireTenant,
  parseBody,
  supabase
};
