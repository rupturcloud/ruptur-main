# Testes Iniciais — Phase 2: Auto-Provisioning

**Total**: 23 casos de teste  
**Duração estimada**: 30 minutos  
**Pré-requisito**: Ambiente setup (verificar health check antes de começar)

---

## Antes de Começar

### ✅ Verificar Pré-requisitos

```bash
# 1. Verificar health check
curl https://app.ruptur.cloud/api/local/health

# Resposta esperada:
# {
#   "ok": true,
#   "service": "ruptur-saas-gateway",
#   "supabase": true,
#   "billingConfigured": true,
#   "ts": "2026-05-08T00:05:32.863Z"
# }

# 2. Verificar variáveis de ambiente (.env)
# VITE_SUPABASE_URL=https://axrwlboyowoskdxeogba.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (CRÍTICO)
# NODE_ENV=production

# 3. Limpar dados (opcional — usar apenas se necessário fazer reset)
# CUIDADO: Isso deleta dados de teste. Use apenas em dev/staging
# Pular para agentes; apenas executa em sandbox controlado.
```

---

## Seção 1: Autenticação & Signup (4 testes)

### Teste 1.1 - Signup de Novo Usuário
**Objetivo**: Verificar que novo usuário consegue fazer signup  
**Pré-requisito**: Email não existe ainda no Supabase

```javascript
// Executar no console do navegador em https://app.ruptur.cloud/auth
const email = `test-${Date.now()}@ruptur-test.com`;
const password = "TestPassword123!@#";

// 1. Abrir DevTools → Network tab
// 2. Executar signup (assumir form no frontend):
// Digitar email + password + confirmar
// OU fazer POST direto:
const response = await fetch('https://app.ruptur.cloud/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const data = await response.json();
console.log('Signup response:', data);

// ✅ PASSAR se:
// - Status 200 ou 201
// - Response contém { user: { id, email }, session: { access_token } }
// - Email verificável em Supabase Auth
```

**Validação em Console**:
```javascript
// Verificar se JWT é válido
console.log('JWT:', data.session.access_token);
console.log('Expira em:', new Date(data.session.expires_at * 1000));
```

---

### Teste 1.2 - Login com Email Válido
**Objetivo**: Verificar que usuário criado consegue fazer login

```javascript
// Usar email + password do Teste 1.1
const loginResponse = await fetch('https://app.ruptur.cloud/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const loginData = await loginResponse.json();
console.log('Login response:', loginData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { session: { access_token }, user: { id, email } }
// - Token não expirou
```

---

### Teste 1.3 - Login com Senha Incorreta (Erro Esperado)
**Objetivo**: Verificar que login rejeita senha errada

```javascript
const wrongResponse = await fetch('https://app.ruptur.cloud/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: 'WrongPassword123' })
});
const wrongData = await wrongResponse.json();
console.log('Wrong password response:', wrongData);

// ✅ PASSAR se:
// - Status 401
// - Response contém { error: 'Invalid credentials' } ou similar
// - Sem token retornado
```

---

### Teste 1.4 - Login com Email Inválido (Erro Esperado)
**Objetivo**: Verificar que login rejeita email não registrado

```javascript
const invalidResponse = await fetch('https://app.ruptur.cloud/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'nonexistent@test.com', password: 'anything' })
});
const invalidData = await invalidResponse.json();
console.log('Invalid email response:', invalidData);

// ✅ PASSAR se:
// - Status 401 ou 400
// - Sem token retornado
```

---

## Seção 2: Auto-Provisioning (5 testes)

### Teste 2.1 - Auto-Provisioning ao Acessar /api/warmup/config
**Objetivo**: Verificar que novo usuário autenticado dispara auto-provisioning de tenant

```javascript
// Assumir que temos JWT do Teste 1.2
const token = loginData.session.access_token;

// 1. Abrir DevTools → Network tab
// 2. Fazer GET para warmup/config
const warmupResponse = await fetch('https://app.ruptur.cloud/api/warmup/config', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const warmupData = await warmupResponse.json();
console.log('Warmup config:', warmupData);

// ✅ PASSAR se:
// - Status 200
// - Response contém: { tenantId, tenantSlug, tenantName, role, warmupUrl, instanceToken }
// - tenantId é um UUID válido
// - role = 'owner' (novo usuário deve ser owner)
```

