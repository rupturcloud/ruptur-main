# Guia de Debugging — Phase 2

**Usar quando**: Um ou mais testes falham  
**Objetivo**: Diagnóstico rápido e remediação

---

## Quick Diagnostic

Quando um teste falhar, seguir este fluxo de decisão:

```
┌─ Teste falhou?
│
├─ É erro de AUTENTICAÇÃO? (401, 403, Token inválido)
│  └─ → Ir para Seção 1: Auth Issues
│
├─ É erro de AUTO-PROVISIONING? (tenant não criado, RLS violation)
│  └─ → Ir para Seção 2: Auto-Provisioning Issues
│
├─ É erro de ADMIN ENDPOINTS? (settings, members, billing)
│  └─ → Ir para Seção 3: Admin Endpoints Issues
│
├─ É erro de PERFORMANCE? (timeout, slow response)
│  └─ → Ir para Seção 4: Performance Issues
│
├─ É erro de REGRESSÃO? (feature antiga quebrada)
│  └─ → Ir para Seção 5: Regression Issues
│
└─ Outro erro?
   └─ → Ir para Seção 6: Other Issues
```

---

## Seção 1: Authentication Issues

### Sintoma: 401 "Token não fornecido"

**Causa Possível**: Authorization header está malformado

```javascript
// ❌ ERRADO
fetch(url, {
  headers: { 'Authorization': 'eyJhbGciOi...' }  // Sem "Bearer"
});

// ✅ CORRETO
fetch(url, {
  headers: { 'Authorization': 'Bearer eyJhbGciOi...' }
});
```

**Remediação**:
```javascript
// Verificar token
const token = loginData.session.access_token;
console.log('Token format:', token.split('.').length === 3 ? '✅ JWT' : '❌ Invalid');

// Verificar header
const headers = {
  'Authorization': `Bearer ${token}`  // Use backticks
};
console.log('Header:', headers);
```

---

### Sintoma: 401 "Token inválido"

**Causa Possível**: Token expirou ou assinado com chave errada

```javascript
// Verificar expiração
const payload = JSON.parse(atob(token.split('.')[1]));
const expiresAt = new Date(payload.exp * 1000);
const isExpired = expiresAt < new Date();

console.log('Token expires at:', expiresAt);
console.log('Is expired?', isExpired);

if (isExpired) {
  console.log('❌ Token expirado — fazer login novamente');
  // Repetir login
}
```

**Remediação**:
1. Fazer login novamente
2. Usar novo token

---

### Sintoma: 403 "Acesso negado"

**Causa Possível 1**: Usuário não é dono do tenant (admin endpoints)

```javascript
// Verificar role do usuário
const { data: role } = await supabase
  .from('user_tenant_roles')
  .select('role')
  .eq('tenant_id', tenantId)
  .eq('user_id', user.id)
  .single();

console.log('User role:', role?.role);
// Se não for 'owner' → usuário não tem permissão

// Solução: Usar usuário owner para testes de admin
```

**Causa Possível 2**: Usuário não tem nenhum tenant vinculado

```javascript
// Verificar se usuário tem tenant
const { data: roles } = await supabase
  .from('user_tenant_roles')
  .select('*')
  .eq('user_id', user.id);

console.log('User tenants:', roles?.length);
if (!roles || roles.length === 0) {
  console.log('❌ Usuário não tem tenant — chamar warmup/config para auto-provisionar');
  // Chamar GET /api/warmup/config
}
```

---

## Seção 2: Auto-Provisioning Issues

### Sintoma: "violates row-level security policy"

**Causa**: Service role key não está configurado

```bash
# Verificar se variável está definida
echo $SUPABASE_SERVICE_ROLE_KEY

# Se vazio:
# ❌ PROBLEMA: .env não tem SUPABASE_SERVICE_ROLE_KEY

# ✅ SOLUÇÃO:
# 1. Ir ao Supabase Dashboard → Settings → API Keys
# 2. Copiar "Service Role Secret"
# 3. Adicionar ao .env: SUPABASE_SERVICE_ROLE_KEY=eyJ...
# 4. Restart servidor
```

