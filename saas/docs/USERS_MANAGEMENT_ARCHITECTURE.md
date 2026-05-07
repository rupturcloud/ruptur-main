# Arquitetura de Gestão de Usuários - Ruptur SaaS

**Data**: 2026-05-07  
**Scope**: Superadmin, Admin do Tenant, Members  
**Status**: Design & Recommendations

---

## 🚨 OS 15 ERROS QUE 90% COMETEM (E COMO EVITAR)

### ❌ 1. **Deletar usuários em vez de desativar (Soft Delete)**
**O erro**: `DELETE FROM users WHERE id = ...`
- Quebra referências (orphan data)
- Impossível auditar ("quem deletou esse usuário?")
- Dados contábeis inconsistentes

**A solução**:
```sql
ALTER TABLE user_tenant_roles ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE user_tenant_roles ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE user_tenant_roles ADD COLUMN deleted_by UUID REFERENCES auth.users(id);
```

---

### ❌ 2. **Não rastrear quem fez alterações de permissão**
**O erro**: Alterar role de admin → member sem log de auditoria
- Compliance quebrado
- Impossível responder: "Quando João perdeu acesso a billing?"

**A solução**: Trigger automático que loga toda mudança de role
```sql
CREATE TRIGGER audit_user_role_change
  AFTER UPDATE ON user_tenant_roles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_role_change();
```

---

### ❌ 3. **Sessões válidas após usuário ser removido**
**O erro**: João é removido, mas seu token JWT continua válido até expirar
- Usuário removido pode continuar usando API por horas

**A solução**:
```sql
ALTER TABLE user_tenant_roles ADD COLUMN token_invalidated_at TIMESTAMPTZ;

-- Na middleware de autenticação:
-- Se token.iat < user_tenant_role.token_invalidated_at → REJECT
```

---

### ❌ 4. **Não validar que sempre há pelo menos 1 owner/admin**
**O erro**: Removeu o último admin → ninguém pode gerenciar
- Tenant fica órfão
- Suporte precisa fazer intervenção manual

**A solução**:
```javascript
async function removeUserFromTenant(userId, tenantId) {
  const adminCount = await supabase
    .from('user_tenant_roles')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin']);

  if (adminCount.count === 1 && userRole.role === 'admin') {
    throw new Error('Cannot remove last admin');
  }
}
```

---

### ❌ 5. **Invites sem expiração ou sem resgate único**
**O erro**: Enviar convite e ele nunca expirar
- Risco de segurança (token pode ser descoberto)

**A solução**:
```sql
CREATE TABLE user_tenant_invites (
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'expired'))
);
```

---

### ❌ 6. **Não isolar dados entre tenants (RLS incompleta)**
**O erro**: Query sem WHERE tenant_id expõe dados de outros tenants
- Violação de isolamento multi-tenant

**A solução**: Enforce tenant_id em TODA query
```javascript
const getTenantUsers = async (tenantId) => {
  return supabase
    .from('user_tenant_roles')
    .select('*')
    .eq('tenant_id', tenantId)  // ← OBRIGATÓRIO
    .eq('status', 'active');
};
```

---

### ❌ 7. **Falta rate limiting em invites**
**O erro**: Um usuário pode spammar convites
- Ataque de negação de serviço

**A solução**:
```javascript
async function checkRateLimit(userId, tenantId) {
  const lastHour = await supabase
    .from('user_tenant_invites')
    .select('*', { count: 'exact' })
    .eq('invited_by', userId)
    .gte('created_at', oneHourAgo);

  if (lastHour.count >= 10) {
    throw new Error('Rate limit: Too many invites');
  }
}
```

---

### ❌ 8. **Não validar email antes de permitir acesso**
**O erro**: Alguém aceita convite antes de verificar email
- Phishing vector / account takeover

**A solução**:
```javascript
async function acceptInvite(token) {
  const invite = await getInvite(token);
  const user = await auth.getUser();

  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error('Email mismatch');
  }
}
```

---

