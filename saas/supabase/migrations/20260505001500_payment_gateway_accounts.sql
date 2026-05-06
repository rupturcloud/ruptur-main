/**
 * Migration 013: Payment Gateway Accounts
 *
 * Armazena credenciais, métodos, recursos e política de recebíveis dos gateways
 * de pagamento usados pelo Super Admin.
 * Segredos ficam criptografados pela aplicação; a UI só recebe sufixos/last4.
 */

CREATE TABLE IF NOT EXISTS payment_gateway_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider TEXT NOT NULL
    CHECK (provider IN ('getnet', 'cakto')),

  label TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production'
    CHECK (environment IN ('sandbox', 'production')),

  status TEXT NOT NULL DEFAULT 'testing'
    CHECK (status IN ('active', 'disabled', 'testing')),

  base_url TEXT,
  webhook_url TEXT,

  credentials_enc TEXT NOT NULL,
  credential_last4 JSONB DEFAULT '{}',

  webhook_secret_enc TEXT,
  webhook_secret_last4 TEXT,

  -- Ex.: métodos habilitados, recursos, recebíveis/antecipação, repasse de juros.
  public_config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_gateway_accounts_provider ON payment_gateway_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_accounts_environment ON payment_gateway_accounts(environment);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_accounts_status ON payment_gateway_accounts(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_gateway_accounts_active_provider_env
  ON payment_gateway_accounts(provider, environment)
  WHERE status = 'active';

ALTER TABLE payment_gateway_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_gateway_accounts_no_direct_user_access ON payment_gateway_accounts;

-- Service role bypassa RLS. Usuários comuns nunca leem credenciais diretamente.
CREATE POLICY payment_gateway_accounts_no_direct_user_access ON payment_gateway_accounts
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE TRIGGER update_payment_gateway_accounts_updated_at
  BEFORE UPDATE ON payment_gateway_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
