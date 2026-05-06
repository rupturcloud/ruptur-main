/**
 * Migration 015: Comercial Admin, Tracking Integrations & Support
 *
 * Catálogo comercial agnóstico para planos, ofertas, pacotes de créditos,
 * regras de precificação, integrações de tracking e tickets de sustentação.
 *
 * Observação: credenciais sensíveis ficam criptografadas pela aplicação em
 * tracking_integrations.credentials_enc. Usuários comuns não acessam estas
 * tabelas diretamente; o Admin usa backend + service_role.
 */

-- ============================================================================
-- 1. PLANOS, OFERTAS, PACOTES E PREÇOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS commercial_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  is_free_tier BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  billing_period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly', 'annual', 'one_time', 'custom')),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  annual_price_cents INTEGER CHECK (annual_price_cents IS NULL OR annual_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  monthly_credits INTEGER NOT NULL DEFAULT 0 CHECK (monthly_credits >= 0),
  credit_unit_price_cents INTEGER CHECK (credit_unit_price_cents IS NULL OR credit_unit_price_cents >= 0),
  max_instances INTEGER NOT NULL DEFAULT 1 CHECK (max_instances >= 0),
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  features JSONB NOT NULL DEFAULT '[]',
  limits JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 100,
  gateway_provider TEXT CHECK (gateway_provider IS NULL OR gateway_provider IN ('cakto', 'getnet', 'stripe', 'mercado_pago', 'manual')),
  external_price_refs JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  target_audience TEXT DEFAULT 'all',
  discount_type TEXT DEFAULT 'none'
    CHECK (discount_type IN ('none', 'percent', 'fixed_cents', 'bonus_credits', 'custom')),
  discount_value INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  plans JSONB NOT NULL DEFAULT '[]',
  packages JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  credits_amount INTEGER NOT NULL DEFAULT 0 CHECK (credits_amount >= 0),
  bonus_credits INTEGER NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  credit_unit_price_cents INTEGER CHECK (credit_unit_price_cents IS NULL OR credit_unit_price_cents >= 0),
  validity_days INTEGER CHECK (validity_days IS NULL OR validity_days >= 0),
  gateway_provider TEXT CHECK (gateway_provider IS NULL OR gateway_provider IN ('cakto', 'getnet', 'stripe', 'mercado_pago', 'manual')),
  external_price_refs JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global'
    CHECK (scope IN ('global', 'plan', 'tenant', 'channel', 'campaign')),
  metric TEXT NOT NULL DEFAULT 'message'
    CHECK (metric IN ('message', 'credit', 'whatsapp_message', 'warmup_message', 'instance', 'seat', 'custom')),
  unit TEXT NOT NULL DEFAULT 'unit',
  unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'paused', 'archived')),
  applies_to_plans JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. TRACKING / ADS / ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tracking_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL
    CHECK (provider IN ('utmify', 'google_analytics', 'google_tag_manager', 'meta_pixel', 'google_ads', 'custom')),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'testing'
    CHECK (status IN ('active', 'testing', 'disabled')),
  public_config JSONB NOT NULL DEFAULT '{}',
  credentials_enc TEXT,
  credential_last4 JSONB NOT NULL DEFAULT '{}',
  events_enabled JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. SUPORTE / SUSTENTAÇÃO
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  requester_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category TEXT NOT NULL DEFAULT 'general',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS support_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'comment',
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_commercial_plans_status ON commercial_plans(status);
CREATE INDEX IF NOT EXISTS idx_commercial_plans_featured ON commercial_plans(is_featured, display_order);
CREATE INDEX IF NOT EXISTS idx_commercial_offers_status ON commercial_offers(status);
CREATE INDEX IF NOT EXISTS idx_commercial_offers_window ON commercial_offers(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_credit_packages_status ON commercial_credit_packages(status);
CREATE INDEX IF NOT EXISTS idx_credit_packages_featured ON commercial_credit_packages(is_featured, display_order);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_scope_metric ON commercial_pricing_rules(scope, metric, status);
CREATE INDEX IF NOT EXISTS idx_tracking_integrations_provider ON tracking_integrations(provider, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket ON support_ticket_events(ticket_id, created_at DESC);

-- ============================================================================
-- 5. RLS
-- ============================================================================

ALTER TABLE commercial_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_plans_no_direct_user_access ON commercial_plans;
DROP POLICY IF EXISTS commercial_offers_no_direct_user_access ON commercial_offers;
DROP POLICY IF EXISTS credit_packages_no_direct_user_access ON commercial_credit_packages;
DROP POLICY IF EXISTS pricing_rules_no_direct_user_access ON commercial_pricing_rules;
DROP POLICY IF EXISTS tracking_integrations_no_direct_user_access ON tracking_integrations;
DROP POLICY IF EXISTS support_tickets_no_direct_user_access ON support_tickets;
DROP POLICY IF EXISTS support_ticket_events_no_direct_user_access ON support_ticket_events;

CREATE POLICY commercial_plans_no_direct_user_access ON commercial_plans
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY commercial_offers_no_direct_user_access ON commercial_offers
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY credit_packages_no_direct_user_access ON commercial_credit_packages
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY pricing_rules_no_direct_user_access ON commercial_pricing_rules
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY tracking_integrations_no_direct_user_access ON tracking_integrations
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY support_tickets_no_direct_user_access ON support_tickets
  FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY support_ticket_events_no_direct_user_access ON support_ticket_events
  FOR ALL USING (false) WITH CHECK (false);

-- ============================================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE TRIGGER update_commercial_plans_updated_at
  BEFORE UPDATE ON commercial_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_commercial_offers_updated_at
  BEFORE UPDATE ON commercial_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_credit_packages_updated_at
  BEFORE UPDATE ON commercial_credit_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON commercial_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_tracking_integrations_updated_at
  BEFORE UPDATE ON tracking_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FIM
-- ============================================================================
