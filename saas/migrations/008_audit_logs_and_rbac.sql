/**
 * Migration 008: Audit Logs + RBAC (Role-Based Access Control)
 *
 * Cria sistema de auditoria imutável e permissões de billing por role.
 *
 * Tabelas:
 * - audit_logs: Trilha imutável de todas operações (append-only)
 * - user_tenant_roles: Refactoring de user_tenant_memberships com RBAC
 * - tenant_billing_permissions: Permissões granulares de billing por tenant
 *
 * Execução:
 * 1. Copie todo o SQL abaixo
 * 2. Acesse Supabase > SQL Editor
 * 3. Cole e execute
 */

-- ============================================================================
-- 1. TABELA: audit_logs (IMUTÁVEL - append-only)
-- Trilha completa de todas operações de billing e tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Ação e contexto de negócio
  action VARCHAR(100) NOT NULL, -- 'purchase_initiated', 'payment_approved', 'refund_issued', etc
  resource_type VARCHAR(50), -- 'payment', 'subscription', 'wallet', 'tenant', etc
  resource_id UUID,

  -- Antes e depois (para auditar mudanças)
  old_value JSONB,
  new_value JSONB,

  -- Contexto de segurança (para debugging e compliance)
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  acting_as_role VARCHAR(50), -- qual role o usuário tinha quando fez a ação

  -- Metadata flexível (para contexto adicional)
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================================
-- 2. REFACTORING: user_tenant_roles (melhorado de user_tenant_memberships)
-- Armazena role de cada usuário em cada tenant + permissões customizadas
-- ============================================================================

-- Primeiro, cria tabela nova (não destrói a antiga ainda)
CREATE TABLE IF NOT EXISTS user_tenant_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Role padrão do usuário neste tenant
  role VARCHAR(50) NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),

  -- Permissões customizadas (para override de role)
  -- Útil para: "admin mas sem permissão de refund", etc
  permissions JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Garantir 1 role por user/tenant
  UNIQUE(user_id, tenant_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user ON user_tenant_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_tenant ON user_tenant_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_role ON user_tenant_roles(role);

-- ============================================================================
-- 3. TABELA: tenant_billing_permissions
-- Permissões granulares de billing por tenant (quem pode fazer o quê)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_billing_permissions (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Quem pode fazer cada ação (arrays de roles)
  purchase_allowed_roles TEXT[] DEFAULT ARRAY['owner', 'admin'],
  view_billing_allowed_roles TEXT[] DEFAULT ARRAY['owner', 'admin', 'member'],
  manage_subscription_allowed_roles TEXT[] DEFAULT ARRAY['owner', 'admin'],
  refund_allowed_roles TEXT[] DEFAULT ARRAY['owner'],

  -- Limites de compra (proteção contra fraud)
  max_purchase_amount DECIMAL(10,2), -- NULL = sem limite
  require_approval_above DECIMAL(10,2), -- NULL = não requer aprovação

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- Garantir isolamento de dados entre tenants
-- ============================================================================

-- Habilitar RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_billing_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: audit_logs
-- Usuários veem audits do seu tenant
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
    )
  );

-- Admins podem inserir audit logs
CREATE POLICY audit_logs_insert_admin ON audit_logs
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT utr.tenant_id FROM user_tenant_roles utr
      WHERE utr.user_id = auth.uid()
        AND utr.role IN ('owner', 'admin')
    )
  );

-- Policy: user_tenant_roles
-- Usuários veem suas próprias roles
CREATE POLICY user_tenant_roles_select ON user_tenant_roles
  FOR SELECT USING (user_id = auth.uid());

-- Owners/admins veem todas as roles do tenant
CREATE POLICY user_tenant_roles_admin_select ON user_tenant_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles other
      WHERE other.tenant_id = user_tenant_roles.tenant_id
        AND other.user_id = auth.uid()
        AND other.role IN ('owner', 'admin')
    )
  );

-- Policy: tenant_billing_permissions
-- Usuários veem permissões do seu tenant
CREATE POLICY billing_permissions_select ON tenant_billing_permissions
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. TRIGGER: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE TRIGGER update_user_tenant_roles_updated_at
  BEFORE UPDATE ON user_tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_tenant_billing_permissions_updated_at
  BEFORE UPDATE ON tenant_billing_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. FUNÇÃO: Criar permissões padrão para novo tenant
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_billing_permissions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tenant_billing_permissions (tenant_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach ao trigger existente de tenants, ou cria novo
CREATE TRIGGER trigger_create_default_billing_permissions
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_default_billing_permissions();

-- ============================================================================
-- 7. FUNÇÃO: Auditar operação (helper para aplicação chamar)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_operation(
  p_tenant_id UUID,
  p_user_id UUID,
  p_action VARCHAR,
  p_resource_type VARCHAR DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_acting_as_role VARCHAR DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_logs (
    tenant_id, user_id, action, resource_type, resource_id,
    old_value, new_value, ip_address, user_agent, session_id,
    acting_as_role, metadata
  ) VALUES (
    p_tenant_id, p_user_id, p_action, p_resource_type, p_resource_id,
    p_old_value, p_new_value, p_ip_address, p_user_agent, p_session_id,
    p_acting_as_role, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. GRANTS (Permissões de Banco)
-- ============================================================================

GRANT SELECT ON audit_logs TO authenticated;
GRANT SELECT ON user_tenant_roles TO authenticated;
GRANT SELECT ON tenant_billing_permissions TO authenticated;

-- Funções podem ser chamadas por usuários autenticados
GRANT EXECUTE ON FUNCTION audit_operation TO authenticated;

-- ============================================================================
-- 9. MIGRAÇÃO DE DADOS (opcional, descomente se quiser)
-- ============================================================================

-- Copiar dados de user_tenant_memberships → user_tenant_roles
-- DO $$
-- BEGIN
--   INSERT INTO user_tenant_roles (user_id, tenant_id, role, created_at)
--   SELECT user_id, tenant_id, role, created_at
--   FROM user_tenant_memberships
--   ON CONFLICT (user_id, tenant_id) DO NOTHING;
-- END $$;

-- ============================================================================
-- FIM DA MIGRATION 008
-- ============================================================================
