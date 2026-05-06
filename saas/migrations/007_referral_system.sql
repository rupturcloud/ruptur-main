-- ============================================================
-- 007: Referral System — 25% em créditos por amigo que pagar
-- Implementa: Links de referral, comissões, tracking
-- ============================================================

-- Tabela 1: Links de referral (quem indicou quem)
CREATE TABLE IF NOT EXISTS referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referee_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Código único do link (diego_abc123)
  ref_code VARCHAR(100) UNIQUE NOT NULL,

  -- Status do link
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'expired', 'cancelled')),

  -- Metadados
  utm_source TEXT,                       -- origem do compartilhamento
  utm_medium TEXT,                       -- canal (email, whatsapp, etc)
  utm_campaign TEXT,                     -- campanha

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Garantir 1 amigo por referrer (único)
  UNIQUE(referrer_tenant_id, referee_tenant_id)
);

-- Tabela 2: Comissões creditadas (histórico completo)
CREATE TABLE IF NOT EXISTS referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Partes envolvidas
  referrer_tenant_id UUID NOT NULL REFERENCES tenants(id),
  referee_tenant_id UUID NOT NULL REFERENCES tenants(id),
  referral_link_id UUID NOT NULL REFERENCES referral_links(id),

  -- Pagamento do amigo (origem da comissão)
  getnet_payment_id TEXT,                -- payment_id ou subscription_id da Getnet
  getnet_event_type TEXT,                -- PAYMENT_APPROVED, SUBSCRIPTION_PAYMENT, etc

  -- Valores em centavos
  payment_amount INTEGER NOT NULL,       -- quanto o amigo pagou (ex: 4900 = R$49)
  commission_rate DECIMAL(3,2) NOT NULL DEFAULT 0.25, -- 25%
  commission_amount INTEGER NOT NULL,    -- créditos que o referrer ganha (ex: 1225 = R$12.25)

  -- Status
  status TEXT DEFAULT 'credited'
    CHECK (status IN ('credited', 'pending', 'reversed', 'cancelled')),

  -- Auditoria
  credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,                  -- motivo da reversão (chargeback, cancelamento, etc)

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Garantir 1 comissão por payment (no caso de replay de webhook)
  UNIQUE(getnet_payment_id, referrer_tenant_id)
);

-- Tabela 3: Tracking de cliques em link de referral
CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link_id UUID NOT NULL REFERENCES referral_links(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- VIEW: Resumo de referrals por referrer
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW referral_summary AS
SELECT
  rl.referrer_tenant_id,
  COUNT(DISTINCT rl.referee_tenant_id) as total_referrals,
  COUNT(DISTINCT CASE WHEN rl.status = 'active' THEN rl.referee_tenant_id END) as active_referrals,
  COUNT(DISTINCT CASE WHEN rc.status = 'credited' THEN rc.referee_tenant_id END) as paying_referrals,
  COALESCE(SUM(CASE WHEN rc.status = 'credited' THEN rc.commission_amount ELSE 0 END), 0) as total_commission_cents,
  COALESCE(SUM(CASE WHEN rc.status = 'credited' AND DATE(rc.credited_at) >= CURRENT_DATE - INTERVAL '30 days' THEN rc.commission_amount ELSE 0 END), 0) as commission_30d_cents,
  MAX(rc.credited_at) as last_commission_date
FROM referral_links rl
LEFT JOIN referral_commissions rc ON rl.id = rc.referral_link_id
GROUP BY rl.referrer_tenant_id;

-- ═══════════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;

-- Usuário vê referrals que fez (como referrer)
CREATE POLICY referral_links_see_own ON referral_links
  FOR SELECT USING (
    referrer_tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Backend pode inserir (service_role bypassa RLS)
CREATE POLICY referral_links_insert_backend ON referral_links
  FOR INSERT WITH CHECK (false);

-- Usuário vê comissões que ganhou (como referrer)
CREATE POLICY referral_commissions_see_own ON referral_commissions
  FOR SELECT USING (
    referrer_tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- ÍNDICES ADICIONAIS para performance
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_referral_links_slug ON referral_links(ref_code);
CREATE INDEX IF NOT EXISTS idx_referral_links_referrer_status ON referral_links(referrer_tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON referral_commissions(referrer_tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referee ON referral_commissions(referee_tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_getnet_payment ON referral_commissions(getnet_payment_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions(status);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_credited_date ON referral_commissions(credited_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer_status ON referral_commissions(referrer_tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_created ON referral_commissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_link ON referral_clicks(referral_link_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_created_desc ON referral_clicks(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Auto-update updated_at em referral_links
CREATE TRIGGER update_referral_links_updated_at
  BEFORE UPDATE ON referral_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
