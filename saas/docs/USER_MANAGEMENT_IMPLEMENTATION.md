# User Management - Especificação Técnica de Implementação

**Status**: Ready for Development  
**Priority**: P0 (Critical for enterprise SaaS)  
**Complexity**: Medium-High  
**Estimated Duration**: 2-3 sprints

---

## PHASE 1: DATABASE MIGRATIONS (1-2 dias)

### ✅ Task 1.1: Alterar `user_tenant_roles` com colunas de soft-delete

**Arquivo**: `/saas/supabase/migrations/20260507001600_user_management_soft_delete.sql`

```sql
/**
 * Migration: User Management - Soft Delete & Audit
 * Data: 2026-05-07
 * 
 * Adiciona:
 * - status (active, suspended, inactive)
 * - deleted_at (quando foi deletado)
 * - deleted_by (quem deletou)
 * - token_invalidated_at (para revogar tokens)
 */

-- ============================================================================
-- 1. ALTER: user_tenant_roles com soft-delete
-- ============================================================================

ALTER TABLE user_tenant_roles
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'inactive'));

ALTER TABLE user_tenant_roles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE user_tenant_roles
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE user_tenant_roles
ADD COLUMN IF NOT EXISTS token_invalidated_at TIMESTAMPTZ;

-- ============================================================================
-- 2. ÍNDICES para queries rápidas
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_status 
  ON user_tenant_roles(status);

CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_deleted_at 
  ON user_tenant_roles(deleted_at) 
  WHERE status = 'inactive';

CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_token_invalidated 
  ON user_tenant_roles(token_invalidated_at) 
  WHERE token_invalidated_at IS NOT NULL;

-- ============================================================================
-- 3. TRIGGER: Log automático de mudanças de role
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_logs (
      tenant_id, 
      user_id, 
      action, 
      resource_type, 
      resource_id, 
      old_value, 
      new_value,
      acting_as_role
    ) VALUES (
      NEW.tenant_id,
      auth.uid(),
      'user_role_changed',
      'user_role',
      NEW.id,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role),
      (
        SELECT role FROM user_tenant_roles 
        WHERE user_id = auth.uid() 
        AND tenant_id = NEW.tenant_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_user_role_change ON user_tenant_roles;
CREATE TRIGGER audit_user_role_change
  AFTER UPDATE ON user_tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION audit_role_change();

-- ============================================================================
-- 4. TRIGGER: Log automático de soft-delete
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_user_removal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'inactive' AND OLD.status != 'inactive' THEN
    INSERT INTO audit_logs (
      tenant_id, 
      user_id, 
      action, 
      resource_type, 
      resource_id, 
      old_value, 
      new_value,
      metadata
    ) VALUES (
      NEW.tenant_id,
      NEW.deleted_by,
      'user_removed_from_tenant',
      'user_membership',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'deleted_at', NEW.deleted_at),
      jsonb_build_object('removed_user_id', NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_user_removal ON user_tenant_roles;
CREATE TRIGGER audit_user_removal
  AFTER UPDATE ON user_tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_removal();

-- ============================================================================
-- 5. FUNÇÃO: Validar que sempre há pelo menos 1 admin ativo
-- ============================================================================

CREATE OR REPLACE FUNCTION check_min_admins()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF NEW.status = 'inactive' AND OLD.status = 'active' 
     AND OLD.role IN ('owner', 'admin') THEN
    
    SELECT COUNT(*)::INTEGER INTO admin_count
    FROM user_tenant_roles
    WHERE tenant_id = NEW.tenant_id
      AND status = 'active'
      AND role IN ('owner', 'admin')
      AND id != NEW.id;

    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove last admin from tenant %', NEW.tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_min_admins ON user_tenant_roles;
CREATE TRIGGER enforce_min_admins
  BEFORE UPDATE ON user_tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION check_min_admins();

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
```

---

### ✅ Task 1.2: Criar tabela `user_tenant_invites`

**Arquivo**: `/saas/supabase/migrations/20260507001700_user_tenant_invites.sql`

