-- ============================================================================
-- Migration 017: Action Tokens
-- Tokens para dupla confirmação em ações críticas (remover usuário, mudar role, etc)
-- ============================================================================

-- 1. Tabela de action tokens
CREATE TABLE IF NOT EXISTS action_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Qual ação requer confirmação
  action VARCHAR(50) NOT NULL
    CHECK (action IN ('remove_user', 'change_role', 'suspend_user', 'restore_user')),
  
  -- Dados da ação (o que vai ser feito)
  action_data JSONB NOT NULL DEFAULT '{}',

  -- Token único para confirmar
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),

  -- Quando foi confirmado
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_action_tokens_tenant ON action_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_action_tokens_user ON action_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_action_tokens_target_user ON action_tokens(target_user_id);
CREATE INDEX IF NOT EXISTS idx_action_tokens_token ON action_tokens(token);
CREATE INDEX IF NOT EXISTS idx_action_tokens_status ON action_tokens(status);
CREATE INDEX IF NOT EXISTS idx_action_tokens_action ON action_tokens(action);
CREATE INDEX IF NOT EXISTS idx_action_tokens_expires_at ON action_tokens(expires_at);

-- 3. RLS
ALTER TABLE action_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "action_tokens_visible_to_creators" ON action_tokens;
CREATE POLICY "action_tokens_visible_to_creators"
  ON action_tokens FOR SELECT
  USING (
    auth.jwt() ->> 'app_role' = 'superadmin' OR
    user_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "action_tokens_creatable_by_admins" ON action_tokens;
CREATE POLICY "action_tokens_creatable_by_admins"
  ON action_tokens FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "action_tokens_confirmable_by_all" ON action_tokens;
CREATE POLICY "action_tokens_confirmable_by_all"
  ON action_tokens FOR UPDATE
  USING (
    token IS NOT NULL AND
    (
      auth.jwt() ->> 'app_role' = 'superadmin' OR
      auth.uid() = confirmed_by
    )
  );

-- 4. Trigger: Validar token não expirado
CREATE OR REPLACE FUNCTION validate_action_token_not_expired()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.expires_at < NOW() THEN
    NEW.status = 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_action_token_not_expired_trigger ON action_tokens;
CREATE TRIGGER validate_action_token_not_expired_trigger
  BEFORE INSERT OR UPDATE ON action_tokens
  FOR EACH ROW
  EXECUTE FUNCTION validate_action_token_not_expired();

-- 5. Trigger: Auditar confirmação de action token
CREATE OR REPLACE FUNCTION audit_action_token_used()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, new_value, metadata, acting_as_role)
    VALUES (
      NEW.tenant_id,
      NEW.confirmed_by,
      'action_confirmed_' || NEW.action,
      'action_token',
      NEW.id,
      jsonb_build_object('action', NEW.action, 'target_user_id', NEW.target_user_id),
      NEW.action_data,
      (SELECT role FROM user_tenant_roles WHERE user_id = NEW.confirmed_by AND tenant_id = NEW.tenant_id LIMIT 1)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_action_token_used_trigger ON action_tokens;
CREATE TRIGGER audit_action_token_used_trigger
  AFTER UPDATE ON action_tokens
  FOR EACH ROW
  EXECUTE FUNCTION audit_action_token_used();

-- 6. Trigger: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_action_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_action_tokens_updated_at_trigger ON action_tokens;
CREATE TRIGGER update_action_tokens_updated_at_trigger
  BEFORE UPDATE ON action_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_action_tokens_updated_at();

-- 7. View: Pending action tokens
CREATE OR REPLACE VIEW pending_action_tokens AS
SELECT *
FROM action_tokens
WHERE status = 'pending' AND expires_at > NOW();
