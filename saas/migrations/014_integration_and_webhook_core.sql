/**
 * Migration 014: Integration Core & Webhook Core
 *
 * Base agnóstica para integrações externas e webhooks.
 * - integrations: contas/configurações de integrações por tipo/provider
 * - integration_webhook_events: inbox durável de webhooks brutos e normalizados
 * - internal_events: eventos canônicos consumidos por billing/wallet/campaigns/etc.
 * - integration_idempotency_keys: idempotência transversal
 *
 * Observação: segredos continuam criptografados pela aplicação. A UI deve expor
 * apenas last4/capabilities públicas.
 */


-- ============================================================================
-- 0. COMPATIBILIDADE COM payment_gateway_accounts LEGADO
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.payment_gateway_accounts') IS NOT NULL THEN
    ALTER TABLE payment_gateway_accounts
      DROP CONSTRAINT IF EXISTS payment_gateway_accounts_provider_check;

    ALTER TABLE payment_gateway_accounts
      ADD CONSTRAINT payment_gateway_accounts_provider_check
      CHECK (provider IN ('getnet', 'cakto', 'stripe', 'mercado_pago'));
  ELSE
    RAISE NOTICE 'Tabela payment_gateway_accounts não existe; compatibilidade de providers ignorada.';
  END IF;
END $$;

-- ============================================================================
-- 1. CONTAS DE INTEGRAÇÃO AGNÓSTICAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  integration_kind TEXT NOT NULL
    CHECK (integration_kind IN ('payment', 'marketplace', 'messaging', 'ai', 'crm', 'custom')),

  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production'
    CHECK (environment IN ('sandbox', 'production', 'custom')),

  status TEXT NOT NULL DEFAULT 'testing'
    CHECK (status IN ('active', 'testing', 'disabled', 'error')),

  base_url TEXT,
  webhook_url TEXT,

  credentials_enc TEXT,
  credential_last4 JSONB DEFAULT '{}',
  webhook_secret_enc TEXT,
  webhook_secret_last4 TEXT,

  capabilities JSONB DEFAULT '{}',
  public_config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_accounts_kind ON integration_accounts(integration_kind);
CREATE INDEX IF NOT EXISTS idx_integration_accounts_provider ON integration_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_integration_accounts_status ON integration_accounts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_accounts_active_provider_env_kind
  ON integration_accounts(integration_kind, provider, environment)
  WHERE status = 'active';

-- ============================================================================
-- 2. WEBHOOK INBOX / AUDITORIA BRUTA
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID REFERENCES integration_accounts(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

  provider TEXT NOT NULL,
  event_type TEXT,
  provider_event_id TEXT,
  external_reference TEXT,
  idempotency_key TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'processed', 'retrying', 'failed', 'dead_letter', 'ignored')),

  headers JSONB DEFAULT '{}',
  raw_payload JSONB NOT NULL DEFAULT '{}',
  normalized_event JSONB DEFAULT '{}',

  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_retry_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',

  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_webhook_events_provider ON integration_webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_events_status ON integration_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_events_tenant ON integration_webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_events_provider_event ON integration_webhook_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_events_retry ON integration_webhook_events(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_events_received ON integration_webhook_events(received_at DESC);

-- ============================================================================
-- 3. EVENTOS INTERNOS CANÔNICOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS internal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'integration',
  source_event_id UUID REFERENCES integration_webhook_events(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  aggregate_type TEXT,
  aggregate_id TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),

  payload JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_events_type ON internal_events(event_type);
CREATE INDEX IF NOT EXISTS idx_internal_events_status ON internal_events(status);
CREATE INDEX IF NOT EXISTS idx_internal_events_tenant ON internal_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_internal_events_aggregate ON internal_events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_internal_events_created ON internal_events(created_at DESC);

-- ============================================================================
-- 4. IDEMPOTÊNCIA TRANSVERSAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'succeeded', 'failed', 'expired')),
  response_snapshot JSONB,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_idempotency_scope ON integration_idempotency_keys(scope);
CREATE INDEX IF NOT EXISTS idx_integration_idempotency_status ON integration_idempotency_keys(status);
CREATE INDEX IF NOT EXISTS idx_integration_idempotency_expires ON integration_idempotency_keys(expires_at);

-- ============================================================================
-- 5. RLS
-- ============================================================================

ALTER TABLE integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_accounts_no_direct_user_access ON integration_accounts;
DROP POLICY IF EXISTS integration_webhook_events_no_direct_user_access ON integration_webhook_events;
DROP POLICY IF EXISTS internal_events_no_direct_user_access ON internal_events;
DROP POLICY IF EXISTS integration_idempotency_keys_no_direct_user_access ON integration_idempotency_keys;

CREATE POLICY integration_accounts_no_direct_user_access ON integration_accounts
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY integration_webhook_events_no_direct_user_access ON integration_webhook_events
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY internal_events_no_direct_user_access ON internal_events
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY integration_idempotency_keys_no_direct_user_access ON integration_idempotency_keys
  FOR ALL USING (false) WITH CHECK (false);

-- ============================================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE TRIGGER update_integration_accounts_updated_at
  BEFORE UPDATE ON integration_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_integration_webhook_events_updated_at
  BEFORE UPDATE ON integration_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_internal_events_updated_at
  BEFORE UPDATE ON internal_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_integration_idempotency_keys_updated_at
  BEFORE UPDATE ON integration_idempotency_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FIM
-- ============================================================================