```sql
/**
 * Migration: User Tenant Invites
 * 
 * Tabela para gerenciar convites de usuários com:
 * - Expiração em 7 dias
 * - Token único por convite
 * - Status tracking (pending, accepted, rejected, expired)
 * - Email validation dupla
 */

-- ============================================================================
-- 1. TABELA: user_tenant_invites
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_tenant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Email do usuário sendo convidado
  email TEXT NOT NULL,
  invited_role VARCHAR(50) NOT NULL DEFAULT 'member'
    CHECK (invited_role IN ('owner', 'admin', 'member')),
  
  -- Token para aceitação única
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Status do convite
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  
  -- Quem convidou
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Quem aceitou (se status = accepted)
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índices únicos
  UNIQUE(tenant_id, email, status)  -- Uma vez aceito, pode convidar de novo
);

-- ============================================================================
-- 2. ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_tenant 
  ON user_tenant_invites(tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_email 
  ON user_tenant_invites(email);

CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_token 
  ON user_tenant_invites(token);

CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_status 
  ON user_tenant_invites(status);

CREATE INDEX IF NOT EXISTS idx_user_tenant_invites_expires 
  ON user_tenant_invites(expires_at) 
  WHERE status = 'pending';

-- ============================================================================
-- 3. TRIGGER: Validar expiração ao atualizar
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_invite_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Se está tentando aceitar um convite expirado, mudar status
  IF NEW.status = 'accepted' AND NOW() > NEW.expires_at THEN
    NEW.status = 'expired';
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_invite_expiration ON user_tenant_invites;
CREATE TRIGGER validate_invite_expiration
  BEFORE UPDATE ON user_tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION validate_invite_expiration();

-- ============================================================================
-- 4. TRIGGER: Log de convites aceitos
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_invite_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO audit_logs (
      tenant_id, 
      user_id, 
      action, 
      resource_type, 
      resource_id, 
      old_value, 
      new_value,
      metadata
    ) VALUES (
      NEW.tenant_id,
      NEW.accepted_by_user_id,
      'invite_accepted',
      'user_invite',
      NEW.id,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', 'accepted', 'email', NEW.email),
      jsonb_build_object('invited_email', NEW.email)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_invite_accepted ON user_tenant_invites;
CREATE TRIGGER audit_invite_accepted
  AFTER UPDATE ON user_tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION audit_invite_accepted();

-- ============================================================================
-- 5. TRIGGER: auto-update updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_user_tenant_invites_updated_at ON user_tenant_invites;
CREATE TRIGGER update_user_tenant_invites_updated_at
  BEFORE UPDATE ON user_tenant_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
```

---

### ✅ Task 1.3: Criar tabela `action_tokens` (dupla confirmação)

**Arquivo**: `/saas/supabase/migrations/20260507001800_action_tokens.sql`

```sql
/**
 * Migration: Action Tokens para Dupla Confirmação
 * 
 * Para ações críticas como:
 * - Remover último admin
 * - Deletar tenant
 * - Mudar billing
 */

-- ============================================================================
-- 1. TABELA: action_tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Quem está fazendo a ação
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Quem está sendo afetado (opcional)
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tipo de ação
  action VARCHAR(100) NOT NULL,
  
  -- Dados da ação (para reverter se necessário)
  action_data JSONB NOT NULL DEFAULT '{}',
  
  -- Token para validação
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'used', 'expired', 'cancelled')),
  
  used_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ÍNDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_action_tokens_token 
  ON action_tokens(token);

CREATE INDEX IF NOT EXISTS idx_action_tokens_user 
  ON action_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_action_tokens_target_user 
  ON action_tokens(target_user_id);

CREATE INDEX IF NOT EXISTS idx_action_tokens_status 
  ON action_tokens(status);

CREATE INDEX IF NOT EXISTS idx_action_tokens_expires 
  ON action_tokens(expires_at) 
  WHERE status = 'pending';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
```

---

## PHASE 2: BACKEND SERVICES (3-4 dias)

### ✅ Task 2.1: `UserManagementService`

**Arquivo**: `/saas/modules/users/user-management.service.js`

