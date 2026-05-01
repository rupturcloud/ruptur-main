-- ============================================================
-- 004: Plans & Subscriptions Schema
-- Gerencia planos de assinatura e cobranças recorrentes
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,                   -- 'starter', 'pro', 'business'
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,          -- 9700 = R$97,00
  credits_per_month INTEGER NOT NULL,
  max_instances INTEGER NOT NULL,
  mp_plan_id TEXT,                       -- ID do plano no Mercado Pago
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),

  -- Mercado Pago
  mp_subscription_id TEXT UNIQUE,        -- ID da assinatura no MP
  mp_payer_id TEXT,                      -- ID do pagador no MP

  -- Status da assinatura
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','authorized','paused','cancelled','expired')),

  -- Período atual
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  next_payment_at TIMESTAMPTZ,

  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT
);

-- Histórico de pagamentos (vinculado a subscription ou avulso)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),

  -- Mercado Pago
  mp_payment_id TEXT UNIQUE,
  mp_status TEXT,                        -- 'approved', 'pending', 'rejected', etc
  mp_status_detail TEXT,

  -- Valores
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'BRL',

  -- Tipo
  payment_type TEXT
    CHECK (payment_type IN ('subscription','credit_purchase','one_time','refund')),

  -- Créditos gerados por este pagamento
  credits_granted INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_mp ON subscriptions(mp_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_mp ON payments(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Plans: leitura pública (todos podem ver planos disponíveis)
CREATE POLICY plans_read_public ON plans FOR SELECT USING (true);

CREATE POLICY subscriptions_isolation ON subscriptions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY payments_isolation ON payments
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Trigger
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED: Planos iniciais
-- ============================================================
INSERT INTO plans (id, name, description, price_cents, credits_per_month, max_instances, features, display_order)
VALUES
  ('starter', 'Starter', 'Ideal para começar', 9700, 2000, 1, '{"support":"email","reports":"basic"}', 1),
  ('pro', 'Pro', 'Para quem quer escalar', 19700, 5000, 3, '{"support":"priority","reports":"advanced","api_access":true}', 2),
  ('business', 'Business', 'Máxima performance', 49700, 15000, 10, '{"support":"dedicated","reports":"full","api_access":true,"white_label":true}', 3)
ON CONFLICT (id) DO NOTHING;
