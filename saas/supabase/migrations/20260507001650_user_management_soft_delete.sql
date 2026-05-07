-- ============================================================================
-- Migration 015: User Management - Soft Delete & Token Invalidation
-- Adiciona suporte para soft-delete e invalidação de tokens
-- ============================================================================

-- 1. Adicionar colunas de soft-delete em user_tenant_roles
ALTER TABLE user_tenant_roles
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'inactive'));

ALTER TABLE user_tenant_roles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE user_tenant_roles
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Adicionar coluna de invalidação de tokens
ALTER TABLE user_tenant_roles
ADD COLUMN IF NOT EXISTS token_invalidated_at TIMESTAMPTZ;

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_status ON user_tenant_roles(status);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_deleted_at ON user_tenant_roles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_token_invalidated_at ON user_tenant_roles(token_invalidated_at);

-- 4. Trigger para auditar mudanças de status
CREATE OR REPLACE FUNCTION audit_user_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, old_value, new_value, acting_as_role)
    VALUES (
      NEW.tenant_id,
      COALESCE(NEW.deleted_by, current_user_id()),
      'user_status_changed',
      'user_role',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      NEW.role
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_user_status_change_trigger ON user_tenant_roles;
CREATE TRIGGER audit_user_status_change_trigger
  AFTER UPDATE ON user_tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_status_change();

-- 5. Trigger para auditar remoção de usuários
CREATE OR REPLACE FUNCTION audit_user_removal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'inactive' AND OLD.status != 'inactive' THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, old_value, new_value, metadata)
    VALUES (
      NEW.tenant_id,
      COALESCE(NEW.deleted_by, current_user_id()),
      'user_removed_from_tenant',
      'user_role',
      NEW.id,
      jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role),
      jsonb_build_object('deleted_at', NEW.deleted_at, 'deleted_by', NEW.deleted_by),
      jsonb_build_object('reason', 'user_deactivated')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_user_removal_trigger ON user_tenant_roles;
CREATE TRIGGER audit_user_removal_trigger
  AFTER UPDATE ON user_tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_removal();

-- 6. Trigger para garantir que sempre há pelo menos 1 admin/owner por tenant
CREATE OR REPLACE FUNCTION enforce_min_admins()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF NEW.status = 'inactive' AND (NEW.role = 'admin' OR NEW.role = 'owner') THEN
    SELECT COUNT(*) INTO admin_count
    FROM user_tenant_roles
    WHERE tenant_id = NEW.tenant_id
      AND status = 'active'
      AND (role = 'admin' OR role = 'owner')
      AND id != NEW.id;

    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove last admin from tenant. Assign another admin first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_min_admins_trigger ON user_tenant_roles;
CREATE TRIGGER enforce_min_admins_trigger
  BEFORE UPDATE ON user_tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_min_admins();

-- 7. Trigger para auditar mudanças de role
CREATE OR REPLACE FUNCTION audit_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, old_value, new_value, acting_as_role)
    VALUES (
      NEW.tenant_id,
      current_user_id(),
      'user_role_changed',
      'user_role',
      NEW.id,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role),
      NEW.role
    );

    -- Invalidar tokens quando role muda (força re-login)
    NEW.token_invalidated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_role_change_trigger ON user_tenant_roles;
CREATE TRIGGER audit_role_change_trigger
  BEFORE UPDATE ON user_tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION audit_role_change();

-- 8. View para usuários ativos apenas
CREATE OR REPLACE VIEW active_user_tenant_roles AS
SELECT *
FROM user_tenant_roles
WHERE status = 'active';

-- 9. RLS: Apenas superadmins podem ver usuários inativos
DROP POLICY IF EXISTS "see_inactive_users" ON user_tenant_roles;
CREATE POLICY "see_inactive_users"
  ON user_tenant_roles FOR SELECT
  USING (
    status = 'active' OR
    auth.jwt() ->> 'app_role' = 'superadmin'
  );
