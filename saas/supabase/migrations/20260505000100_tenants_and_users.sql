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
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
