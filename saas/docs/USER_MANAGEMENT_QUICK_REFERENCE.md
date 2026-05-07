# User Management - Quick Reference Card

Print isso ou tenha aberto enquanto desenvolve.

---

## 🎯 OS 15 ERROS (1 linha cada)

| # | Erro | Solução |
|---|------|--------|
| 1 | DELETE em vez de soft-delete | Adicionar `status`, `deleted_at`, `deleted_by` |
| 2 | Sem audit de mudanças de role | Trigger automático em `user_tenant_roles` UPDATE |
| 3 | Sessões válidas após remoção | Validar `token_invalidated_at` na middleware |
| 4 | Último admin removido | `SELECT count(*) WHERE role IN ('admin','owner')` antes |
| 5 | Invites sem expiração | `expires_at TIMESTAMPTZ + trigger de cleanup` |
| 6 | RLS incompleta | `eq('tenant_id', tenantId)` é OBRIGATÓRIO em toda query |
| 7 | Sem rate limit invites | Contar convites `created_at >= NOW() - INTERVAL '1 hour'` |
| 8 | Sem validação email | Comparar `inviteEmail === userEmail` (case-insensitive) |
| 9 | Permissões hardcoded | Usar `ROLE_CAPABILITIES` dict + `permissions.grant/deny` |
| 10 | Sem log expiração | `UPDATE status='expired' WHERE expires_at < NOW()` |
| 11 | Sem confirmação crítica | `ConfirmDialog` + `action_tokens` com 24h expiry |
| 12 | Roles genéricos | Definir roles por domínio: `owner, manager, specialist, viewer` |
| 13 | Refresh tokens não invalidam | Incrementar `role_version` em user_metadata quando role muda |
| 14 | Desincronização auth/roles | Trigger: `UPDATE user_tenant_roles SET status='inactive'` quando user deletado |
| 15 | Sem testes edge case | Testar: último admin, invite expirado, email mismatch, múltiplos tokens |

---

## 📊 SCHEMA RÁPIDO

```sql
-- user_tenant_roles (ADICIONAR)
status VARCHAR(20) DEFAULT 'active';
deleted_at TIMESTAMPTZ;
deleted_by UUID;
token_invalidated_at TIMESTAMPTZ;

-- user_tenant_invites (CRIAR)
CREATE TABLE user_tenant_invites (
  id, tenant_id, email, invited_role,
  token, expires_at (NOW() + 7 days),
  status ('pending', 'accepted', 'expired'),
  invited_by, accepted_by_user_id, accepted_at
);

-- action_tokens (CRIAR)
CREATE TABLE action_tokens (
  id, tenant_id, user_id, target_user_id, action,
  token, expires_at (NOW() + 24 hours), status
);
```

---

## 🔧 SNIPPETS PRONTOS

### Validar Último Admin
```javascript
const { count } = await db
  .from('user_tenant_roles')
  .select('*', { count: 'exact' })
  .eq('tenant_id', tenantId)
  .eq('status', 'active')
  .in('role', ['owner', 'admin']);

if (count === 1) throw new Error('Cannot remove last admin');
```

### Soft-Delete
```javascript
await db
  .from('user_tenant_roles')
  .update({
    status: 'inactive',
    deleted_at: new Date(),
    deleted_by: currentUserId,
    token_invalidated_at: new Date()
  })
  .eq('id', userRoleId);
```

### Rate Limit Check
```javascript
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
const { count } = await db
  .from('user_tenant_invites')
  .select('*', { count: 'exact' })
  .eq('invited_by', userId)
  .gte('created_at', oneHourAgo);

if (count >= 10) throw new Error('Rate limit: 10 invites/hour');
```

### Email Validation
```javascript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!EMAIL_REGEX.test(email)) throw new Error('Invalid email');

// E duplo-check no invite
if (userEmail.toLowerCase() !== inviteEmail.toLowerCase()) {
  throw new Error('Email mismatch');
}
```

### Capability-Based Permission
```javascript
const ROLE_CAPABILITIES = {
  owner: ['manage_users', 'manage_billing', 'delete_team'],
  admin: ['manage_users', 'manage_team'],
  member: ['view_team']
};

async function hasCapability(userId, tenantId, capability) {
  const { role, permissions } = await getUserRole(userId, tenantId);
  const base = ROLE_CAPABILITIES[role] || [];
  const { grant = [], deny = [] } = permissions || {};
  
  return (base.includes(capability) && !deny.includes(capability)) || 
         grant.includes(capability);
}
```