**Validação em Supabase**:
```javascript
// No Supabase Dashboard:
// 1. Abrir tabela 'tenants'
// 2. Filtrar por 'id' = tenantId do response acima
// 3. Verificar:
//    - slug: 'tenant-[user_id_slice]'
//    - name: "[email]'s Workspace"
//    - plan: 'trial'
//    - status: 'active'
//    - credits_balance: 1000
//    - trial_ends_at: 30 dias no futuro

// 4. Abrir tabela 'user_tenant_roles'
// 5. Filtrar por user_id e tenant_id
// 6. Verificar: role = 'owner'
```

---

### Teste 2.2 - Auto-Provisioning Não Recria Tenant Existente
**Objetivo**: Verificar que usuário com tenant existente não cria duplicata

```javascript
// Executar warmup/config 2x com mesmo token
const firstCall = await fetch('https://app.ruptur.cloud/api/warmup/config', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const firstData = await firstCall.json();
const firstTenantId = firstData.tenantId;

// Esperar 2 segundos
await new Promise(r => setTimeout(r, 2000));

// Segunda chamada
const secondCall = await fetch('https://app.ruptur.cloud/api/warmup/config', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const secondData = await secondCall.json();
const secondTenantId = secondData.tenantId;

console.log('First tenantId:', firstTenantId);
console.log('Second tenantId:', secondTenantId);

// ✅ PASSAR se:
// - firstTenantId === secondTenantId
// - Supabase não contém 2 tenants com mesmo usuário
```

---

### Teste 2.3 - Validar RLS Policies — Anon Key Não Consegue Ler Tenant
**Objetivo**: Verificar que RLS bloqueia chave anônima (segurança)

```javascript
// Usar VITE_SUPABASE_PUBLISHABLE_KEY (anon key) em um novo cliente
// Abrir console em app.ruptur.cloud e executar:

import { createClient } from '@supabase/supabase-js';

const anonClient = createClient(
  'https://axrwlboyowoskdxeogba.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // VITE_SUPABASE_PUBLISHABLE_KEY
);

// Tentar ler tenant diretamente (deve falhar por RLS)
const { data, error } = await anonClient
  .from('tenants')
  .select('*')
  .eq('id', firstTenantId);

console.log('Anon query error:', error);

// ✅ PASSAR se:
// - error !== null
// - error.message contém 'violates row-level security'
// - data === null
```

---

### Teste 2.4 - Service Role Key Consegue Ler Tenant
**Objetivo**: Verificar que service role key bypassa RLS (backend use case)

```javascript
// Simular chamada backend com service role key
// (Executar em terminal, não em navegador)

curl -X GET 'https://axrwlboyowoskdxeogba.supabase.co/rest/v1/tenants?id=eq.'"${TENANT_ID}" \
  -H 'apikey: '"${SUPABASE_SERVICE_ROLE_KEY}" \
  -H 'Authorization: Bearer '"${SUPABASE_SERVICE_ROLE_KEY}" \
  -H 'Content-Type: application/json'

# ✅ PASSAR se:
# - Status 200
# - Response contém objeto tenant completo (plan, status, credits_balance, etc)
```

---

### Teste 2.5 - Usuário Sem Token Não Consegue Acessar /api/warmup/config
**Objetivo**: Verificar autenticação é obrigatória

```javascript
// Fazer GET sem Authorization header
const noTokenResponse = await fetch('https://app.ruptur.cloud/api/warmup/config', {
  method: 'GET'
  // Sem 'Authorization' header
});
const noTokenData = await noTokenResponse.json();
console.log('No token response:', noTokenData);

// ✅ PASSAR se:
// - Status 401
// - Response contém { error: 'Token não fornecido' } ou 'Token inválido'
```

---

## Seção 3: Admin Endpoints (10 testes)

### Teste 3.1 - GET /api/admin/tenants/{tenantId}/settings
**Objetivo**: Verificar que owner consegue ler configurações de tenant