**Verificação**:
```javascript
// Testar se service role client funciona
import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(
  'https://axrwlboyowoskdxeogba.supabase.co',
  'eyJ...' // SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await serviceClient
  .from('tenants')
  .select('*')
  .limit(1);

console.log('Service role works?', !error);
if (error) console.error('Error:', error.message);
```

---

### Sintoma: "Tenant não criado" ou "Usuário sem tenant"

**Causa 1**: getOrCreateUserTenant() não foi chamado

```javascript
// Verificar se warmup/config foi chamado
const warmupResponse = await fetch('https://app.ruptur.cloud/api/warmup/config', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const warmupData = await warmupResponse.json();

console.log('Warmup response:', warmupData);
// Deve ter { tenantId: 'uuid', role: 'owner', ... }
```

**Causa 2**: getOrCreateUserTenant() é chamada mas query falha

```javascript
// Checar logs do servidor
// SSH na VPS e fazer:
ssh deploy@vps.ruptur.cloud 'docker logs ruptur-saas 2>&1 | grep -A3 "getOrCreateUserTenant"'

// Procurar por:
// [Auth] No existing tenant found, creating new one...
// [Auth] Insert tenant result: { error: null, tenantId: '...' }
// [Auth] Erro ao vincular usuário ao tenant: ...
```

**Remediação**:
1. Limpar dados de teste antigos
2. Criar novo usuário (novo email)
3. Fazer login
4. Chamar GET /warmup/config novamente

```sql
-- No Supabase para limpar teste anterior
DELETE FROM user_tenant_roles WHERE user_id = 'uuid-to-delete';
DELETE FROM user_tenant_memberships WHERE user_id = 'uuid-to-delete';
DELETE FROM tenants WHERE id = 'tenant-to-delete';
DELETE FROM auth.users WHERE email = 'old-test@test.com';
```

---

### Sintoma: Tenant criado 2x (duplicata)

**Causa**: Warmup/config foi chamado 2x antes do primeiro completar

```javascript
// Verificar se há duplicata no banco
SELECT user_id, COUNT(*) as cnt 
FROM user_tenant_roles 
GROUP BY user_id 
HAVING COUNT(*) > 1;

// Se houver resultado → há duplicatas
```

**Remediação**:
```sql
-- Limpar duplicatas
DELETE FROM user_tenant_roles 
WHERE id NOT IN (
  SELECT MIN(id) FROM user_tenant_roles 
  GROUP BY user_id, tenant_id
);

-- Ou deletar todos e re-criar
DELETE FROM user_tenant_roles WHERE user_id = 'test-user-id';
-- Re-fazer login + warmup/config
```

---

## Seção 3: Admin Endpoints Issues

### Sintoma: 404 "Route not found"

**Causa**: Rota está malformada

```javascript
// ❌ ERRADO
fetch(`/api/admin/tenants/${tenantId}/setings`); // typo: "setings"

// ✅ CORRETO
fetch(`/api/admin/tenants/${tenantId}/settings`);

// Rotas válidas:
// GET /api/admin/tenants/{tenantId}/settings
// PATCH /api/admin/tenants/{tenantId}/settings
// GET /api/admin/tenants/{tenantId}/members
// PATCH /api/admin/tenants/{tenantId}/members/{userId}/role
// GET /api/admin/tenants/{tenantId}/billing
// GET /api/admin/tenants/{tenantId}/audit
```

---

### Sintoma: 400 "Nenhum campo válido para atualizar"

**Causa**: Campo sendo enviado não é permitido

```javascript
// ❌ ERRADO
fetch(..., {
  body: JSON.stringify({ 
    customField: 'value',  // Não é permitido
    description: 'text'    // Não é permitido
  })
});

// ✅ CORRETO (campos permitidos)
fetch(..., {
  body: JSON.stringify({ 
    name: 'New Name',                    // ✅
    email: 'new@email.com',              // ✅
    plan: 'enterprise',                  // ✅
    status: 'suspended',                 // ✅
    credits_balance: 5000,               // ✅
    trial_ends_at: '2026-06-08T...'      // ✅
  })
});
```

---

### Sintoma: "Não é possível remover último owner"

**Causa**: Tentando downgrade do único owner

