# Phase 2 Testing Suite — End-to-End

**Última Atualização**: 2026-05-08  
**Status**: ✅ Pronto para Agentes Lerem e Executarem  
**Tempo Total**: ~80 minutos

---

## O que é Isso?

Pacote completo de testes, validações e checklists para **desenvolvimento end-to-end** de **Phase 2: Auto-Provisioning** no Ruptur SaaS.

Agentes (como Claude for Chrome) podem:
1. Ler cada arquivo em sequência
2. Executar os testes manualmente ou automatizados
3. Documentar resultados
4. Proceder para deploy com confiança

---

## Arquivos & Propósito

| Arquivo | Propósito | Quando Usar |
|---------|-----------|-----------|
| **00-TESTING_STRATEGY.md** | Visão geral da estratégia 3 camadas | PRIMEIRO — entender contexto |
| **01-INITIAL_TESTS.md** | 23 testes de happy path + auto-provisioning | SEGUNDO — validar Phase 2 |
| **02-REGRESSION_TESTS.md** | 19 testes de features antigas | TERCEIRO — garantir sem quebras |
| **03-PERFORMANCE_TESTS.md** | 18 métricas de latência/throughput/memory | QUARTO — validar eficiência |
| **04-TEST_EXECUTION_GUIDE.md** | Instruções detalhadas de como rodar testes | TODO — guia passo-a-passo |
| **05-DEPLOYMENT_CHECKLIST.md** | Checklist pré-deploy + rollback plan | QUINTA — antes de ir pra prod |
| **06-DEBUGGING_GUIDE.md** | Como debugar quando testes falham | QUANDO NECESSÁRIO — troubleshooting |
| **07-TEST_RESULTS_TEMPLATE.md** | Template para documentar resultados | APÓS TESTES — documentação |
| **README.md** (este arquivo) | Índice e guia de navegação | AGORA — você está aqui |

---

## Fluxo Recomendado para Agentes

### Fase 0: Entendimento (5 min)
```
1. Ler: 00-TESTING_STRATEGY.md
2. Entender: 3 camadas de testes (initial → regression → performance)
3. Entender: Critérios de sucesso
```

### Fase 1: Setup & Initial Tests (40 min)
```
1. Ler: 04-TEST_EXECUTION_GUIDE.md → Fase 0 & 1
2. Ler: 01-INITIAL_TESTS.md
3. Executar: 23 testes de fase 1
4. Documentar: Em TEST_RESULTS_TEMPLATE.md
5. Validar: 23/23 PASSARAM?
   - SIM → Prosseguir
   - NÃO → Ler 06-DEBUGGING_GUIDE.md + fix + re-test
```

### Fase 2: Regression Tests (25 min)
```
1. Ler: 04-TEST_EXECUTION_GUIDE.md → Fase 2
2. Ler: 02-REGRESSION_TESTS.md
3. Executar: 19 testes de regressão
4. Documentar: Em TEST_RESULTS_TEMPLATE.md
5. Validar: 19/19 PASSARAM?
   - SIM → Prosseguir
   - NÃO → ⚠️ ROLLBACK recomendado
```

### Fase 3: Performance Tests (20 min)
```
1. Ler: 04-TEST_EXECUTION_GUIDE.md → Fase 3
2. Ler: 03-PERFORMANCE_TESTS.md
3. Executar: 18 métricas
4. Documentar: Em TEST_RESULTS_TEMPLATE.md
5. Validar: 80%+ PASSARAM?
   - SIM → Prosseguir
   - NÃO → Investigar gargallos
```

### Fase 4: Deployment (10 min)
```
1. Ler: 05-DEPLOYMENT_CHECKLIST.md
2. Executar: Pré-deployment checks
3. Seguir: Deployment steps (backup → transfer → build → swap → start)
4. Validar: Health checks
5. Monitorar: Primeiros 5 min
```

---

## Visão Geral dos Testes

### Initial Tests (23 casos)
**Objetivo**: Validar que Phase 2 está implementado corretamente

