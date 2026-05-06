/**
 * Migration 012: Provider Accounts & API Leases
 *
 * Gerencia pools de contas UAZAPI por tipo de plano/capacidade:
 * - free/teste de 1 hora
 * - paid/produção
 * - dedicated/interno
 *
 * Observação: credenciais sensíveis ficam criptografadas pela aplicação em
 * provider_accounts.admin_token_enc. O backend com service_role é o único
 * componente que deve descriptografar e chamar a UAZAPI.
 */

-- ============================================================================
-- 1. CONTAS DE PROVEDORES
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider TEXT NOT NULL DEFAULT 'uazapi'
    CHECK (provider IN ('uazapi')),

  label TEXT NOT NULL,
  server_url TEXT NOT NULL DEFAULT 'https://free.uazapi.com',

  account_kind TEXT NOT NULL DEFAULT 'free'
    CHECK (account_kind IN ('free', 'paid', 'dedicated', 'internal')),

  plan_label TEXT,
  capacity_instances INTEGER DEFAULT 1 CHECK (capacity_instances >= 0),
  used_instances INTEGER DEFAULT 0 CHECK (used_instances >= 0),

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'capacity_full', 'draining', 'disabled', 'expired')),

  -- Token admin criptografado pela aplicação.
  admin_token_enc TEXT NOT NULL,
  admin_token_last4 TEXT,

  expires_at TIMESTAMPTZ,
  rotation_policy JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_accounts_provider ON provider_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_kind ON provider_accounts(account_kind);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_status ON provider_accounts(status);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_expires ON provider_accounts(expires_at);

-- ============================================================================
-- 2. ASSIGNMENTS TENANT -> PROVIDER ACCOUNT
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_account_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_account_id UUID NOT NULL REFERENCES provider_accounts(id) ON DELETE RESTRICT,

  assignment_kind TEXT NOT NULL DEFAULT 'free_trial'
    CHECK (assignment_kind IN ('free_trial', 'paid_plan', 'dedicated', 'internal')),

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'draining', 'revoked', 'expired')),

  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_assignments_tenant ON provider_account_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_assignments_account ON provider_account_assignments(provider_account_id);
CREATE INDEX IF NOT EXISTS idx_provider_assignments_status ON provider_account_assignments(status);

-- ============================================================================
-- 3. LEASES DE API/INSTÂNCIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_account_id UUID NOT NULL REFERENCES provider_accounts(id) ON DELETE RESTRICT,
  instance_registry_id UUID REFERENCES instance_registry(id) ON DELETE SET NULL,

  lease_type TEXT NOT NULL DEFAULT 'free_1h'
    CHECK (lease_type IN ('free_1h', 'paid_persistent', 'dedicated')),

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'converted', 'revoked')),

  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_leases_tenant ON api_leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_leases_account ON api_leases(provider_account_id);
CREATE INDEX IF NOT EXISTS idx_api_leases_instance ON api_leases(instance_registry_id);
CREATE INDEX IF NOT EXISTS idx_api_leases_status ON api_leases(status);
CREATE INDEX IF NOT EXISTS idx_api_leases_expires ON api_leases(expires_at);

-- ============================================================================
-- 4. EVENTOS DE PROVIDER/ROTAÇÃO/AUDITORIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_account_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_account_id UUID REFERENCES provider_accounts(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  instance_registry_id UUID REFERENCES instance_registry(id) ON DELETE SET NULL,

  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'warning')),
  details JSONB DEFAULT '{}',
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_events_account ON provider_account_events(provider_account_id);
CREATE INDEX IF NOT EXISTS idx_provider_events_tenant ON provider_account_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_events_type ON provider_account_events(event_type);
CREATE INDEX IF NOT EXISTS idx_provider_events_created ON provider_account_events(created_at DESC);

-- ============================================================================
-- 5. EXTENSÕES EM instance_registry
-- ============================================================================

ALTER TABLE instance_registry
  ADD COLUMN IF NOT EXISTS provider_account_id UUID REFERENCES provider_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS lifecycle TEXT DEFAULT 'persistent'
    CHECK (lifecycle IN ('temporary', 'persistent')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'sync'
    CHECK (source IN ('sync', 'created_by_platform', 'imported')),
  ADD COLUMN IF NOT EXISTS token_last4 TEXT;

CREATE INDEX IF NOT EXISTS idx_instance_registry_provider_account ON instance_registry(provider_account_id);
CREATE INDEX IF NOT EXISTS idx_instance_registry_tenant_id ON instance_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instance_registry_lifecycle ON instance_registry(lifecycle);
CREATE INDEX IF NOT EXISTS idx_instance_registry_expires ON instance_registry(expires_at);

-- ============================================================================
-- 6. RLS
-- ============================================================================

ALTER TABLE provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_account_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_account_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_accounts_no_direct_user_access ON provider_accounts;
DROP POLICY IF EXISTS provider_assignments_tenant_read ON provider_account_assignments;
DROP POLICY IF EXISTS api_leases_tenant_read ON api_leases;
DROP POLICY IF EXISTS provider_events_no_direct_user_access ON provider_account_events;

-- Service role bypassa RLS. Para usuários autenticados comuns, não expor contas
-- globais nem tokens. Endpoints admin usam backend + service_role.
CREATE POLICY provider_accounts_no_direct_user_access ON provider_accounts
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY provider_assignments_tenant_read ON provider_account_assignments
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY api_leases_tenant_read ON api_leases
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY provider_events_no_direct_user_access ON provider_account_events
  FOR ALL USING (false) WITH CHECK (false);

-- ============================================================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE TRIGGER update_provider_accounts_updated_at
  BEFORE UPDATE ON provider_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_provider_assignments_updated_at
  BEFORE UPDATE ON provider_account_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_api_leases_updated_at
  BEFORE UPDATE ON api_leases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FIM
-- ============================================================================