### ❌ 9. **Permissões hardcoded em vez de modelo declarativo**
**O erro**: 
```javascript
if (user.role === 'admin') { /* pode deletar */ }
```
Quando quer "admin sem permissão de deletar", precisa refatorar todo código.

**A solução**: Capability-based model
```javascript
const ROLE_CAPABILITIES = {
  owner: ['manage_users', 'manage_billing', 'delete_team'],
  admin: ['manage_users', 'manage_team'],
  member: ['view_team']
};

async function hasCapability(userId, tenantId, capability) {
  const { role, permissions } = await getUserRole(userId, tenantId);
  const base = ROLE_CAPABILITIES[role];
  const { grant = [], deny = [] } = permissions || {};
  
  return (base.includes(capability) && !deny.includes(capability)) || grant.includes(capability);
}
```

---

### ❌ 10. **Não registrar invites rejeitados ou expirados**
**O erro**: Convite expira silenciosamente
- Usuário não sabe por que não consegue aceitar
- Nenhum log de "convite rejeitado"

**A solução**: Update status quando expirar
```javascript
if (new Date(invite.expires_at) < new Date()) {
  await supabase
    .from('user_tenant_invites')
    .update({ status: 'expired' })
    .eq('token', token);
    
  throw new Error('Invite expired');
}
```

---

### ❌ 11. **Não confirmação em ações críticas**
**O erro**: Um clique remove o último admin
- Fácil de acontecer por acidente

**A solução**: ConfirmDialog + action_tokens
```javascript
// Frontend: ConfirmDialog obrigatório
<ConfirmDialog
  danger
  onConfirm={() => removeUser(userId)}
/>

// Backend: action_tokens para dupla validação
const token = await generateActionToken('remove_user', userId);
await sendConfirmationEmail(userEmail, token);
```

---

### ❌ 12. **Roles genéricos que não refletem domínio**
**O erro**: Roles simples (admin, member) não correspondem à realidade
- Não consegue representar "gerente de campanhas"
- Tudo vira "admin" ou "member"

**A solução**: Roles específicos do domínio
```javascript
const TENANT_ROLES = {
  owner: 'Proprietário - acesso total',
  manager: 'Gerente - campanhas, usuários, instâncias',
  specialist: 'Especialista - cria e gerencia campanhas',
  viewer: 'Visualizador - apenas leitura'
};
```

---

### ❌ 13. **Não invalidar refresh tokens quando role muda**
**O erro**: Usuário tem refresh token com permissões antigas
- Faz refresh, pega novo access token com permissões antigas

**A solução**: role_version em token
```javascript
// Quando role muda, incrementar versão
await supabase.auth.admin.updateUserById(userId, {
  user_metadata: { role_version: crypto.randomUUID() }
});

// No refresh, validar versão
const claims = jwt.decode(token);
if (claims.role_version !== user.user_metadata.role_version) {
  await logout(); // Force relogin
}
```

---

### ❌ 14. **Desincronização entre auth.users e user_tenant_roles**
**O erro**: Um usuário é deletado de auth.users, mas continua em user_tenant_roles
- Data inconsistente
- Queries lentas

**A solução**: Trigger de sincronização
```sql
CREATE TRIGGER sync_user_deletion
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION mark_user_inactive();
```

---

### ❌ 15. **Sem testes de edge cases**
**O erro**: Código em produção não trata:
- Último admin removido
- User removido enquanto faz upload
- Role mudando em tempo real
- Múltiplos tokens do mesmo usuário

**A solução**: Test suite completa
```javascript
describe('User Management', () => {
  test('Should prevent removing last admin', async () => {
    await expect(removeLastAdmin()).rejects.toThrow('Cannot remove');
  });

  test('Should invalidate session when removed', async () => {
    const session = await login();
    await removeUser();
    expect(() => useSession()).toThrow();
  });
});
```

---

## 📊 TABELA RESUMIDA

