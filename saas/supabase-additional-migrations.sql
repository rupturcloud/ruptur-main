-- ============================================================
-- SUPABASE MIGRATIONS ADICIONAIS
-- instance_registry e tenant_providers
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Tabela instance_registry (registro de instâncias por tenant)
CREATE TABLE IF NOT EXISTS instance_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    instance_id VARCHAR(255) NOT NULL,
    instance_name VARCHAR(255),
    instance_token VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    profile JSONB,
    status VARCHAR(50) DEFAULT 'inactive',
    connected BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT instance_registry_tenant_instance_unique UNIQUE(tenant_id, instance_id)
);

-- Tabela tenant_providers (provedores por tenant)
CREATE TABLE IF NOT EXISTS tenant_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_type VARCHAR(100) NOT NULL, -- 'whatsapp', 'telegram', 'instagram', etc.
    provider_name VARCHAR(255) NOT NULL,
    provider_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT tenant_providers_tenant_provider_unique UNIQUE(tenant_id, provider_type, provider_name)
);

-- Tabela message_logs (logs de mensagens enviadas)
CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    instance_id UUID REFERENCES instance_registry(id) ON DELETE SET NULL,
    message_id VARCHAR(255),
    recipient VARCHAR(255) NOT NULL,
    message_text TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, read, failed
    error_message TEXT,
    external_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_instance_registry_tenant_id ON instance_registry(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instance_registry_token ON instance_registry(instance_token);
CREATE INDEX IF NOT EXISTS idx_instance_registry_status ON instance_registry(status);
CREATE INDEX IF NOT EXISTS idx_tenant_providers_tenant_id ON tenant_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_providers_type ON tenant_providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_message_logs_tenant_id ON message_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_instance_id ON message_logs(instance_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at);

-- RLS (Row Level Security) para as novas tabelas
ALTER TABLE instance_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para instance_registry
CREATE POLICY "Users can view their tenant instances" ON instance_registry
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_tenant_memberships.user_id = auth.uid()
            AND user_tenant_memberships.tenant_id = instance_registry.tenant_id
        )
    );

CREATE POLICY "Users can insert their tenant instances" ON instance_registry
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_tenant_memberships.user_id = auth.uid()
            AND user_tenant_memberships.tenant_id = instance_registry.tenant_id
        )
    );

CREATE POLICY "Users can update their tenant instances" ON instance_registry
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_tenant_memberships.user_id = auth.uid()
            AND user_tenant_memberships.tenant_id = instance_registry.tenant_id
        )
    );

-- Políticas RLS para tenant_providers
CREATE POLICY "Users can view their tenant providers" ON tenant_providers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_tenant_memberships.user_id = auth.uid()
            AND user_tenant_memberships.tenant_id = tenant_providers.tenant_id
        )
    );

CREATE POLICY "Users can insert their tenant providers" ON tenant_providers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_tenant_memberships.user_id = auth.uid()
            AND user_tenant_memberships.tenant_id = tenant_providers.tenant_id
        )
    );

CREATE POLICY "Users can update their tenant providers" ON tenant_providers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_tenant_memberships.user_id = auth.uid()
            AND user_tenant_memberships.tenant_id = tenant_providers.tenant_id
        )
    );

-- Políticas RLS para message_logs
CREATE POLICY "Users can view their tenant message logs" ON message_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_tenant_memberships.user_id = auth.uid()
            AND user_tenant_memberships.tenant_id = message_logs.tenant_id
        )
    );

CREATE POLICY "Users can insert their tenant message logs" ON message_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_tenant_memberships.user_id = auth.uid()
            AND user_tenant_memberships.tenant_id = message_logs.tenant_id
        )
    );

CREATE POLICY "Users can update their tenant message logs" ON message_logs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_tenant_memberships.user_id = auth.uid()
            AND user_tenant_memberships.tenant_id = message_logs.tenant_id
        )
    );

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_instance_registry_updated_at BEFORE UPDATE ON instance_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_providers_updated_at BEFORE UPDATE ON tenant_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_logs_updated_at BEFORE UPDATE ON message_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir provedor padrão para o tenant de demonstração
INSERT INTO tenant_providers (tenant_id, provider_type, provider_name, provider_config, is_active)
SELECT 
    t.id,
    'whatsapp',
    'Getnet WhatsApp',
    '{
        "api_url": "https://api.getnet.com.br/whatsapp",
        "webhook_url": "https://app.ruptur.cloud/api/webhooks/whatsapp",
        "credentials": {
            "seller_id": "",
            "client_id": "",
            "client_secret": ""
        },
        "settings": {
            "auto_reply": true,
            "webhook_events": ["message", "delivery", "read"]
        }
    }'::jsonb,
    true
FROM tenants t
WHERE t.slug = 'ruptur-demo'
AND NOT EXISTS (
    SELECT 1 FROM tenant_providers tp 
    WHERE tp.tenant_id = t.id 
    AND tp.provider_type = 'whatsapp'
    AND tp.provider_name = 'Getnet WhatsApp'
);

-- Verificação
SELECT 
    'instance_registry' as table_name, 
    COUNT(*) as row_count 
FROM instance_registry
UNION ALL
SELECT 
    'tenant_providers' as table_name, 
    COUNT(*) as row_count 
FROM tenant_providers
UNION ALL
SELECT 
    'message_logs' as table_name, 
    COUNT(*) as row_count 
FROM message_logs;
