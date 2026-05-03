/**
 * Migration 002: Wallets e Payment Tables
 *
 * Cria tabelas para gerenciamento de créditos e pagamentos
 * - wallets: saldo de créditos por tenant
 * - wallet_transactions: histórico de movimentações
 * - payments: histórico de pagamentos (Getnet, etc)
 * - subscriptions: assinaturas recorrentes
 * - plans: planos de assinatura disponíveis
 *
 * Execução:
 * 1. Copie todo o SQL abaixo
 * 2. Acesse Supabase > SQL Editor
 * 3. Cole e execute
 */

-- ============================================================================
-- 1. TABELA: wallets
-- Saldo de créditos por tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT balance_non_negative CHECK (balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wallets_tenant_id ON wallets(tenant_id);

-- ============================================================================
-- 2. TABELA: wallet_transactions
-- Histórico de movimentações de créditos
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('credit', 'debit')), -- credit/debit
  amount INTEGER NOT NULL CHECK (amount > 0),
  description TEXT,
  reference VARCHAR(100), -- payment_id, subscription_id, etc
  balance_before INTEGER,
  balance_after INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_reference CHECK (reference IS NOT NULL OR description IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tenant_id ON wallet_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);

-- ============================================================================
-- 3. TABELA: payments
-- Histórico de pagamentos e checkout
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  getnet_payment_id VARCHAR(100) UNIQUE,
  status VARCHAR(50) NOT NULL, -- INITIATED, APPROVED, DENIED, CANCELLED
  status_detail TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_type VARCHAR(50) NOT NULL, -- credit_purchase, subscription_payment, etc
  credits_granted INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('INITIATED', 'APPROVED', 'DENIED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_getnet_payment_id ON payments(getnet_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ============================================================================
-- 4. TABELA: plans
-- Planos de assinatura disponíveis
-- ============================================================================

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  credits_per_month INTEGER NOT NULL CHECK (credits_per_month > 0),
  max_instances INTEGER NOT NULL DEFAULT 5,
  billing_cycle_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir planos padrão
INSERT INTO plans (name, description, price_cents, credits_per_month, max_instances, is_active)
VALUES
  ('Trial', 'Plano gratuito para testes', 0, 100, 1, TRUE),
  ('Starter', 'Plano básico para pequenos volumes', 9900, 10000, 5, TRUE),
  ('Professional', 'Plano para operações médias', 29900, 50000, 20, TRUE),
  ('Enterprise', 'Plano para grandes volumes', 99900, 500000, 100, TRUE)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);

