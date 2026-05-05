-- ============================================================
-- 005: Campaigns Schema
-- Gerencia campanhas de disparo de mensagens
-- ============================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Dados da campanha
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image','video','audio','document')),

  -- Status lifecycle
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','paused','completed','failed','cancelled')),

  -- Métricas de envio
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- Créditos
  credits_estimated INTEGER DEFAULT 0,   -- Estimativa antes de enviar
  credits_consumed INTEGER DEFAULT 0,    -- Créditos reais consumidos

  -- Agendamento
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Instância usada para envio
  instance_id UUID REFERENCES instance_registry(id),

  -- Metadata adicional (tags, segmentação, etc)
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lista de destinatários da campanha
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  phone TEXT NOT NULL,
  name TEXT,

  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','failed')),

  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recipients_status ON campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_recipients_phone ON campaign_recipients(phone);

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_isolation ON campaigns
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY recipients_isolation ON campaign_recipients
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_tenant_memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Trigger
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