| # | Erro | Impacto | Solução |
|---|------|--------|--------|
| 1 | DELETE em vez de soft-delete | Orphan data | Status + deleted_at |
| 2 | Sem audit de mudanças | Compliance falha | Trigger audit_log |
| 3 | Sessões válidas após remoção | Security breach | token_invalidated_at |
| 4 | Último admin removido | Tenant órfão | Validar count |
| 5 | Invites sem expiração | Security breach | expires_at checker |
| 6 | RLS incompleta | Data leakage | tenant_id obrigatório |
| 7 | Sem rate limit invites | Spam/DoS | perHour, perDay |
| 8 | Sem validação email | Account takeover | Email match |
| 9 | Permissões hardcoded | Não escalável | Capability-based |
| 10 | Sem log expiração | Debugging difícil | Update status |
| 11 | Sem confirmação crítica | Ações acidentais | ConfirmDialog |
| 12 | Roles genéricos | Model-reality gap | Roles específicos |
| 13 | Refresh tokens não invalidam | Permission bypass | role_version |
| 14 | Desincronização auth | Inconsistency | Trigger sync |
| 15 | Sem testes edge case | Production bugs | Test suite |

---

## 🏗️ ARQUITETURA DA TELA DE GESTÃO DE USUÁRIOS

### **Localização e Navegação**

```
Admin Dashboard
├─ Sidebar
│  └─ Team Members (NOVO!) ← Gestão de usuários do tenant
│
Superadmin Dashboard  
├─ Sidebar
│  └─ Platform Admins (NOVO!) ← Gestão de superadmins
│
Settings (Para members)
└─ Team Members (Read-only view)
```

---

### **Estrutura de Componentes**

```
TeamMembersPage (Admin view)
├─ Header
│  └─ InviteButton → Opens InviteModal
│
├─ FilterBar
│  ├─ SearchInput (por email, nome)
│  ├─ RoleFilter (all, owner, admin, member)
│  └─ StatusFilter (active, suspended, inactive)
│
├─ UsersTable
│  ├─ Columns: Email | Name | Role | Status | JoinedAt | Actions
│  ├─ Rows: 
│  │  └─ UserRow
│  │     ├─ Email (clickable → details modal)
│  │     ├─ Role (dropdown to change, with ConfirmDialog)
│  │     ├─ Status (badge)
│  │     ├─ JoinedAt (timestamp)
│  │     └─ Actions
│  │        ├─ PromoteButton (member → admin)
│  │        ├─ SuspendButton (toggle active/suspended)
│  │        └─ RemoveButton (→ ConfirmDialog)
│  └─ Pagination
│
├─ PendingInvites (collapsible section)
│  └─ InvitesList
│     └─ InviteRow
│        ├─ Email (pending)
│        ├─ InvitedBy (admin name)
│        ├─ InvitedAt (timestamp)
│        ├─ ExpiresAt (with countdown)
│        ├─ Status badge
│        └─ CancelButton
│
└─ AuditLog (collapsible section)
   └─ LogTable (filtered to user management)
      ├─ Action (invited, removed, role_changed)
      ├─ User (quem fez)
      ├─ Target (quem foi afetado)
      ├─ Details (old value → new value)
      └─ Timestamp
```

---

### **Padrões de Design**

#### **1. Permission Guard**
```jsx
<ProtectedAction permission="manage_users">
  <RemoveButton />
</ProtectedAction>
```

#### **2. Optimistic Updates**
```javascript
// Atualizar UI antes de confirmar no servidor
setUsers(users.map(u => 
  u.id === userId ? { ...u, role: newRole } : u
));

try {
  await updateUserRole(userId, newRole);
} catch (e) {
  // Reverter se falhar
  setUsers(previousUsers);
  toast.error('Failed');
}
```

#### **3. Real-time Sync**
```javascript
useEffect(() => {
  const sub = supabase
    .from('user_tenant_roles')
    .on('UPDATE', (payload) => {
      setUsers(users.map(u => 
        u.id === payload.new.user_id ? payload.new : u
      ));
    })
    .subscribe();
  
  return () => sub.unsubscribe();
}, []);
```

---

### **Fluxos Críticos**

