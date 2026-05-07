-- ============================================================================
-- Migration 016: User Tenant Invites
-- Sistema de convites com expiração, rate limiting e auditoria
-- ============================================================================

-- 1. Tabela de convites
CREATE TABLE IF NOT EXISTS user_tenant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_role VARCHAR(50) NOT NULL DEFAULT 'member'
    CHECK (invited_role IN ('owner', 'admin', 'member')),

  -- Token único para aceitar convite
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Status do convite
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),

  -- Quem convidou
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Quem aceitou (quando aceito)
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Garantir apenas 1 convite ativo por email/tenant
  UNIQUE(tenant_id, email, status)
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_tenant ON user_tenant_invites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_email ON user_tenant_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_token ON user_tenant_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_status ON user_tenant_invites(status);
CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_expires_at ON user_tenant_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_invited_by ON user_tenant_invites(invited_by);

-- 3. RLS
ALTER TABLE user_tenant_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invites_visible_to_admins" ON user_tenant_invites;
CREATE POLICY "invites_visible_to_admins"
  ON user_tenant_invites FOR SELECT
  USING (
    auth.jwt() ->> 'app_role' = 'superadmin' OR
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "invites_creatable_by_admins" ON user_tenant_invites;
CREATE POLICY "invites_creatable_by_admins"
  ON user_tenant_invites FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- 4. Trigger: Validar que invite não está expirado
CREATE OR REPLACE FUNCTION validate_invite_not_expired()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.expires_at < NOW() THEN
    NEW.status = 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_invite_not_expired_trigger ON user_tenant_invites;
CREATE TRIGGER validate_invite_not_expired_trigger
  BEFORE INSERT OR UPDATE ON user_tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION validate_invite_not_expired();

-- 5. Trigger: Auditar criação de convite
CREATE OR REPLACE FUNCTION audit_invite_created()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, new_value, metadata)
    VALUES (
      NEW.tenant_id,
      NEW.invited_by,
      'invite_sent',
      'user_invite',
      NEW.id,
      jsonb_build_object('email', NEW.email, 'role', NEW.invited_role),
      jsonb_build_object('expires_at', NEW.expires_at)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_invite_created_trigger ON user_tenant_invites;
CREATE TRIGGER audit_invite_created_trigger
  AFTER INSERT ON user_tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION audit_invite_created();

-- 6. Trigger: Auditar aceitação de convite
CREATE OR REPLACE FUNCTION audit_invite_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, old_value, new_value, metadata)
    VALUES (
      NEW.tenant_id,
      NEW.accepted_by_user_id,
      'invite_accepted',
      'user_invite',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      jsonb_build_object('email', NEW.email, 'role', NEW.invited_role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_invite_accepted_trigger ON user_tenant_invites;
CREATE TRIGGER audit_invite_accepted_trigger
  AFTER UPDATE ON user_tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION audit_invite_accepted();

-- 7. Trigger: Auditar rejeição/expiração de convite
CREATE OR REPLACE FUNCTION audit_invite_rejected()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('rejected', 'expired', 'cancelled') AND OLD.status != NEW.status THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, old_value, new_value, metadata)
    VALUES (
      NEW.tenant_id,
      COALESCE(NEW.invited_by, current_user_id()),
      'invite_' || NEW.status,
      'user_invite',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      jsonb_build_object('email', NEW.email)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_invite_rejected_trigger ON user_tenant_invites;
CREATE TRIGGER audit_invite_rejected_trigger
  AFTER UPDATE ON user_tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION audit_invite_rejected();

-- 8. Trigger: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_tenant_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_tenant_invites_updated_at_trigger ON user_tenant_invites;
CREATE TRIGGER update_user_tenant_invites_updated_at_trigger
  BEFORE UPDATE ON user_tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_user_tenant_invites_updated_at();

-- 9. View: Invites pendentes
CREATE OR REPLACE VIEW pending_user_invites AS
SELECT *
FROM user_tenant_invites
WHERE status = 'pending' AND expires_at > NOW();
