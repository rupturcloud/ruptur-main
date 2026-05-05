/**
 * Migration 009: Secrets Vault (CRÍTICA)
 *
 * Move credenciais long-lived de plaintext em runtime-data/
 * para Supabase com encryption at rest
 *
 * Tabelas:
 * - provider_secrets: Credenciais de provedores (UAZAPI, etc)
 * - secret_access_logs: Auditoria de acesso a secrets
 *
 * Execução:
 * 1. Copie todo o SQL abaixo
 * 2. Acesse Supabase > SQL Editor
 * 3. Cole e execute
 */

-- ============================================================================
-- 1. TABELA: provider_secrets (Armazenar credenciais de forma segura)
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identificação do provedor
  provider_name VARCHAR(50) NOT NULL, -- 'uazapi', 'getnet', 'stripe', etc
  provider_type VARCHAR(50), -- 'warmup', 'billing', 'payment', etc

  -- Credencial (criptografada via Supabase)
  secret_value TEXT NOT NULL, -- Deve ser criptografado em nível de app
  secret_label VARCHAR(100), -- 'Admin Token', 'API Key', etc

  -- Metadados
  is_active BOOLEAN DEFAULT true,
  rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Para secrets com validade

  -- Auditoria
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, provider_name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_provider_secrets_tenant ON provider_secrets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_secrets_provider ON provider_secrets(provider_name);
CREATE INDEX IF NOT EXISTS idx_provider_secrets_active ON provider_secrets(is_active);

-- ============================================================================
-- 2. TABELA: secret_access_logs (Auditoria)
-- ============================================================================

CREATE TABLE IF NOT EXISTS secret_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id UUID REFERENCES provider_secrets(id) ON DELETE CASCADE,

  -- Acesso
  accessed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accessed_from_ip INET,

  -- Detalhes
  action VARCHAR(50), -- 'read', 'rotate', 'revoke'
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secret_access_logs_secret ON secret_access_logs(secret_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_logs_accessed_by ON secret_access_logs(accessed_by);
CREATE INDEX IF NOT EXISTS idx_secret_access_logs_created_at ON secret_access_logs(created_at DESC);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE provider_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_access_logs ENABLE ROW LEVEL SECURITY;

-- Policy: provider_secrets
-- Apenas owners/admins do tenant podem ler secrets
CREATE POLICY provider_secrets_select ON provider_secrets
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Apenas owners podem inserir/atualizar secrets
CREATE POLICY provider_secrets_insert ON provider_secrets
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
        AND role = 'owner'
    )
  );

CREATE POLICY provider_secrets_update ON provider_secrets
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- Policy: secret_access_logs
-- Admins veem logs do seu tenant
CREATE POLICY secret_access_logs_select ON secret_access_logs
  FOR SELECT USING (
    secret_id IN (
      SELECT id FROM provider_secrets
      WHERE tenant_id IN (
        SELECT tenant_id FROM user_tenant_roles
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================================
-- 4. TRIGGER: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE TRIGGER update_provider_secrets_updated_at
  BEFORE UPDATE ON provider_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. FUNÇÃO: Registrar acesso a secret (auditoria)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_secret_access(
  p_secret_id UUID,
  p_action VARCHAR,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO secret_access_logs (
    secret_id,
    accessed_by,
    accessed_from_ip,
    action,
    reason
  ) VALUES (
    p_secret_id,
    auth.uid(),
    NULL, -- IP será preenchido pela aplicação
    p_action,
    p_reason
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNÇÃO: Recuperar secret (com auditoria automática)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_provider_secret(
  p_tenant_id UUID,
  p_provider_name VARCHAR
)
RETURNS TABLE(secret_value TEXT) AS $$
BEGIN
  -- Validar que usuário é admin do tenant
  IF NOT EXISTS (
    SELECT 1 FROM user_tenant_roles
    WHERE user_id = auth.uid()
      AND tenant_id = p_tenant_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Registrar acesso
  INSERT INTO secret_access_logs (secret_id, action)
  SELECT id, 'read'
  FROM provider_secrets
  WHERE tenant_id = p_tenant_id
    AND provider_name = p_provider_name
    AND is_active = true;

  -- Retornar secret
  RETURN QUERY
  SELECT ps.secret_value
  FROM provider_secrets ps
  WHERE ps.tenant_id = p_tenant_id
    AND ps.provider_name = p_provider_name
    AND ps.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT SELECT ON provider_secrets TO authenticated;
GRANT SELECT ON secret_access_logs TO authenticated;
GRANT EXECUTE ON FUNCTION log_secret_access TO authenticated;
GRANT EXECUTE ON FUNCTION get_provider_secret TO authenticated;

-- ============================================================================
-- FIM DA MIGRATION 009
-- ============================================================================
