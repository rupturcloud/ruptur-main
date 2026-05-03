/**
 * MINIMAL MIGRATIONS - Apenas o que definitivamente falta
 *
 * Estratégia:
 * - Criar APENAS tabelas que não existem
 * - NÃO criar policies (podem conflitar)
 * - NÃO criar triggers (podem conflitar)
 * - Apenas índices se não existirem
 */

-- ============================================================================
-- 1. Campaigns (provavelmente não existe)
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  target_type TEXT DEFAULT 'contacts',
  message_type TEXT DEFAULT 'text',
  message_content TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);

-- ============================================================================
-- 2. RBAC Tables (provavelmente não existem)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_tenant_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS tenant_billing_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  can_edit_billing BOOLEAN DEFAULT false,
  can_view_invoices BOOLEAN DEFAULT false,
  can_manage_subscriptions BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user ON user_tenant_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_tenant ON user_tenant_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_billing_permissions_user ON tenant_billing_permissions(user_id);

-- ============================================================================
-- 3. Referral Clicks (provavelmente não existe)
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link_id UUID NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_referral_link_id ON referral_clicks(referral_link_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_created_at ON referral_clicks(created_at);

-- ============================================================================
-- Verificação Final
-- ============================================================================

-- SELECT 'Migrations aplicadas com sucesso!' as status;
-- SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
