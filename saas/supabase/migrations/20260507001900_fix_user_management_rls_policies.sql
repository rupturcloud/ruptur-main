-- ============================================================================
-- Migration 019: Fix RLS Policies para User Management
-- Corrige RLS policies em tenants e user_tenant_roles para funcionar com novo modelo
-- ============================================================================

-- 1. Dropar antiga policy que só checa user_tenant_memberships
DROP POLICY IF EXISTS tenants_isolation ON tenants;

-- 2. Criar nova policy que checa AMBAS as tabelas (backwards compatibility)
CREATE POLICY tenants_isolation ON tenants
  FOR ALL USING (
    id IN (
      SELECT tenant_id FROM user_tenant_memberships
      WHERE user_id = auth.uid()
    )
    OR
    id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
    )
  );

-- 3. Melhorar policy em user_tenant_roles para ser mais permissiva na leitura
-- Permitir que o usuário veja seus próprios registros
DROP POLICY IF EXISTS user_tenant_roles_select ON user_tenant_roles;
CREATE POLICY user_tenant_roles_select ON user_tenant_roles
  FOR SELECT USING (
    user_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- 4. Permitir que admins e owners vejam todas as roles do tenant
DROP POLICY IF EXISTS user_tenant_roles_admin_select ON user_tenant_roles;
CREATE POLICY user_tenant_roles_admin_select ON user_tenant_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles other
      WHERE other.tenant_id = user_tenant_roles.tenant_id
        AND other.user_id = auth.uid()
        AND other.role IN ('owner', 'admin')
    )
  );

-- 5. Permitir insert de novos roles (registrando convites aceitos)
DROP POLICY IF EXISTS user_tenant_roles_insert ON user_tenant_roles;
CREATE POLICY user_tenant_roles_insert ON user_tenant_roles
  FOR INSERT WITH CHECK (
    -- Qualquer usuário autenticado pode inserir seu próprio registro
    user_id = auth.uid() OR
    -- Ou um admin/owner pode inserir para outro usuário no tenant
    EXISTS (
      SELECT 1 FROM user_tenant_roles other
      WHERE other.tenant_id = user_tenant_roles.tenant_id
        AND other.user_id = auth.uid()
        AND other.role IN ('owner', 'admin')
    )
  );

-- 6. Permitir que usuário atualize seu próprio perfil, ou admin/owner atualize outros
DROP POLICY IF EXISTS user_tenant_roles_update ON user_tenant_roles;
CREATE POLICY user_tenant_roles_update ON user_tenant_roles
  FOR UPDATE USING (
    -- Usuário só pode atualizar seu próprio registro se status não é inactive
    (user_id = auth.uid() AND status != 'inactive') OR
    -- Admin/owner pode atualizar qualquer um no tenant (exceto soft-delete, que é apenas admin)
    EXISTS (
      SELECT 1 FROM user_tenant_roles other
      WHERE other.tenant_id = user_tenant_roles.tenant_id
        AND other.user_id = auth.uid()
        AND other.role IN ('owner', 'admin')
    )
  );

-- 7. RLS para user_tenant_memberships (compatibilidade)
DROP POLICY IF EXISTS user_tenant_memberships_select ON user_tenant_memberships;
CREATE POLICY user_tenant_memberships_select ON user_tenant_memberships
  FOR SELECT USING (
    user_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
