# 🚀 Prompt para Claude for Chrome — Executar Testes Phase 2

**Copie e cole este prompt no Claude for Chrome** para executar automaticamente todos os testes.

---

```markdown
# Phase 2 Testing Automation — Ruptur SaaS

## Objetivo
Executar 60+ testes automaticamente (Initial + Regression + Performance) e documentar resultados.

## URLs de Referência
- **Home**: https://app.ruptur.cloud
- **Admin API Base**: https://app.ruptur.cloud/api/admin
- **Health Check**: https://app.ruptur.cloud/api/local/health

## Documentação Local
- READ FIRST: https://github.com/ruptur/saas/docs/testing/README.md
- Strategy: https://github.com/ruptur/saas/docs/testing/00-TESTING_STRATEGY.md
- Initial Tests: https://github.com/ruptur/saas/docs/testing/01-INITIAL_TESTS.md
- Regression Tests: https://github.com/ruptur/saas/docs/testing/02-REGRESSION_TESTS.md
- Performance Tests: https://github.com/ruptur/saas/docs/testing/03-PERFORMANCE_TESTS.md
- Debugging: https://github.com/ruptur/saas/docs/testing/06-DEBUGGING_GUIDE.md
- Results Template: https://github.com/ruptur/saas/docs/testing/07-TEST_RESULTS_TEMPLATE.md

## Fluxo (90 minutos total)

### 1️⃣ Setup (5 min)
- [ ] Verificar health check: `curl https://app.ruptur.cloud/api/local/health`
- [ ] Abrir DevTools (F12)
- [ ] Limpar cache: Ctrl+Shift+Delete
- [ ] Network tab aberto
- [ ] Console pronto para copiar/colar código

### 2️⃣ Phase 1: Initial Tests (30 min)
```
Fazer signup + login com novo usuário
Executar 23 testes de happy path + auto-provisioning
Cada teste: copiar código JavaScript → colar console → validar resultado
Documentar: ✅/❌ em planilha
Se algum falha: verificar DEBUGGING_GUIDE.md
```

**23 Casos**:
- Tests 1-3: Signup & Login
- Tests 4-6: Auto-Provisioning (logs, network, storage)
- Tests 7-13: Admin Endpoints (GET settings, members, billing, audit, PATCH)
- Tests 14-17: Error Handling (sem token, token inválido, ID inválido)
- Tests 18-23: Regression Rápida (campanhas, inbox, warmup, logout/re-login)

**BLOCKER**: Se algum falhar → PARAR, ler DEBUGGING_GUIDE.md, corrigir, re-testar

### 3️⃣ Phase 2: Regression Tests (20 min)
```
Verificar que features antigas continuam funcionando:
- Message Library (CRUD)
- Campaigns (CRUD)
- Inbox (listar, marcar lido, deletar)
- Billing (saldo, transações)
- Warmup (endpoints)

19 testes, mesma metodologia: copiar → colar → validar
```

**BLOCKER**: Se algum falhar → ROLLBACK (reverter versão anterior)

### 4️⃣ Phase 3: Performance Tests (15 min)
```
Medir 18 métricas de performance:
- Page Load Times (FCP, LCP, Load)
- API Response Times (warmup, settings, members, billing, audit)
- Throughput (10+ concurrent requests)
- Memory (uso, vazamentos)
- Database (query times)

Documentar em segundos/milissegundos
80%+ devem estar dentro dos thresholds
```

### 5️⃣ Phase 4: Deployment Checklist (10 min)
```
Se todas as fases passaram:
- Executar pre-deployment checks
- Backup do banco
- Deploy para produção
- Health check após deploy
- Monitorar por 5 minutos
```

## Como Executar Testes

### Opção 1: Manual (Passo-a-passo)
```javascript
// Copie cada bloco de código abaixo
// Cole no console do navegador (F12)
// Espere resultado
// Marque ✅ ou ❌
// Próximo teste

// TEST 1.1 - Signup carrega
fetch('https://app.ruptur.cloud/signup')
  .then(r => r.status === 200 ? console.log('✅ 1.1 PASSED') : console.log('❌ 1.1 FAILED'))
```

### Opção 2: Semi-Automática (copiar toda seção)
```javascript
// Preparar cookies/tokens
const token = JSON.parse(localStorage.getItem('sb-axrwlboyowoskdxeogba-auth-token')).session.access_token;
const tenantId = localStorage.getItem('tenantId');

// Executar testes em série
async function runTests() {
  const results = {};
  
  // TEST 1.1
  const test11 = await fetch('https://app.ruptur.cloud/signup').then(r => r.status === 200);
  results['1.1'] = test11 ? '✅' : '❌';
  
  // TEST 1.2
  // ... etc
  
  console.table(results);
}

runTests();
```

