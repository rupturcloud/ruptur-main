-- ============================================================
-- Instance Registry Schema
-- Gerencia mapeamento tenant -> provider -> instances
-- ============================================================

-- Provedores configurados por tenant
CREATE TABLE IF NOT EXISTS tenant_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  provider TEXT NOT NULL, -- 'uazapi', 'evolution', etc
  account_id TEXT, -- Identificador na conta do provider

  -- Credenciais encriptadas (usar Supabase Vault)
  credentials_ref TEXT, -- Referência pra Supabase Vault

  -- Metadados específicos do provider
  metadata JSONB DEFAULT '{}',

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(tenant_id, provider, account_id)
);

-- Registry de instâncias remote
CREATE TABLE IF NOT EXISTS instance_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_provider_id UUID NOT NULL REFERENCES tenant_providers(id) ON DELETE CASCADE,

  -- ID remoto (token UAZAPI, etc)
  remote_instance_id TEXT NOT NULL,
  remote_account_id TEXT, -- De qual subconta foi criada

  status TEXT DEFAULT 'disconnected', -- 'connected', 'disconnected', 'connecting'

  -- Metadados normalizados
  instance_number TEXT, -- Número WhatsApp resolvido
  instance_name TEXT,
  is_business BOOLEAN DEFAULT false,
  platform TEXT, -- 'Android', 'iOS', 'Web'

  metadata JSONB DEFAULT '{}',

  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(tenant_provider_id, remote_instance_id)
);

-- Audit logs (imutável)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  action TEXT NOT NULL, -- 'create_instance', 'send_message', etc
  resource TEXT, -- 'instance', 'provider', etc
  resource_id TEXT,

  details JSONB DEFAULT '{}',

  status TEXT DEFAULT 'success', -- 'success', 'error', 'warning'
  error_message TEXT,

  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tenant_providers_tenant_id ON tenant_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_providers_provider ON tenant_providers(provider);
CREATE INDEX IF NOT EXISTS idx_instance_registry_tenant_provider ON instance_registry(tenant_provider_id);
CREATE INDEX IF NOT EXISTS idx_instance_registry_instance_number ON instance_registry(instance_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS: Row Level Security
ALTER TABLE tenant_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE instance_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Usuários só veem providers de seus tenants
CREATE POLICY tenant_providers_isolation ON tenant_providers
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Usuários só veem instâncias de seus tenants
CREATE POLICY instance_registry_isolation ON instance_registry
  FOR SELECT
  USING (
    tenant_provider_id IN (
      SELECT id FROM tenant_providers
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_tenant_memberships
        WHERE user_id = auth.uid()
      )
    )
  );

-- Usuários só veem logs de seus tenants
CREATE POLICY audit_logs_isolation ON audit_logs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Trigger: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenant_providers_updated_at
  BEFORE UPDATE ON tenant_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instance_registry_updated_at
  BEFORE UPDATE ON instance_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