```javascript
// Verificar quantos owners/admins existem
const { data: admins } = await supabase
  .from('user_tenant_roles')
  .select('role')
  .eq('tenant_id', tenantId)
  .in('role', ['owner', 'admin']);

console.log('Owners/admins count:', admins?.length);
// Se for 1 → não pode downgrade

// Solução: Promover outro usuário para admin ANTES de downgrade do atual
```

---

## Seção 4: Performance Issues

### Sintoma: Timeout (> 10s)

**Causa 1**: Servidor não respondendo

```bash
# Verificar se servidor está rodando
ssh deploy@vps.ruptur.cloud 'docker ps | grep ruptur'

# Se não aparecer nada:
# → Containers não estão rodando
# → Fazer docker compose up -d

# Se aparecer mas com status unhealthy:
docker logs ruptur-saas 2>&1 | tail -50
# Procurar por erros
```

**Causa 2**: Banco de dados não respondendo

```javascript
// Testar conexão
const { data, error } = await supabase
  .from('tenants')
  .select('COUNT(*)')
  .limit(1);

console.log('DB responds?', !error);
if (error) {
  console.error('DB Error:', error.message);
  // Verificar se Supabase está online
}
```

---

### Sintoma: Response Time Lento (> threshold)

**Causa 1**: N+1 query (fazer múltiplas queries em loop)

```javascript
// ❌ RUIM (N+1 problem)
const campaigns = await supabase.from('campaigns').select('*');
for (const campaign of campaigns) {
  const messages = await supabase.from('messages')
    .select('*')
    .eq('campaign_id', campaign.id);
  // Isso faz N+1 queries (1 para campaigns + N para cada message)
}

// ✅ BOM (usar join/relation)
const data = await supabase.from('campaigns')
  .select(`
    *,
    messages:messages_table (*)
  `);
// Uma única query com relação
```

**Causa 2**: Índice ausente

```sql
-- Verificar se índice existe
SELECT * FROM pg_indexes 
WHERE tablename = 'user_tenant_roles' 
AND indexname LIKE '%user_id%';

-- Se vazio → criar índice
CREATE INDEX idx_user_tenant_roles_user_id 
ON user_tenant_roles(user_id);

CREATE INDEX idx_user_tenant_roles_tenant_id 
ON user_tenant_roles(tenant_id);
```

**Causa 3**: RLS policy complexa

```javascript
// Desabilitar RLS temporariamente para teste
// (APENAS em dev/staging)

// No Supabase SQL Editor:
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_roles DISABLE ROW LEVEL SECURITY;

// Testar performance sem RLS
// Se ficar rápido → problema é na policy

// Depois re-habilitar:
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_roles ENABLE ROW LEVEL SECURITY;
```

---

## Seção 5: Regression Issues

### Sintoma: Teste R1.x falha (Message Library)

**Causa**: Endpoint antigo pode não estar migrado para tenant-aware

```bash
# Verificar se endpoint existe
curl -X GET https://app.ruptur.cloud/api/message-library \
  -H "Authorization: Bearer ${TOKEN}"

# Se retornar 404:
# → Endpoint não foi migrado de antes
# → Verificar se está em routes-*.mjs

# Se retornar erro de tenant:
# → Endpoint precisa de tenant context
# → Verificar que GET /warmup/config foi chamado antes
```

---

### Sintoma: Teste R2.x falha (Campaigns)

**Causa**: Campaigns data not isolada por tenant

```sql
-- Verificar se campaigns tem coluna tenant_id
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'campaigns' 
AND column_name = 'tenant_id';

-- Se vazio:
-- → Tabela não foi atualizada
-- → Adicionar coluna: ALTER TABLE campaigns ADD COLUMN tenant_id UUID;
-- → Adicionar RLS policy
-- → Migração pode ser necessária
```

---

### Sintoma: Teste R3.x falha (Inbox)

**Causa**: Inbox messages não estão isoladas

```sql
-- Verificar schema de inbox/messages
SELECT * FROM information_schema.columns 
WHERE table_name = 'inbox' OR table_name = 'messages'
LIMIT 10;

-- Deve ter tenant_id para isolamento
```