```javascript
// Usar token do Teste 2.1 (owner do tenant)
const adminResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/settings`,
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const settingsData = await adminResponse.json();
console.log('Settings:', settingsData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { success: true, data: { id, slug, name, email, plan, status, creditsBalance, ... } }
// - plan = 'trial'
// - status = 'active'
```

---

### Teste 3.2 - PATCH /api/admin/tenants/{tenantId}/settings (Atualizar Nome)
**Objetivo**: Verificar que owner consegue atualizar nome do tenant

```javascript
const updateResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/settings`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'Updated Workspace Name' })
  }
);
const updateData = await updateResponse.json();
console.log('Update response:', updateData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { success: true, message: '...', data: { ..., name: 'Updated Workspace Name' } }

// 2. Verificar em Supabase Dashboard que name foi alterado
```

---

### Teste 3.3 - PATCH /api/admin/tenants/{tenantId}/settings (Atualizar Créditos)
**Objetivo**: Verificar que owner consegue atualizar créditos

```javascript
const creditResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/settings`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ credits_balance: 5000 })
  }
);
const creditData = await creditResponse.json();
console.log('Credit update:', creditData);

// ✅ PASSAR se:
// - Status 200
// - creditsBalance = 5000
// - Supabase reflete a mudança
```

---

### Teste 3.4 - GET /api/admin/tenants/{tenantId}/members
**Objetivo**: Verificar que owner consegue listar membros

```javascript
const membersResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/members`,
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const membersData = await membersResponse.json();
console.log('Members:', membersData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { success: true, total: X, members: [ { userId, role, createdAt, ... } ] }
// - total >= 1 (pelo menos o owner)
// - members[0].role = 'owner'
```

---

### Teste 3.5 - PATCH /api/admin/tenants/{tenantId}/members/{userId}/role (Member → Admin)
**Objetivo**: Verificar que owner consegue promover membro para admin

```javascript
// Primeiro, criar um segundo usuário e adicioná-lo como member
// (Pular se for complexo — verificar com agente de integrações)

// Assumir temos secondUserId de alguma forma
const promoteResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/members/${secondUserId}/role`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'admin' })
  }
);
const promoteData = await promoteResponse.json();
console.log('Promote response:', promoteData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { success: true, message: '...', data: { oldRole: 'member', newRole: 'admin' } }
// - Supabase reflete user_tenant_roles com role = 'admin'
```

---

### Teste 3.6 - GET /api/admin/tenants/{tenantId}/billing
**Objetivo**: Verificar que owner consegue ver informações de billing

```javascript
const billingResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/billing`,
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const billingData = await billingResponse.json();
console.log('Billing:', billingData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { success: true, data: { plan, creditsBalance, monthlyCredits, trialEndsAt, isExpired } }
// - plan = 'trial'
// - creditsBalance >= 0
// - isExpired = false (trial recém criado)
```

---

### Teste 3.7 - GET /api/admin/tenants/{tenantId}/audit
**Objetivo**: Verificar que owner consegue ver audit logs

```javascript
const auditResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/audit?limit=10`,
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const auditData = await auditResponse.json();
console.log('Audit logs:', auditData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { success: true, total: X, logs: [ { action, resourceType, resourceId, createdAt, ... } ] }
// - logs contém mudanças feitas nos testes anteriores (Teste 3.2, 3.3, etc)
```

---

### Teste 3.8 - Não-Owner Não Consegue Acessar Admin Endpoints
**Objetivo**: Verificar segurança — member não consegue acessar admin

```javascript
// Criar novo usuário (member) com token diferente
// Tentar acessar admin endpoint com seu token (não é owner)

const memberToken = newMemberLoginData.session.access_token;
const forbiddenResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/settings`,
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  }
);
const forbiddenData = await forbiddenResponse.json();
console.log('Forbidden response:', forbiddenData);

// ✅ PASSAR se:
// - Status 403
// - Response contém { error: 'Acesso negado' } ou similar
```

---

### Teste 3.9 - Admin Não Consegue Mudar Último Owner
**Objetivo**: Verificar regra de negócio — sempre deve haver 1 owner

```javascript
// Tentar downgrade do único owner para member (deve falhar)
const downgradeResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/members/${ownerId}/role`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'member' })
  }
);
const downgradeData = await downgradeResponse.json();
console.log('Downgrade response:', downgradeData);