```javascript
/**
 * User Management Service
 * 
 * Responsabilidades:
 * - Gerenciar usuários do tenant
 * - Validações de permissions
 * - Auditoria automática
 */

export class UserManagementService {
  constructor(supabase, auditService) {
    this.db = supabase;
    this.audit = auditService;
  }

  /**
   * Listar usuários ativos de um tenant
   */
  async listTenantUsers(tenantId, { limit = 25, offset = 0, status = 'active' } = {}) {
    const query = this.db
      .from('user_tenant_roles')
      .select(`
        id,
        user_id,
        role,
        status,
        created_at,
        auth.users(email)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    
    return {
      data: data || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit
    };
  }

  /**
   * Obter role específico de um usuário
   */
  async getUserRole(userId, tenantId) {
    const { data, error } = await this.db
      .from('user_tenant_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  /**
   * Atualizar role de um usuário
   * @throws Se for removido último admin
   */
  async updateUserRole(userId, tenantId, newRole, { byUserId }) {
    // 1. Validar que novo role é válido
    const VALID_ROLES = ['owner', 'admin', 'member'];
    if (!VALID_ROLES.includes(newRole)) {
      throw new Error(`Invalid role: ${newRole}`);
    }

    // 2. Obter role atual
    const currentRole = await this.getUserRole(userId, tenantId);
    if (!currentRole) {
      throw new Error(`User not found in tenant`);
    }

    // 3. Se mudando para de admin/owner, validar último admin
    if (
      (currentRole.role === 'owner' || currentRole.role === 'admin') &&
      newRole !== 'admin' &&
      newRole !== 'owner'
    ) {
      const adminCount = await this._getAdminCount(tenantId);
      if (adminCount === 1) {
        throw new Error('Cannot remove last admin from tenant');
      }
    }

    // 4. Atualizar
    const { error } = await this.db
      .from('user_tenant_roles')
      .update({
        role: newRole,
        updated_at: new Date()
      })
      .eq('id', currentRole.id);

    if (error) throw error;

    // 5. Trigger de audit é automático, mas podemos adicionar metadata
    await this.audit.log(tenantId, byUserId, 'user_role_updated', {
      target_user_id: userId,
      old_role: currentRole.role,
      new_role: newRole
    });

    return { success: true, oldRole: currentRole.role, newRole };
  }

  /**
   * Soft-delete: remover usuário do tenant
   * @throws Se for removido último admin
   */
  async removeUserFromTenant(userId, tenantId, { byUserId, reason = '' }) {
    // 1. Obter role do usuário
    const userRole = await this.getUserRole(userId, tenantId);
    if (!userRole) {
      throw new Error('User not in this tenant');
    }

    // 2. Validar que não é último admin
    if (userRole.role === 'admin' || userRole.role === 'owner') {
      const adminCount = await this._getAdminCount(tenantId);
      if (adminCount === 1) {
        throw new Error('Cannot remove last admin. Assign another admin first.');
      }
    }

    // 3. Soft-delete
    const { error } = await this.db
      .from('user_tenant_roles')
      .update({
        status: 'inactive',
        deleted_at: new Date(),
        deleted_by: byUserId,
        token_invalidated_at: new Date(),
        updated_at: new Date()
      })
      .eq('id', userRole.id);

    if (error) throw error;

    // 4. Log
    await this.audit.log(tenantId, byUserId, 'user_removed', {
      target_user_id: userId,
      reason
    });

    return { success: true, removedUser: userRole };
  }

  /**
   * Suspender/reativar usuário
   */
  async toggleUserStatus(userId, tenantId, newStatus, { byUserId }) {
    const VALID_STATUSES = ['active', 'suspended', 'inactive'];
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const userRole = await this.getUserRole(userId, tenantId);
    if (!userRole) throw new Error('User not found in tenant');

    const { error } = await this.db
      .from('user_tenant_roles')
      .update({
        status: newStatus,
        updated_at: new Date(),
        ...(newStatus === 'inactive' && {
          deleted_at: new Date(),
          deleted_by: byUserId
        })
      })
      .eq('id', userRole.id);

    if (error) throw error;

    // Invalidar tokens se suspenso
    if (newStatus === 'suspended') {
      await this.db
        .from('user_tenant_roles')
        .update({ token_invalidated_at: new Date() })
        .eq('id', userRole.id);
    }

    await this.audit.log(tenantId, byUserId, `user_${newStatus}`, {
      target_user_id: userId
    });

    return { success: true };
  }

  /**
   * Validar permissão para ação
   */
  async hasPermission(userId, tenantId, action) {
    const role = await this.getUserRole(userId, tenantId);
    if (!role || role.status !== 'active') return false;

    const PERMISSIONS = {
      'manage_users': ['owner', 'admin'],
      'invite_users': ['owner', 'admin'],
      'remove_users': ['owner', 'admin'],
      'change_user_role': ['owner'],
      'view_audit_logs': ['owner', 'admin'],
      'manage_billing': ['owner'],
      'manage_team': ['owner', 'admin'],
      'use_features': ['owner', 'admin', 'member']
    };

    const allowed = PERMISSIONS[action] || [];
    return allowed.includes(role.role);
  }

  /**
   * Helper: Contar admins ativos
   */
  async _getAdminCount(tenantId) {
    const { count, error } = await this.db
      .from('user_tenant_roles')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin']);

    if (error) throw error;
    return count || 0;
  }
}
```

---

### ✅ Task 2.2: `InviteService`

**Arquivo**: `/saas/modules/users/invite.service.js`

```javascript
/**
 * Invite Service
 * 
 * Gerenciar convites com:
 * - Rate limiting
 * - Validação de email
 * - Expiração automática
 */

import crypto from 'crypto';

export class InviteService {
  constructor(supabase, emailService, auditService) {
    this.db = supabase;
    this.email = emailService;
    this.audit = auditService;
  }

  /**
   * Gerar token único
   */
  _generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validar email
   */
  _validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !regex.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Validar rate limit
   */
  async checkRateLimit(tenantId, byUserId) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [hourCount, dayCount] = await Promise.all([
      this.db
        .from('user_tenant_invites')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('invited_by', byUserId)
        .gte('created_at', oneHourAgo.toISOString()),
      this.db
        .from('user_tenant_invites')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('invited_by', byUserId)
        .gte('created_at', oneDayAgo.toISOString())
    ]);

    return {
      hourUsed: hourCount.count || 0,
      dayUsed: dayCount.count || 0,
      hourLimit: 10,
      dayLimit: 30,
      canInvite: (hourCount.count || 0) < 10 && (dayCount.count || 0) < 30
    };
  }

  /**
   * Convidar novo usuário
   */
  async inviteUser(tenantId, email, role, { byUserId }) {
    // 1. Validar email
    this._validateEmail(email);

    // 2. Validar role
    if (!['owner', 'admin', 'member'].includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    // 3. Validar rate limit
    const rateLimit = await this.checkRateLimit(tenantId, byUserId);
    if (!rateLimit.canInvite) {
      throw new Error(
        `Rate limit exceeded. You have sent ${rateLimit.hourUsed}/10 invites this hour.`
      );
    }

    // 4. Validar se usuário já é membro
    const existingUser = await this.db
      .from('user_tenant_roles')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('auth.users.email', email)
      .eq('status', 'active')
      .single();

    if (existingUser.data) {
      throw new Error(`${email} is already a member of this team`);
    }

    // 5. Validar se convite já está pendente
    const existingInvite = await this.db
      .from('user_tenant_invites')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('email', email)
      .eq('status', 'pending')
      .single();

    if (existingInvite.data) {
      throw new Error(`Invite already pending for ${email}`);
    }

    // 6. Criar convite
    const token = this._generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data, error } = await this.db
      .from('user_tenant_invites')
      .insert({
        tenant_id: tenantId,
        email,
        invited_role: role,
        token,
        expires_at: expiresAt,
        invited_by: byUserId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // 7. Enviar email
    const inviteUrl = `${process.env.APP_URL}/join-team?token=${token}`;
    await this.email.send(email, 'invite-email', {
      inviteUrl,
      expiresAt,
      tenantName: 'Your Team'
    });

    // 8. Log de auditoria
    await this.audit.log(tenantId, byUserId, 'user_invited', {
      invited_email: email,
      invited_role: role
    });

    return {
      inviteId: data.id,
      email,
      expiresAt,
      inviteUrl
    };
  }

  /**
   * Aceitar convite
   */
  async acceptInvite(token, userEmail, { userId }) {
    // 1. Validar email
    this._validateEmail(userEmail);

    // 2. Buscar convite
    const { data: invite, error } = await this.db
      .from('user_tenant_invites')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !invite) {
      throw new Error('Invalid invite token');
    }

    // 3. Validar que não expirou
    if (new Date(invite.expires_at) < new Date()) {
      // Marcar como expirado
      await this.db
        .from('user_tenant_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);

      throw new Error('Invite has expired. Request a new one.');
    }

    // 4. Validar status
    if (invite.status !== 'pending') {
      throw new Error(`Invite already ${invite.status}`);
    }

    // 5. Validar email match (segurança!)
    if (userEmail.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error(
        `Email mismatch. You are logged in as ${userEmail} but invite is for ${invite.email}`
      );
    }

    // 6. Criar role no tenant
    const { error: roleError } = await this.db
      .from('user_tenant_roles')
      .insert({
        user_id: userId,
        tenant_id: invite.tenant_id,
        role: invite.invited_role,
        status: 'active',
        created_at: new Date()
      });

    if (roleError) throw roleError;

    // 7. Marcar convite como aceito
    await this.db
      .from('user_tenant_invites')
      .update({
        status: 'accepted',
        accepted_by_user_id: userId,
        accepted_at: new Date()
      })
      .eq('id', invite.id);

    // 8. Log
    await this.audit.log(invite.tenant_id, userId, 'invite_accepted', {
      invited_by: invite.invited_by
    });

    return {
      success: true,
      tenantId: invite.tenant_id,
      role: invite.invited_role
    };
  }

  /**
   * Cancelar convite pendente
   */
  async cancelInvite(inviteId, tenantId, { byUserId }) {
    const { error } = await this.db
      .from('user_tenant_invites')
      .update({ status: 'rejected' })
      .eq('id', inviteId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    await this.audit.log(tenantId, byUserId, 'invite_cancelled', {
      invite_id: inviteId
    });

    return { success: true };
  }

  /**
   * Listar convites pendentes
   */
  async listPendingInvites(tenantId) {
    const { data, error } = await this.db
      .from('user_tenant_invites')
      .select(`
        id,
        email,
        invited_role,
        created_at,
        expires_at,
        invited_by
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(invite => ({
      ...invite,
      isExpired: new Date(invite.expires_at) < new Date(),
      expiresIn: Math.ceil((new Date(invite.expires_at) - new Date()) / (1000 * 60))
    }));
  }
}
```

---

## PHASE 3: FRONTEND UI (4-5 dias)

### ✅ Task 3.1: `TeamMembersPage` component

**Localização**: `/saas/web/client-area/src/pages/TeamMembersPage.jsx`

```jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Mail, Trash2, Shield, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import UserTable from '../components/UserTable';
import InviteModal from '../components/InviteModal';
import ConfirmDialog from '../components/ConfirmDialog';
import AuditLog from '../components/AuditLog';
import Toast from '../components/Toast';

export default function TeamMembersPage() {
  const { session } = useAuth();
  const tenantId = session?.tenant_id;

  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [inviteModal, setInviteModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [toast, setToast] = useState(null);

  // Fetch inicial
  useEffect(() => {
    if (!tenantId) return;
    fetchData();
  }, [tenantId]);

  // Real-time sync
  useEffect(() => {
    if (!tenantId) return;

    const subscription = apiService.supabase
      .from('user_tenant_roles')
      .on('*', (payload) => {
        console.log('Real-time update:', payload);
        fetchData(); // Simples: recarregar tudo
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [tenantId]);

  async function fetchData() {
    try {
      setLoading(true);
      
      const [usersRes, invitesRes, logsRes] = await Promise.all([
        apiService.get(`/api/tenant/${tenantId}/team/users`),
        apiService.get(`/api/tenant/${tenantId}/team/invites`),
        apiService.get(`/api/tenant/${tenantId}/team/audit`)
      ]);

      setUsers(usersRes.data || []);
      setInvites(invitesRes.data || []);
      setAuditLogs(logsRes.data || []);
    } catch (error) {
      setToast({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      // Optimistic update
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole, syncing: true } : u
      ));

      const response = await apiService.patch(
        `/api/tenant/${tenantId}/team/users/${userId}`,
        { role: newRole }
      );

      setUsers(users.map(u => 
        u.id === userId ? { ...u, ...response.data, syncing: false } : u
      ));

      setToast({ type: 'success', message: 'Role updated' });
    } catch (error) {
      // Reverter optimistic
      await fetchData();
      setToast({ type: 'error', message: error.message });
    }
  };

  const handleRemoveClick = (user) => {
    setSelectedUser(user);
    setConfirmDialog(true);
  };

  const handleRemoveConfirm = async () => {
    try {
      await apiService.delete(`/api/tenant/${tenantId}/team/users/${selectedUser.id}`);
      setUsers(users.filter(u => u.id !== selectedUser.id));
      setToast({ type: 'success', message: 'User removed' });
      setConfirmDialog(false);
    } catch (error) {
      setToast({ type: 'error', message: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Team Members</h1>
          <button
            onClick={() => setInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} /> Invite Member
          </button>
        </div>
      </motion.div>

      {/* Users Table */}
      <UserTable
        users={users}
        loading={loading}
        onRoleChange={handleRoleChange}
        onRemove={handleRemoveClick}
      />

      {/* Pending Invites */}
      {invites.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Mail size={20} /> Pending Invites
            </h2>
            <div className="space-y-2">
              {invites.map(invite => (
                <div key={invite.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-sm text-gray-600">
                      Role: {invite.invited_role} • Expires: {Math.ceil(invite.expiresIn / 60)}h
                    </p>
                  </div>
                  <button
                    onClick={() => apiService.delete(`/api/tenant/${tenantId}/team/invites/${invite.id}`)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Audit Log */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <details className="bg-white rounded-lg border border-gray-200">
          <summary className="p-6 cursor-pointer font-semibold">
            Audit Log ({auditLogs.length})
          </summary>
          <AuditLog logs={auditLogs} />
        </details>
      </motion.div>

      {/* Modals */}
      <InviteModal
        isOpen={inviteModal}
        tenantId={tenantId}
        onClose={() => setInviteModal(false)}
        onSuccess={() => {
          fetchData();
          setToast({ type: 'success', message: 'Invite sent!' });
        }}
      />

      <ConfirmDialog
        isOpen={confirmDialog}
        title="Remove team member?"
        message={`${selectedUser?.email} will lose access to all instances.`}
        danger
        onConfirm={handleRemoveConfirm}
        onCancel={() => setConfirmDialog(false)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
```

---

## IMPLEMENTAÇÃO ROADMAP

### Semana 1
- [ ] Phase 1.1: Alterar user_tenant_roles
- [ ] Phase 1.2: Criar user_tenant_invites
- [ ] Phase 1.3: Criar action_tokens
- [ ] Testes de migrations

### Semana 2
- [ ] Phase 2.1: UserManagementService (CRUD)
- [ ] Phase 2.2: InviteService (convites)
- [ ] Endpoints REST (rotas)
- [ ] Testes unitários

### Semana 3
- [ ] Phase 3.1: TeamMembersPage
- [ ] InviteModal
- [ ] UserTable
- [ ] Real-time sync

### Semana 4
- [ ] Testes E2E
- [ ] Security audit
- [ ] Performance testing
- [ ] Deploy & monitoring

---

**Status**: ✅ Ready to develop  
**Next**: Comece com Phase 1.1 (Migration)