```
Seção 1: Autenticação (4 testes)
  ✅ Signup, login com senha correta, senhas erradas, emails inválidos

Seção 2: Auto-Provisioning (5 testes)
  ✅ Tenant criado automaticamente, sem duplicatas, RLS policies funcionam

Seção 3: Admin Endpoints (10 testes)
  ✅ GET/PATCH settings, GET members, PATCH member role, GET billing, GET audit

Seção 4: RLS & Segurança (3 testes)
  ✅ Cross-tenant bloqueado, audit logs completos, secrets não expostos

Seção 5: Error Handling (1 teste)
  ✅ Validação de input rejeita dados inválidos

Critério: 23/23 ✅
```

### Regression Tests (19 casos)
**Objetivo**: Garantir que features antigas não foram quebradas

```
Seção 1: Message Library (5 testes)
  ✅ CRUD completo + isolação por tenant

Seção 2: Campaigns (5 testes)
  ✅ CRUD + isolação

Seção 3: Inbox (4 testes)
  ✅ Listar, marcar lido, deletar + isolação

Seção 4: Billing (3 testes)
  ✅ Saldo, transações, trial válido

Seção 5: Warmup (2 testes)
  ✅ Config endpoint + isolação

Critério: 19/19 ✅ (ou ROLLBACK)
```

### Performance Tests (18 métricas)
**Objetivo**: Validar que aplicação mantém performance

```
Page Load Times (5 métricas)
  ✅ Login FCP < 1.5s, Dashboard < 2s, APIs < 500ms

API Response Times (5 métricas)
  ✅ Auto-provisioning < 800ms, queries < 600ms

Throughput (2 métricas)
  ✅ 10+ concurrent requests < 2s

Memory Usage (3 métricas)
  ✅ < 100MB após login, < 150MB após 50 requests

Database (3 métricas)
  ✅ Queries com índices < 100-200ms

Critério: 80%+ dentro dos thresholds (mínimo 15/18)
```

---

## Exemplo de Execução (Agente)

### Passo 1: Lê TESTING_STRATEGY.md
Agente entende que precisa:
- Fazer 23 testes iniciais
- Depois 19 regressão
- Depois 18 performance
- Só aí pode fazer deploy

### Passo 2: Começa INITIAL_TESTS.md
```javascript
// Teste 1.1 - Signup
const response = await fetch('https://app.ruptur.cloud/auth/signup', {
  method: 'POST',
  body: JSON.stringify({ email: 'test@test.com', password: '...' })
});
const data = await response.json();
console.log(data.status === 200 ? '✅ 1.1 PASSED' : '❌ 1.1 FAILED');

// Teste 1.2 - Login
// ... continua com próximos testes
```

### Passo 3: Documenta em TEST_RESULTS_TEMPLATE.md
```markdown
## Fase 2: Initial Tests

| # | Teste | Status |
|----|-------|--------|
| 1.1 | Signup | ✅ |
| 1.2 | Login | ✅ |
...
| 2.1 | Auto-prov | ✅ |
...

Resultado Final: 23/23 ✅ PASSOU
```

### Passo 4: Se algum falhar → DEBUGGING_GUIDE.md
```
"Teste 2.1 falhou com 'violates row-level security'"
→ Ir para Seção 2 do DEBUGGING_GUIDE
→ "Sintoma: RLS violation"
→ "Causa: Service role key não configurado"
→ Solução: Adicionar SUPABASE_SERVICE_ROLE_KEY ao .env
→ Re-testar
```

### Passo 5: Prossegue para Regression
Se todos os 23 iniciais passarem → Ler 02-REGRESSION_TESTS.md → Executar 19 testes

### Passo 6: Prossegue para Performance
Se todos os 19 regressão passarem → Ler 03-PERFORMANCE_TESTS.md → Executar 18 métricas

### Passo 7: Deploy
Se 80%+ performance OK → Ler 05-DEPLOYMENT_CHECKLIST.md → Deploy para produção

---

## Critérios de Sucesso