### Opção 3: Fully Automatizada (recomendada)
```javascript
// Agente cria script que:
// 1. Lê todas as URLs de documentação
// 2. Extrai código de cada teste
// 3. Executa em paralelo com rate limiting
// 4. Coleta resultados
// 5. Preenche template HTML
// Duração: ~40 minutos
```

## Testes Críticos (Must-Pass)

Se ANY destes falhar = BLOCKER:

### Phase 1 Blockers
- Test 1.3: Login funciona (POST /auth/login → 200)
- Test 4.1: Auto-provisioning logs appear (`[Auth] getOrCreateUserTenant`)
- Test 4.2: GET /warmup/config retorna 200 + tenantId
- Test 7.1: Dashboard carrega sem erro 403/500
- Test 8.1: GET /settings retorna trial plan + 1000 credits

### Phase 2 Blockers
- Campaigns endpoint still works (GET /api/campaigns)
- Inbox endpoint still works (GET /api/inbox)
- Warmup endpoint still works (GET /api/warmup/state)

## Variáveis de Ambiente Críticas

Se testes falharem com "403 violates row-level security":
→ Verificar `.env` tem:
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ...
VITE_SUPABASE_URL=https://axrwlboyowoskdxeogba.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

## Documentação de Resultados

Depois de cada fase, preencher:

```markdown
## Phase 1: Initial Tests
| # | Teste | Status |
|1.1| Signup | ✅ |
|1.2| Login | ✅ |
...
Total: 23/23 ✅ PASSOU

## Phase 2: Regression Tests
| # | Teste | Status |
|1.1| Message CRUD | ✅ |
...
Total: 19/19 ✅ PASSOU

## Phase 3: Performance
| Métrica | Valor | Threshold | Status |
|FCP | 1.2s | <1.5s | ✅ |
...
Total: 17/18 ✅ 94% PASSED
```

## Troubleshooting Rápido

| Erro | Causa | Solução |
|-----|-------|---------|
| `403 violates RLS` | Service role key missing | Adicionar `SUPABASE_SERVICE_ROLE_KEY` a `.env` |
| `[Auth] getOrCreateUserTenant not in logs` | Auto-prov não rodou | Verificar supabase connection |
| `POST /auth/login → 500` | Auth service down | Verificar `docker logs` |
| `GET /warmup/config → 502` | Warmup crashed | Restart containers |
| Admin endpoints 404 | Routes não implementadas | Verificar `api/routes-admin-tenants.mjs` |

**Mais detalhes**: Ler `/docs/testing/06-DEBUGGING_GUIDE.md`

## Próximos Passos Após Testes

1. ✅ Phase 1 PASSOU? → Continuar
2. ✅ Phase 2 PASSOU? → Continuar
3. ✅ Phase 3 80%+? → Deploy
4. 📋 Executar DEPLOYMENT_CHECKLIST.md
5. 🚀 Deploy para produção

## Contatos & Escalação

- **RLS Errors**: Verificar `SUPABASE_SERVICE_ROLE_KEY`
- **Auto-prov falha**: Ler `06-DEBUGGING_GUIDE.md` Seção 2
- **Admin 403**: Verificar `user_tenant_roles` (deve ser owner)
- **Performance lento**: Verificar índices BD

## Resumo Final

```
✅ 23/23 Initial Tests PASSARAM
✅ 19/19 Regression Tests PASSARAM
✅ 15/18 Performance Metrics OK
✅ Deployment Checklist EXECUTADO
✅ Deploy feito, health check OK
✅ Monitorado 5 min

= Phase 2 ✅ COMPLETO
```

---

**Para começar**: Ler `/docs/testing/README.md` depois `/docs/testing/TESTING_STRATEGY.md`
```

---

## Como Usar Este Prompt

1. **Copie TODO o texto acima** (entre os backticks)
2. **Abra Claude for Chrome**
3. **Cole no chat**
4. **Siga as instruções**
5. **Documente resultados em TEST_RESULTS_TEMPLATE.md**
6. **Reporte final para Diego**

---

## Alternativas: Se Usar Outro Agente

- **Graphyfy**: Pode gerar fluxograma dos testes
- **Codex**: Pode refatorar/otimizar testes automatizados
- **API Agent**: Pode rodar testes via API sem UI

---

**Versão**: 1.0  
**Data**: 2026-05-08  
**Status**: Pronto para Claude for Chrome executar