-- ============================================================================
-- 5. TABELA: subscriptions
-- Assinaturas recorrentes
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  getnet_subscription_id VARCHAR(100) UNIQUE,
  status VARCHAR(50) NOT NULL, -- active, paused, cancelled, failed
  last_payment_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  next_billing_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'cancelled', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_getnet_subscription_id ON subscriptions(getnet_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================================
-- 6. TABELA: referral_links
-- Links de referência para programa de afiliados
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  referee_tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, expired, cancelled
  commission_rate DECIMAL(5,2) DEFAULT 25.00, -- 25% padrão
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_links_code ON referral_links(code);
CREATE INDEX IF NOT EXISTS idx_referral_links_referrer_tenant_id ON referral_links(referrer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_links_referee_tenant_id ON referral_links(referee_tenant_id);

-- ============================================================================
-- 7. TABELA: referral_commissions
-- Comissões geradas por referrals
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link_id UUID NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
  referee_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  referrer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id VARCHAR(100), -- getnet_payment_id
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  commission_cents INTEGER NOT NULL CHECK (commission_cents > 0),
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer_tenant_id ON referral_commissions(referrer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_payment_id ON referral_commissions(payment_id);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- Garantir que tenants só acessem seus próprios dados
-- ============================================================================

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;

-- Wallets (user pode acessar wallets do seu tenant)
CREATE POLICY wallets_tenant_isolation ON wallets
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Wallet transactions
CREATE POLICY wallet_transactions_tenant_isolation ON wallet_transactions
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Payments
CREATE POLICY payments_tenant_isolation ON payments
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Subscriptions
CREATE POLICY subscriptions_tenant_isolation ON subscriptions
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Referral links (referrer acessa seus links)
CREATE POLICY referral_links_referrer_access ON referral_links
  USING (
    referrer_tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 9. FUNÇÕES HELPER
-- ============================================================================

-- Função para adicionar créditos (idempotente)
CREATE OR REPLACE FUNCTION add_wallet_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_reference VARCHAR,
  p_description TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance INTEGER;
  v_old_balance INTEGER;
BEGIN
  -- Verificar se transação já foi processada (idempotência)
  IF p_reference IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM wallet_transactions
      WHERE tenant_id = p_tenant_id
      AND reference = p_reference
    ) THEN
      RETURN jsonb_build_object(
        'status', 'already_processed',
        'message', 'Credits already added for this reference'
      );
    END IF;
  END IF;

  -- Obter/criar wallet
  INSERT INTO wallets (tenant_id, balance)
  VALUES (p_tenant_id, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Buscar balance antigo
  SELECT balance INTO v_old_balance
  FROM wallets
  WHERE tenant_id = p_tenant_id;

  -- Atualizar balance
  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id
  RETURNING balance INTO v_new_balance;

  -- Registrar transação
  INSERT INTO wallet_transactions
  (tenant_id, type, amount, description, reference, balance_before, balance_after)
  VALUES
  (p_tenant_id, 'credit', p_amount, p_description, p_reference, v_old_balance, v_new_balance);

  RETURN jsonb_build_object(
    'status', 'success',
    'balance_before', v_old_balance,
    'balance_after', v_new_balance,
    'credits_added', p_amount
  );
END;
$$ LANGUAGE plpgsql;

-- Função para debitar créditos
CREATE OR REPLACE FUNCTION debit_wallet_credits(
  p_tenant_id UUID,
  p_amount INTEGER,
  p_reference VARCHAR,
  p_description TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_new_balance INTEGER;
  v_old_balance INTEGER;
BEGIN
  -- Buscar balance atual
  SELECT balance INTO v_old_balance
  FROM wallets
  WHERE tenant_id = p_tenant_id;

  IF v_old_balance IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Wallet not found'
    );
  END IF;

  -- Validar saldo
  IF v_old_balance < p_amount THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Insufficient credits',
      'required', p_amount,
      'available', v_old_balance
    );
  END IF;

  -- Debitar
  UPDATE wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id
  RETURNING balance INTO v_new_balance;

  -- Registrar transação
  INSERT INTO wallet_transactions
  (tenant_id, type, amount, description, reference, balance_before, balance_after)
  VALUES
  (p_tenant_id, 'debit', p_amount, p_description, p_reference, v_old_balance, v_new_balance);

  RETURN jsonb_build_object(
    'status', 'success',
    'balance_before', v_old_balance,
    'balance_after', v_new_balance,
    'credits_deducted', p_amount
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. GRANTS (Permissões)
-- ============================================================================

GRANT SELECT ON wallets TO anon, authenticated;
GRANT SELECT ON wallet_transactions TO anon, authenticated;
GRANT SELECT ON payments TO anon, authenticated;
GRANT SELECT ON subscriptions TO anon, authenticated;
GRANT SELECT ON plans TO anon, authenticated;
GRANT SELECT ON referral_links TO anon, authenticated;
GRANT SELECT ON referral_commissions TO anon, authenticated;

-- Funções podem ser chamadas por usuários autenticados
GRANT EXECUTE ON FUNCTION add_wallet_credits TO authenticated;
GRANT EXECUTE ON FUNCTION debit_wallet_credits TO authenticated;

-- ============================================================================
-- FIM DA MIGRATION 002
-- ============================================================================