---

## 🎨 COMPONENTES REACT (ESTRUTURA)

```jsx
// TeamMembersPage.jsx
├─ Header (com "Invite" button)
├─ UserTable
│  ├─ Search/Filter bar
│  ├─ Rows (email, role dropdown, status, actions)
│  └─ Pagination
├─ PendingInvites (collapsible)
│  └─ Invite rows (email, expires_in, cancel)
├─ AuditLog (collapsible)
│  └─ Log table (action, user, target, timestamp)
├─ InviteModal (controlled form)
│  ├─ EmailInput (validation)
│  ├─ RoleSelect
│  └─ Submit button (com rate limit feedback)
└─ ConfirmDialog (para ações destrutivas)
```

---

## 📱 FLUXOS EM 3 PASSOS

### Convidar
1. Admin → Modal (email + role)
2. Backend → Rate limit, gera token, envia email
3. Usuário → Clica link, valida email, aceita

### Remover
1. Admin → Clica remove → ConfirmDialog
2. Backend → Valida último admin, soft-delete, invalida tokens
3. Se tenta usar API → Middleware rejeita (401)

### Mudar Role
1. Admin → Dropdown role
2. Optimistic update → UI muda imediatamente
3. API → Se falha, reverter

---

## ⚠️ VALIDAÇÕES OBRIGATÓRIAS

### Frontend
- [ ] Email válido (regex)
- [ ] Role selecionado
- [ ] ConfirmDialog em ações críticas
- [ ] Feedback visual (loading, error, success)

### Backend
- [ ] Email válido (duplo)
- [ ] Email match no invite (userEmail === inviteEmail)
- [ ] Rate limit (perHour, perDay)
- [ ] Último admin validation
- [ ] Token não expirou
- [ ] User tem permission para ação
- [ ] RLS policy aplica

---

## 🧪 TESTES CRÍTICOS

```javascript
describe('User Management', () => {
  test('Previne remover último admin', ...)
  test('Invalida sessão quando removido', ...)
  test('Rejeita email mismatch no invite', ...)
  test('Rate limit funciona', ...)
  test('Invite expira após 7 dias', ...)
  test('Soft-delete, não hard-delete', ...)
  test('Audit log criado automaticamente', ...)
  test('Permissão customizada funciona', ...)
  test('RLS isola dados entre tenants', ...)
  test('Role version muda ao atualizar role', ...)
});
```

---

## 🚨 CHECKLIST PRÉ-DEPLOY

### Database
- [ ] Migrations executadas
- [ ] Triggers criadas e testadas
- [ ] RLS policies habilitadas
- [ ] Índices criados
- [ ] Rollback plan documentado

### Backend
- [ ] Soft delete implementado
- [ ] Rate limit funcionando
- [ ] Email validation dupla
- [ ] Audit logs sendo criados
- [ ] Testes passando (90%+ coverage)

### Frontend
- [ ] UI responsiva
- [ ] Real-time sync funciona
- [ ] ConfirmDialog em ações críticas
- [ ] Mensagens de erro claras
- [ ] Acessibilidade validada

### Security
- [ ] RLS auditada
- [ ] Input validation
- [ ] CORS configurado
- [ ] Rate limits testados
- [ ] Soft deletes só (sem hard deletes)

---

## 📈 MÉTRICAS ESPERADAS

| Métrica | Esperado |
|---------|----------|
| Load time (TeamMembers) | < 2s |
| Real-time update delay | < 500ms |
| Max usuários por página | 25 |
| Max invites/hora | 10 |
| Invite expiry | 7 days |
| Action token expiry | 24 hours |
| Audit logs retention | Infinito |
| Last admin validation | 100% |

---

## 🔗 LINKS DOS DOCS

- **USERS_MANAGEMENT_ARCHITECTURE.md** → Os 15 erros detalhados
- **USER_MANAGEMENT_PATTERNS.md** → Design patterns + clean code
- **USER_MANAGEMENT_IMPLEMENTATION.md** → Migrations + código pronto
- **USER_MANAGEMENT_EXECUTIVE_SUMMARY.md** → Timeline + próximos passos

---

## 💡 DICA FINAL

**Comece simples:**
1. Implement soft-delete + audit
2. Depois adiciona rate limit
3. Depois roles customizados
4. Depois capability-based permissions

**Não tente fazer tudo de uma vez.**

---

**Última atualização**: 2026-05-07  
**Mantenha este documento aberto enquanto desenvolve** 👨‍💻