---

## Seção 6: Other Issues

### Erro: "supabaseUrl is required"

**Causa**: Module carrega antes de .env

```javascript
// ❌ ERRADO (sincronous import na root)
import { supabase } from './auth.js';  // Tenta criar client aqui

// ✅ CORRETO (lazy load)
let supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    );
  }
  return supabaseInstance;
}
```

---

### Erro: ".catch() is not a function"

**Causa**: Supabase retorna objeto, não Promise

```javascript
// ❌ ERRADO
const result = supabase.from('table').select();
result.catch(() => {}); // Não é Promise

// ✅ CORRETO
const { data, error } = await supabase.from('table').select();
if (error) { /* handle error */ }
```

---

### Erro: "Função não encontrada"

**Causa**: Função não foi exportada

```javascript
// Em arquivo que define função:
export function myFunction() { ... }  // Deve ter 'export'

// Em arquivo que usa:
import { myFunction } from './file.js';  // Deve importar

// Verificar export:
grep -n "export.*myFunction" src/**/*.js
```

---

## Debug Console Commands

Coletar rapidamente informações úteis:

```javascript
// Copiar/colar no console do navegador

// 1. Informações de autenticação
console.log('=== AUTH ===');
console.log('Current user:', localStorage.getItem('supabase.auth.token'));
console.log('Has JWT?', localStorage.getItem('supabase.auth.token')?.split('.').length === 3);

// 2. Informações de tenant
console.log('\n=== TENANT ===');
const warmupResponse = await fetch('/api/warmup/config', {
  headers: { 'Authorization': `Bearer ${token}` }
});
console.log('Warmup config:', await warmupResponse.json());

// 3. Informações de backend
console.log('\n=== BACKEND ===');
const healthResponse = await fetch('/api/local/health');
console.log('Health:', await healthResponse.json());

// 4. Informações de browser
console.log('\n=== BROWSER ===');
console.log('User agent:', navigator.userAgent);
console.log('Local storage size:', new Blob(Object.values(localStorage)).size, 'bytes');
console.log('Memory:', performance.memory);

// 5. Network timing
console.log('\n=== NETWORK ===');
console.log(performance.getEntriesByType('resource').map(r => ({
  name: r.name,
  duration: r.duration.toFixed(2) + 'ms',
  size: (r.transferSize / 1024).toFixed(2) + 'KB'
})));
```

---

## Escalação

Se depois de tentar remediações o problema persistir:

1. **Coletar informações**:
   ```bash
   # Salvar logs
   docker logs ruptur-saas > /tmp/logs.txt
   
   # Salvar estado do banco
   psql -h $DB_HOST -U $DB_USER $DB_NAME -c "\dt" > /tmp/schema.txt
   
   # Salvar testes que falharam
   # (usar TEST_RESULTS_TEMPLATE.md)
   ```

2. **Contactar Arquitetura**:
   - Email: arquitetura@ruptur.cloud
   - Slack: #engineering-support
   - Incluir:
     - Qual teste falhou
     - Screenshot/log do erro
     - Passo-a-passo para reproduzir
     - Já tentou: (remediações)

3. **Não fazer**:
   - ❌ Mudar código sem entender problema
   - ❌ Limpar banco sem backup
   - ❌ Desabilitar RLS permanentemente
   - ❌ Tentar deploy se problema persiste

---

## Checklist de Debugging

Sempre seguir esta ordem:

- [ ] 1. Reproduzir erro (passo-a-passo)
- [ ] 2. Identificar categoria (Auth? Auto-prov? Admin? Perf?)
- [ ] 3. Seguir seção correspondente deste guia
- [ ] 4. Tentar remediação sugerida
- [ ] 5. Testar novamente
- [ ] 6. Se ainda falhar → escalação

---

## Links Úteis

- [Supabase Docs](https://supabase.com/docs)
- [Supabase SQL Editor](https://app.supabase.com/project/axrwlboyowoskdxeogba/sql/new)
- [Docker Logs](docker logs -f ruptur-saas)
- [Backend Code](../../modules/auth/index.js)
- [Admin Routes](../../api/routes-admin-tenants.mjs)
