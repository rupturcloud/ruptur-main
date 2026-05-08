# Testes de Performance — Phase 2

**Total**: 18 métricas  
**Duração estimada**: 15 minutos  
**Pré-requisito**: Testes iniciais + regressão devem ter passado

## Objetivo
Validar que a aplicação mantém performance aceitável após implementação de auto-provisioning.

**Critério de Sucesso**: 80%+ das métricas dentro dos thresholds

---

## Preparação

### Limpar Cache e Dados Temporários
```javascript
// No navegador:
localStorage.clear();
sessionStorage.clear();
// DevTools → Application → Cache → Clear Site Data

// Abrir DevTools → Network
// Setar throttling: No throttling (para baseline)
// Desabilitar "Disable cache"
```

---

## Seção 1: Page Load Times (5 métricas)

### Métrica P1.1 - Página de Login (FCP - First Contentful Paint)
**Threshold**: < 1.5s  
**Objetivo**: Validar que página de login carrega rápido

```javascript
// 1. Abrir https://app.ruptur.cloud/login em aba nova (cache limpo)
// 2. DevTools → Lighthouse
// 3. Run audit → Mobile

// Ou rodar via API:
const result = await fetch('https://app.ruptur.cloud/login');
const startTime = performance.now();
const content = await result.text();
const endTime = performance.now();
const loadTime = endTime - startTime;

console.log('Login page load time:', loadTime, 'ms');
console.log('PASS:', loadTime < 1500);

// ✅ PASSAR se: loadTime < 1500ms
```

---

### Métrica P1.2 - Página Principal Após Login (FCP)
**Threshold**: < 2s  
**Objetivo**: Validar que app dashboard carrega rápido

```javascript
// 1. Fazer login
// 2. Medir tempo até dashboard renderizar completamente

const dashboardStartTime = performance.now();

// Esperar dashboard carregar (usar performance observer)
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes('dashboard')) {
      const dashboardEndTime = performance.now();
      const dashboardTime = dashboardEndTime - dashboardStartTime;
      console.log('Dashboard load time:', dashboardTime, 'ms');
      console.log('PASS:', dashboardTime < 2000);
    }
  }
});

observer.observe({ entryTypes: ['navigation', 'resource'] });

// ✅ PASSAR se: dashboard load time < 2000ms
```

---

### Métrica P1.3 - Warmup Config Endpoint (Response Time)
**Threshold**: < 500ms  
**Objetivo**: Validar latência de auto-provisioning endpoint

```javascript
const warmupStartTime = performance.now();

const warmupResponse = await fetch(
  'https://app.ruptur.cloud/api/warmup/config',
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const warmupEndTime = performance.now();
const warmupTime = warmupEndTime - warmupStartTime;

console.log('Warmup config response time:', warmupTime, 'ms');
console.log('PASS:', warmupTime < 500);

// ✅ PASSAR se: warmupTime < 500ms
```

---

### Métrica P1.4 - Admin Endpoints Average Response Time
**Threshold**: < 500ms average  
**Objetivo**: Validar que admin APIs respondem rápido

```javascript
const endpoints = [
  `/api/admin/tenants/${tenantId}/settings`,
  `/api/admin/tenants/${tenantId}/members`,
  `/api/admin/tenants/${tenantId}/billing`,
  `/api/admin/tenants/${tenantId}/audit`
];

const times = [];

for (const endpoint of endpoints) {
  const start = performance.now();
  const response = await fetch(`https://app.ruptur.cloud${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const end = performance.now();
  const time = end - start;
  times.push(time);
  console.log(`${endpoint}: ${time.toFixed(2)}ms`);
}

const average = times.reduce((a, b) => a + b) / times.length;
console.log('Average response time:', average.toFixed(2), 'ms');
console.log('PASS:', average < 500);

// ✅ PASSAR se: average < 500ms
```

---

### Métrica P1.5 - Message Library Operations
**Threshold**: < 400ms per operation  
**Objetivo**: Validar latência de CRUD de mensagens

```javascript
// Medir tempo de: GET list, POST create, PATCH update, DELETE

const times = {};