✅ **Initial Tests**: 23/23 PASSARAM (não dá para prosseguir sem isso)  
✅ **Regression Tests**: 19/19 PASSARAM (se falhar = ROLLBACK)  
✅ **Performance**: 80%+ das métricas OK (15/18 minimum)  
✅ **Deployment**: Todos os checks passaram  

---

## O que Mudou em Phase 2?

**Arquivo**: [modules/auth/index.js](../../modules/auth/index.js)
- ✅ Added `getSupabaseAdmin()` lazy-loaded client com service role key
- ✅ Modified `getOrCreateUserTenant()` para auto-criar tenant se não existir
- ✅ Modificado todas as INSERT/UPDATE para usar service role key

**Arquivo**: [api/routes-admin-tenants.mjs](../../api/routes-admin-tenants.mjs)
- ✅ NEW — Endpoints para GET/PATCH tenant settings
- ✅ NEW — Endpoints para manage members (GET list, PATCH role)
- ✅ NEW — Endpoints para GET billing info e audit logs

**Arquivo**: [modules/admin/tenant-config.service.js](../../modules/admin/tenant-config.service.js)
- ✅ NEW — Service class encapsulando lógica de tenant config
- ✅ Métodos: getTenantSettings, updateTenantSettings, getTenantMembers, updateMemberRole, getTenantBilling, getTenantAudit

**RLS Policies**:
- ✅ Adicionado policies para auto-provisioning (service role pode criar tenants)
- ✅ Policies garantem isolamento por tenant

---

## Variáveis de Ambiente Necessárias

```bash
# Critical
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Service role secret (novo)
VITE_SUPABASE_URL=https://...       # Supabase URL
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ... # Anon key

# Others
NODE_ENV=production
DATABASE_URL=postgresql://...
```

---

## Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| Teste 1.x falha | Verificar auth flow — DEBUGGING_GUIDE.md Seção 1 |
| Teste 2.x falha | Verificar auto-provisioning — DEBUGGING_GUIDE.md Seção 2 |
| Teste 3.x falha | Verificar admin endpoints — DEBUGGING_GUIDE.md Seção 3 |
| Performance slow | Verificar índices/queries — DEBUGGING_GUIDE.md Seção 4 |
| Regressão falha | Reverter para versão anterior (ROLLBACK) |

---

## Como Agentes Devem Executar

### Opção 1: Manual (Passo-a-passo no Console)
```javascript
// Agente copia código de cada teste
// Cola no console do navegador
// Documenta resultado
// Passa pro próximo
// Duração: ~80 minutos
```

### Opção 2: Automatizado (Script)
```bash
# Agente cria script que:
# 1. Lê INITIAL_TESTS.md
# 2. Extrai código de cada teste
# 3. Executa em paralelo (com rate limiting)
# 4. Coleta resultados
# 5. Preenche TEST_RESULTS_TEMPLATE.md
# Duração: ~40 minutos (mais rápido)
```

### Opção 3: Híbrida (Recomendada)
```javascript
// Agente roda testes iniciais/regressão automatizados
// Testes de performance rodam manualmente (por ser mais complexo)
// Duração: ~60 minutos
```

---

## Referências

- [Phase 2 Memory](../memory/phase2_deployment_status.md)
- [Security Architecture](../memory/security_architecture_gaps.md)
- [AGENTS.md](../../AGENTS.md) — Instruções gerais do projeto
- [Supabase Docs](https://supabase.com/docs)
- [Ruptur Deploy Guide](../../docs/DEPLOYMENT.md)

---

## Próximos Passos

1. **Agora**: Ler 00-TESTING_STRATEGY.md
2. **Depois**: Seguir 04-TEST_EXECUTION_GUIDE.md
3. **Executar**: INITIAL_TESTS.md + REGRESSION_TESTS.md + PERFORMANCE_TESTS.md
4. **Documentar**: TEST_RESULTS_TEMPLATE.md
5. **Deploy**: DEPLOYMENT_CHECKLIST.md

---

**Gerado para**: Development & Testing  
**Arquitetura**: Multi-tenant SaaS com auto-provisioning  
**Status**: ✅ Pronto para Agentes Executarem  
**Versão**: 1.0 (2026-05-08)
