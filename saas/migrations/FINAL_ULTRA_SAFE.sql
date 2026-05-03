/**
 * ULTRA SAFE - Apenas tabelas simples, sem constraints complexas
 */

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name TEXT,
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
  campaign_id UUID,
  contact_id TEXT,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RBAC
CREATE TABLE IF NOT EXISTS user_tenant_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tenant_id UUID,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_billing_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tenant_id UUID,
  can_edit_billing BOOLEAN DEFAULT false,
  can_view_invoices BOOLEAN DEFAULT false,
  can_manage_subscriptions BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral
CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ✅ MIGRAÇÃO CONCLUÍDA