#### **Fluxo 1: Convidar usuário**
```
1. Admin clica "Invite" → Modal abre
2. Admin insere email + seleciona role
3. Sistema valida rate limit (você pode convidar 5 mais hoje)
4. Admin clica "Send"
5. Backend:
   - Valida rate limit (duplo)
   - Valida se email já é membro
   - Gera token com expires_at = NOW() + 7 dias
   - Insere em user_tenant_invites com status=pending
   - Envia email
   - Loga em audit_logs: "invited john@example.com"
6. Frontend mostra: "Invite sent. Expires in 7 days"
```

#### **Fluxo 2: Remover usuário**
```
1. Admin clica "Remove" em um usuário
2. ConfirmDialog aparece: "Remove? This cannot be undone."
3. Admin confirma
4. Backend:
   - Valida que não é último admin
   - Soft-delete: UPDATE status='inactive', deleted_at=NOW()
   - Invalida tokens: token_invalidated_at=NOW()
   - Loga: "removed john@example.com"
5. Se John tenta usar API:
   - Middleware verifica status='inactive'
   - Retorna 401
```

#### **Fluxo 3: Mudar role**
```
1. Admin clica dropdown de role
2. Seleciona novo role
3. Se mudando para 'admin': ConfirmDialog dupla confirmação
4. Backend:
   - Valida permission
   - Se último admin removido: bloqueia
   - UPDATE user_tenant_roles SET role=...
   - Trigger loga automaticamente
   - Invalida refresh tokens (role_version muda)
5. Real-time: Outros admins veem mudança na tabela
```

---

### **Estados & Mensagens de Erro**

```javascript
export const USER_ERRORS = {
  LAST_ADMIN: 'Cannot remove last admin. Assign another admin first.',
  EMAIL_MISMATCH: 'You\'re logged in as {email1} but invite is for {email2}',
  INVITE_EXPIRED: 'Invite expired on {date}. Request new invite.',
  RATE_LIMIT: 'Sent {sent}/{limit} invites this hour. Try later.',
  NO_PERMISSION: 'You don\'t have permission to do this.',
  INVALID_EMAIL: 'Invalid email format.',
  ALREADY_MEMBER: '{email} is already a member of this team.',
  INVITE_PENDING: 'Invite already pending for {email}.'
};
```

---

### **Database Schema (Final)**

```sql
-- 1. Roles refatorada
CREATE TABLE user_tenant_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  
  role VARCHAR(20) CHECK (role IN ('owner', 'admin', 'manager', 'specialist', 'viewer')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  
  permissions JSONB DEFAULT '{}',  -- { grant: [], deny: [] }
  
  deleted_by UUID REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  token_invalidated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  
  UNIQUE(user_id, tenant_id)
);

-- 2. Invites com expiração
CREATE TABLE user_tenant_invites (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  email TEXT NOT NULL,
  invited_role VARCHAR(20),
  
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  
  invited_by UUID REFERENCES auth.users(id),
  accepted_by_user_id UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ,
  
  UNIQUE(tenant_id, email, status)
);

-- 3. Action tokens para dupla confirmação
CREATE TABLE action_tokens (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  
  action VARCHAR(50),  -- 'remove_user', 'change_role'
  action_data JSONB,
  
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  
  created_at TIMESTAMPTZ
);
```

---

## 🚀 IMPLEMENTAÇÃO RECOMENDADA

### **Phase 1: Migrations (1-2 dias)**
- [x] Estrutura de tabelas definida
- [ ] Adicionar colunas em user_tenant_roles
- [ ] Criar user_tenant_invites
- [ ] Criar action_tokens
- [ ] Triggers de auditoria

### **Phase 2: Backend (3-4 dias)**
- [ ] UserManagementService
- [ ] InviteService (com rate limit)
- [ ] Middleware de validação
- [ ] Testes unitários

### **Phase 3: Frontend (4-5 dias)**
- [ ] TeamMembersPage (Admin)
- [ ] PlatformAdminsPage (Superadmin)
- [ ] InviteModal
- [ ] ConfirmDialog
- [ ] Real-time sync

### **Phase 4: Security & Testing (2-3 dias)**
- [ ] RLS audit
- [ ] E2E tests
- [ ] Security review
- [ ] Load testing

---

**Data**: 2026-05-07  
**Status**: Design Aprovado ✅