// GET
let start = performance.now();
await fetch('https://app.ruptur.cloud/api/message-library', {
  headers: { 'Authorization': `Bearer ${token}` }
});
times.get = performance.now() - start;

// POST
start = performance.now();
await fetch('https://app.ruptur.cloud/api/message-library', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Test', content: 'Test' })
});
times.post = performance.now() - start;

// PATCH
start = performance.now();
await fetch(`https://app.ruptur.cloud/api/message-library/${msgId}`, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Updated' })
});
times.patch = performance.now() - start;

// DELETE
start = performance.now();
await fetch(`https://app.ruptur.cloud/api/message-library/${msgId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});
times.delete = performance.now() - start;

console.log('Message Library times:', times);
console.log('All < 400ms?', Object.values(times).every(t => t < 400));

// ✅ PASSAR se: todos os tempos < 400ms
```

---

## Seção 2: API Response Times (5 métricas)

### Métrica P2.1 - GET /api/warmup/config com Novo Usuário
**Threshold**: < 800ms (inclui criação de tenant)  
**Objetivo**: Validar latência de auto-provisioning incluindo INSERT no DB

```javascript
// Criar novo usuário
// Login
// Fazer GET /api/warmup/config (primeira vez — dispara auto-provisioning)

const newUserEmail = `perf-test-${Date.now()}@test.com`;
const newUserPassword = 'TempPass123!@#';

// Signup
const signupResponse = await fetch('https://app.ruptur.cloud/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: newUserEmail, password: newUserPassword })
});
const signupData = await signupResponse.json();
const newToken = signupData.session.access_token;

// Auto-provisioning call
const startTime = performance.now();
const warmupResponse = await fetch('https://app.ruptur.cloud/api/warmup/config', {
  headers: { 'Authorization': `Bearer ${newToken}` }
});
const endTime = performance.now();
const totalTime = endTime - startTime;

console.log('Auto-provisioning total time:', totalTime, 'ms');
console.log('PASS:', totalTime < 800);

// ✅ PASSAR se: totalTime < 800ms
```

---

### Métrica P2.2 - GET /api/campaigns (List)
**Threshold**: < 400ms  
**Objetivo**: Validar query de campaigns isolada por tenant

```javascript
const start = performance.now();
const response = await fetch('https://app.ruptur.cloud/api/campaigns', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const end = performance.now();
const time = end - start;

console.log('Campaigns list time:', time, 'ms');
console.log('PASS:', time < 400);

// ✅ PASSAR se: time < 400ms
```

---

### Métrica P2.3 - PATCH /api/admin/tenants/{id}/members/{uid}/role
**Threshold**: < 600ms  
**Objetivo**: Validar latência de operação de update + audit logging

```javascript
const start = performance.now();
const response = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${tenantId}/members/${userId}/role`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'admin' })
  }
);
const end = performance.now();
const time = end - start;

console.log('Member role update time:', time, 'ms');
console.log('PASS:', time < 600);

