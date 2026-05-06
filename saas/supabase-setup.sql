-- ============================================================
-- SUPABASE SETUP - Setup inicial do schema Ruptur
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- Função auxiliar para auto-update de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- 002: Tenants & Users Schema
-- Gerencia contas de clientes e seus usuários
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,             -- Identificador URL-safe: 'murilo-rifas'
  name TEXT NOT NULL,                    -- Nome de exibição: 'Murilo Rifas'
  email TEXT NOT NULL,                   -- Email principal da conta

  -- Plano e status
  plan TEXT DEFAULT 'trial'
    CHECK (plan IN ('trial','starter','pro','business','custom')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','suspended','cancelled','pending')),

  -- Wallet / Créditos
  credits_balance INTEGER DEFAULT 50,    -- Trial inicia com 50 créditos grátis
  monthly_credits INTEGER DEFAULT 0,     -- Créditos inclusos no plano/mês

  -- Limites
  max_instances INTEGER DEFAULT 1,

  -- Mercado Pago
  mp_customer_id TEXT,                   -- ID do cliente no Mercado Pago
  mp_subscription_id TEXT,               -- ID da assinatura recorrente ativa

  -- Lifecycle
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usuários vinculados a tenants (1 user pode pertencer a 1+ tenants)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'owner'
    CHECK (role IN ('owner','admin','member','viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membership para multi-tenant access (future-proof)
CREATE TABLE IF NOT EXISTS user_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member'
    CHECK (role IN ('owner','admin','member','viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_user ON user_tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_tenant ON user_tenant_memberships(tenant_id);

-- RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Policies: usuário só vê seu(s) tenant(s)
CREATE POLICY tenants_isolation ON tenants
  FOR ALL USING (
    id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY users_isolation ON users
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY memberships_isolation ON user_tenant_memberships
  FOR SELECT USING (user_id = auth.uid());

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DADOS INICIAIS: Criar tenant e vínculo para usuário existente
-- Substitua pelo UUID do usuário que já existe no auth.users
-- ============================================================

-- Inserir tenant de exemplo (apenas se não existir nenhum)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenants LIMIT 1) THEN
    INSERT INTO tenants (slug, name, email, plan, status, credits_balance)
    VALUES ('demo-tenant', 'Demo Tenant', 'demo@ruptur.cloud', 'trial', 'active', 50);
  END IF;
END $$;

-- Nota: Para vincular um usuário existente ao tenant, execute:
-- INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
-- SELECT 
--   'UUID-DO-USUARIO-AQUI'::uuid,
--   (SELECT id FROM tenants LIMIT 1),
--   'owner'
-- WHERE NOT EXISTS (
--   SELECT 1 FROM user_tenant_memberships 
--   WHERE user_id = 'UUID-DO-USUARIO-AQUI'::uuid
-- );

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT 'Tabelas criadas:' as status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('tenants', 'users', 'user_tenant_memberships');