// ✅ PASSAR se:
// - Status 403
// - Response contém { error: 'Não é possível remover último owner' } ou similar
```

---

### Teste 3.10 - Admin Endpoint Retorna 404 para Tenant Inexistente
**Objetivo**: Verificar tratamento de erro — tenant não encontrado

```javascript
const fakeUUID = '00000000-0000-0000-0000-000000000000';
const notFoundResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${fakeUUID}/settings`,
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const notFoundData = await notFoundResponse.json();
console.log('Not found response:', notFoundData);

// ✅ PASSAR se:
// - Status 404 ou 403 (não conseguiu acessar porque não é membro)
```

---

## Seção 4: RLS Policies & Segurança (3 testes)

### Teste 4.1 - RLS Bloqueia Acesso a Outro Tenant
**Objetivo**: Verificar isolamento de dados — usuário A não consegue acessar Tenant B

```javascript
// Criar 2 usuários em 2 tenants diferentes
// User A → Tenant 1
// User B → Tenant 2

// User A tenta acessar Tenant 2 (deve falhar)
const crossTenantResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${userBTenantId}/settings`,
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${userAToken}` }
  }
);
const crossTenantData = await crossTenantResponse.json();

// ✅ PASSAR se:
// - Status 403
// - Error message contém 'Acesso negado' ou 'não autorizado'
```

---

### Teste 4.2 - Audit Log Registra Quem Fez Cada Mudança
**Objetivo**: Verificar auditoria — cada ação tem user_id

```javascript
// Fazer uma ação (ex: PATCH settings)
// Verificar em audit_logs que user_id está correto

// No Supabase Dashboard → audit_logs:
// Filtrar por tenant_id = testTenantId
// Verificar últimas entradas:
// - action: 'tenant_updated' ou 'member_role_updated'
// - user_id: [seu user_id que fez a ação]
// - old_value e new_value têm o antes/depois

// ✅ PASSAR se:
// - Todos os audit logs têm user_id preenchido
// - old_value e new_value são JSON válidos
```

---

### Teste 4.3 - Service Role Key Não Está Exposto em Respostas
**Objetivo**: Verificar que chaves secretas nunca retornam para o cliente

```javascript
// Fazer qualquer request admin
// Verificar em DevTools → Network → Response
// Confirmar que nenhum campo contém 'SUPABASE_SERVICE_ROLE_KEY'

// ✅ PASSAR se:
// - Response JSON não contém chaves secretas
// - Headers não expõem Bearer token do backend
```

---

## Seção 5: Error Handling (1 teste)

### Teste 5.1 - Validação de Input em PATCH /settings
**Objetivo**: Verificar que tipos de dados inválidos são rejeitados

```javascript
// Tentar atualizar com valores inválidos
const invalidResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${firstTenantId}/settings`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ credits_balance: 'invalid string' }) // Deve ser number
  }
);
const invalidData = await invalidResponse.json();
console.log('Validation error:', invalidData);

// ✅ PASSAR se:
// - Status 400
// - Error message indica o problema (ex: "Invalid number")
```

---

## Resumo de Execução

| # | Teste | Status | Notas |
|---|-------|--------|-------|
| 1.1 | Signup | ⏳ | |
| 1.2 | Login válido | ⏳ | |
| 1.3 | Login senha errada | ⏳ | |
| 1.4 | Login email inválido | ⏳ | |
| 2.1 | Auto-provisioning | ⏳ | |
| 2.2 | Sem duplicata | ⏳ | |
| 2.3 | RLS bloqueia anon | ⏳ | |
| 2.4 | Service role bypassa RLS | ⏳ | |
| 2.5 | Sem token rejeitado | ⏳ | |
| 3.1 | GET /settings | ⏳ | |
| 3.2 | PATCH /settings (nome) | ⏳ | |
| 3.3 | PATCH /settings (créditos) | ⏳ | |
| 3.4 | GET /members | ⏳ | |
| 3.5 | PATCH /members/:id/role | ⏳ | |
| 3.6 | GET /billing | ⏳ | |
| 3.7 | GET /audit | ⏳ | |
| 3.8 | Não-owner bloqueado | ⏳ | |
| 3.9 | Último owner protegido | ⏳ | |
| 3.10 | 404 tenant inválido | ⏳ | |
| 4.1 | RLS cross-tenant | ⏳ | |
| 4.2 | Audit log completo | ⏳ | |
| 4.3 | Sem secrets expostos | ⏳ | |
| 5.1 | Validação input | ⏳ | |

---

## Como Documentar Resultados

Ver `TEST_RESULTS_TEMPLATE.md` para preencher após execução.