// ✅ PASSAR se: time < 600ms
```

---

### Métrica P2.4 - GET /api/inbox (List)
**Threshold**: < 400ms  
**Objetivo**: Validar query de inbox por tenant

```javascript
const start = performance.now();
await fetch('https://app.ruptur.cloud/api/inbox', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const time = performance.now() - start;

console.log('Inbox list time:', time, 'ms');
console.log('PASS:', time < 400);

// ✅ PASSAR se: time < 400ms
```

---

### Métrica P2.5 - GET /api/admin/tenants/{id}/audit (with limit=100)
**Threshold**: < 600ms  
**Objetivo**: Validar query de audit logs com muitos registros

```javascript
const start = performance.now();
await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${tenantId}/audit?limit=100`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const time = performance.now() - start;

console.log('Audit logs query time:', time, 'ms');
console.log('PASS:', time < 600);

// ✅ PASSAR se: time < 600ms
```

---

## Seção 3: Throughput (2 métricas)

### Métrica P3.1 - Concurrent Requests: 10 GET /warmup/config
**Threshold**: Todos completam em < 2s  
**Objetivo**: Validar que auto-provisioning scale com múltiplos usuários simultâneos

```javascript
// Criar 10 novos usuários
// Fazer 10 GET /warmup/config em paralelo

const userCount = 10;
const users = [];

// 1. Criar usuários
for (let i = 0; i < userCount; i++) {
  const email = `concurrent-${i}-${Date.now()}@test.com`;
  const signupResponse = await fetch('https://app.ruptur.cloud/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TempPass123!@#' })
  });
  const data = await signupResponse.json();
  users.push(data.session.access_token);
}

// 2. Fazer 10 GET /warmup/config em paralelo
const startTime = performance.now();
const promises = users.map(token =>
  fetch('https://app.ruptur.cloud/api/warmup/config', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
);
await Promise.all(promises);
const endTime = performance.now();
const totalTime = endTime - startTime;

console.log('10 concurrent warmup/config:', totalTime, 'ms');
console.log('PASS:', totalTime < 2000);

// ✅ PASSAR se: totalTime < 2000ms (200ms average)
```

---

### Métrica P3.2 - Concurrent Requests: 20 GET /api/campaigns
**Threshold**: Todos completam em < 1.5s  
**Objetivo**: Validar que queries escalem com múltiplas requisições

```javascript
const tokenList = []; // usar tokens de testes anteriores, repetir se necessário

const startTime = performance.now();
const promises = [];
for (let i = 0; i < 20; i++) {
  const token = tokenList[i % tokenList.length];
  promises.push(
    fetch('https://app.ruptur.cloud/api/campaigns', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
  );
}
await Promise.all(promises);
const totalTime = performance.now() - startTime;

console.log('20 concurrent campaigns requests:', totalTime, 'ms');
console.log('PASS:', totalTime < 1500);

// ✅ PASSAR se: totalTime < 1500ms (75ms average)
```

---

## Seção 4: Memory Usage (3 métricas)

### Métrica P4.1 - Memory Usage Após Login
**Threshold**: < 100MB  
**Objetivo**: Validar que aplicação não tem memory leak na autenticação

```javascript
// 1. Abrir DevTools → Memory
// 2. Take heap snapshot ANTES de fazer nada
// 3. Fazer login
// 4. Take heap snapshot DEPOIS de login
// 5. Compare size difference

// Ou via console:
console.memory; // Mostra { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit }

const before = performance.memory?.usedJSHeapSize || 0;

// Fazer login...
const response = await fetch('https://app.ruptur.cloud/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const after = performance.memory?.usedJSHeapSize || 0;
const used = (after - before) / 1024 / 1024; // em MB

console.log('Memory used after login:', used.toFixed(2), 'MB');
console.log('PASS:', used < 100);

// ✅ PASSAR se: memory increase < 100MB
```

---

### Métrica P4.2 - Memory Usage Após 50 GET /api/campaigns
**Threshold**: < 150MB total  
**Objective**: Validar que queries repetidas não vazam memória

```javascript
const before = performance.memory?.usedJSHeapSize || 0;

// Fazer 50 requisições
for (let i = 0; i < 50; i++) {
  await fetch('https://app.ruptur.cloud/api/campaigns', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

const after = performance.memory?.usedJSHeapSize || 0;
const totalMemory = (after - before) / 1024 / 1024;

console.log('Memory used after 50 requests:', totalMemory.toFixed(2), 'MB');
console.log('PASS:', totalMemory < 150);

// ✅ PASSAR se: memory < 150MB
```

---

### Métrica P4.3 - Memory Usage Estável (Garbage Collection)
**Threshold**: Memory volta ao baseline após GC  
**Objetivo**: Validar que não há memory leak

```javascript
const before = performance.memory?.usedJSHeapSize || 0;

// Fazer muitas operações
for (let i = 0; i < 100; i++) {
  const data = new Array(10000).fill('test');
  // usar data...
}

// Forçar garbage collection (se possível)
if (window.gc) {
  window.gc();
}

await new Promise(r => setTimeout(r, 500)); // esperar GC

const after = performance.memory?.usedJSHeapSize || 0;
const memoryDiff = (after - before) / 1024 / 1024;

console.log('Memory after GC:', memoryDiff.toFixed(2), 'MB');
console.log('PASS:', memoryDiff < 50); // deve ser bem menor

// ✅ PASSAR se: memory volta quase ao baseline após GC
```

---

## Seção 5: Database Query Performance (3 métricas)

### Métrica P5.1 - User Tenant Roles Query (Índice Válido)
**Threshold**: < 100ms  
**Objetivo**: Validar que lookup de tenant por usuário é rápido

```javascript
// Via DevTools Network, ao fazer GET /warmup/config:
// - Observe quanto tempo leva a query em user_tenant_roles
// - Deve ser < 100ms (indicativo de índice válido)

// No Supabase Dashboard:
// 1. Ir para SQL Editor
// 2. Rodar query com EXPLAIN:
// EXPLAIN ANALYZE
// SELECT * FROM user_tenant_roles 
// WHERE user_id = '...' AND tenant_id = '...';

// Verificar que usa índice (seq scan = ruim, index scan = bom)
```

---

### Métrica P5.2 - Tenants Query com RLS (< 150ms)
**Threshold**: < 150ms  
**Objetivo**: Validar que RLS policies não degradam performance

```javascript
// Via Supabase Logs:
// 1. Ir para Logs → API
// 2. Filtrar por GET /tenants
// 3. Verificar response_time_ms para cada query
// 4. Média deve ser < 150ms

// Ou rodar localmente no SQL Editor:
// EXPLAIN ANALYZE
// SELECT * FROM tenants 
// WHERE id = '...' AND status = 'active';

// Verificar PLAN mostra index usage
```

---

### Métrica P5.3 - Audit Logs Query (100 registros, < 200ms)
**Threshold**: < 200ms para 100 registros  
**Objetivo**: Validar que audit query escala

```javascript
// Via Supabase Logs:
// 1. Ir para Logs → API
// 2. Filtrar por GET /audit_logs
// 3. Verificar que queries com LIMIT 100 < 200ms

// No SQL Editor:
// EXPLAIN ANALYZE
// SELECT * FROM audit_logs 
// WHERE tenant_id = '...' 
// ORDER BY created_at DESC 
// LIMIT 100;
```

---

## Resumo de Execução

| # | Métrica | Threshold | Status |
|---|---------|-----------|--------|
| P1.1 | Login FCP | < 1.5s | ⏳ |
| P1.2 | Dashboard FCP | < 2s | ⏳ |
| P1.3 | Warmup endpoint | < 500ms | ⏳ |
| P1.4 | Admin endpoints avg | < 500ms | ⏳ |
| P1.5 | Message operations | < 400ms | ⏳ |
| P2.1 | Auto-provisioning | < 800ms | ⏳ |
| P2.2 | Campaigns list | < 400ms | ⏳ |
| P2.3 | Member role update | < 600ms | ⏳ |
| P2.4 | Inbox list | < 400ms | ⏳ |
| P2.5 | Audit logs query | < 600ms | ⏳ |
| P3.1 | 10 concurrent warmup | < 2s | ⏳ |
| P3.2 | 20 concurrent campaigns | < 1.5s | ⏳ |
| P4.1 | Login memory | < 100MB | ⏳ |
| P4.2 | 50 requests memory | < 150MB | ⏳ |
| P4.3 | GC memory stable | < 50MB | ⏳ |
| P5.1 | user_tenant_roles query | < 100ms | ⏳ |
| P5.2 | Tenants with RLS | < 150ms | ⏳ |
| P5.3 | Audit logs (100) | < 200ms | ⏳ |

---

## Critério de Sucesso

✅ 80%+ das 18 métricas estão dentro dos thresholds  
✅ Nenhuma métrica crítica (P1.*, P2.1) falha  
✅ Memory usage estável (sem leaks)  
✅ Queries usam índices (no seq scans)  

---

## Se Performance Degradar

1. Verificar se há N+1 queries (Supabase → Logs)
2. Confirmar índices existem: `EXPLAIN ANALYZE` no SQL editor
3. Verificar se RLS policies estão bem otimizadas
4. Checar se service role client está sendo reutilizado (não criar novo a cada request)
5. Analisar dados: se muitos registros, pode precisar de pagination
