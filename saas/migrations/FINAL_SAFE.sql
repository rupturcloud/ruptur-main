/**
 * CONSOLIDATED PRODUCTION MIGRATIONS - VERSÃO SAFE
 *
 * Ignora erros de tabelas/políticas já existentes
 * Usa IF NOT EXISTS em tudo
 */

-- ============================================================================
-- 1. Tenants, Users, Memberships
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  plan TEXT DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'professional', 'enterprise')),
  credits_balance INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  invited_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_tenant_memberships_user_id ON user_tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_memberships_tenant_id ON user_tenant_memberships(tenant_id);

-- RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tenants_pkey') THEN
    ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_pkey') THEN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_tenant_memberships_pkey') THEN
    ALTER TABLE user_tenant_memberships ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Policies (IF NOT EXISTS não funciona para policies, então ignoramos erros)
DO $$
BEGIN
  CREATE POLICY tenants_isolation ON tenants
    FOR SELECT USING (
      id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY users_isolation ON users
    FOR SELECT USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY user_tenant_memberships_isolation ON user_tenant_memberships
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. Instance Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_id TEXT,
  credentials_ref TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, provider, account_id)
);

CREATE TABLE IF NOT EXISTS instance_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_provider_id UUID NOT NULL REFERENCES tenant_providers(id) ON DELETE CASCADE,
  remote_instance_id TEXT NOT NULL,
  remote_account_id TEXT,
  status TEXT DEFAULT 'disconnected',
  instance_number TEXT,
  instance_name TEXT,
  is_business BOOLEAN DEFAULT false,
  platform TEXT,
  metadata JSONB DEFAULT '{}',
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_provider_id, remote_instance_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'success',
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_providers_tenant_id ON tenant_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_providers_provider ON tenant_providers(provider);
CREATE INDEX IF NOT EXISTS idx_instance_registry_tenant_provider ON instance_registry(tenant_provider_id);
CREATE INDEX IF NOT EXISTS idx_instance_registry_instance_number ON instance_registry(instance_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS
DO $$
BEGIN
  ALTER TABLE tenant_providers ENABLE ROW LEVEL SECURITY;
  ALTER TABLE instance_registry ENABLE ROW LEVEL SECURITY;
  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY tenant_providers_isolation ON tenant_providers
    FOR SELECT USING (
      tenant_id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY instance_registry_isolation ON instance_registry
    FOR SELECT USING (
      tenant_provider_id IN (
        SELECT id FROM tenant_providers
        WHERE tenant_id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY audit_logs_isolation ON audit_logs
    FOR SELECT USING (
      tenant_id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  CREATE TRIGGER update_tenant_providers_updated_at
    BEFORE UPDATE ON tenant_providers FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER update_instance_registry_updated_at
    BEFORE UPDATE ON instance_registry FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================================
-- 3. Campaigns
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'paused')),
  target_type TEXT DEFAULT 'contacts' CHECK (target_type IN ('contacts', 'tags', 'segments')),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'template', 'media')),
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
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);

DO $$
BEGIN
  ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
  ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY campaigns_isolation ON campaigns
    FOR SELECT USING (
      tenant_id IN (SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY campaign_recipients_isolation ON campaign_recipients
    FOR SELECT USING (
      campaign_id IN (SELECT id FROM campaigns WHERE tenant_id IN (
        SELECT tenant_id FROM user_tenant_memberships WHERE user_id = auth.uid()
      ))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. RBAC
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_tenant_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS tenant_billing_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  can_edit_billing BOOLEAN DEFAULT false,
  can_view_invoices BOOLEAN DEFAULT false,
  can_manage_subscriptions BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user ON user_tenant_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_tenant ON user_tenant_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_billing_permissions_user ON tenant_billing_permissions(user_id);

DO $$
BEGIN
  ALTER TABLE user_tenant_roles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tenant_billing_permissions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY user_tenant_roles_isolation ON user_tenant_roles
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY tenant_billing_permissions_isolation ON tenant_billing_permissions
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 5. Referral Clicks
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link_id UUID NOT NULL REFERENCES referral_links(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_referral_link_id ON referral_clicks(referral_link_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_created_at ON referral_clicks(created_at);

-- ============================================================================
-- FIM
-- ============================================================================
