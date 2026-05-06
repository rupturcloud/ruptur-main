-- ============================================================
-- 003: Wallet Transactions Schema
-- Registro imutável de toda movimentação financeira
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Tipo da transação
  type TEXT NOT NULL
    CHECK (type IN ('credit','debit','refund','bonus','subscription_credit')),

  -- Valores (positivo = entrada, negativo = saída)
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,        -- Saldo resultante para audit trail

  -- Origem da transação
  source TEXT
    CHECK (source IN ('purchase','subscription','admin','campaign','refund','trial','system')),

  -- Referência externa
  reference_id TEXT,                     -- mp_payment_id, campaign_id, admin_user_id
  reference_type TEXT,                   -- 'mp_payment', 'campaign', 'admin_action'

  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_wallet_tx_tenant ON wallet_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_source ON wallet_transactions(source);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference ON wallet_transactions(reference_id);

-- RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_tx_isolation ON wallet_transactions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- INSERT policy: só o backend (service_role) pode inserir transações
-- Usuários comuns NÃO podem criar transações diretamente
CREATE POLICY wallet_tx_insert_backend ON wallet_transactions
  FOR INSERT WITH CHECK (false);
  -- Service role key bypassa RLS automaticamente
