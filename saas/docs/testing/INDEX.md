# 📋 INDEX — Testing Package Phase 2 (End-to-End)

**Último Update**: 2026-05-08  
**Status**: ✅ Complete & Ready for Agents  
**Total Docs**: 9 arquivos | ~80 páginas | ~2h execução

---

## 🎯 Para Quem É Isso?

- **Agentes** (Claude for Chrome, Graphyfy, Codex): Ler arquivo → Executar testes → Documentar resultados
- **Engenheiros** (Diego): Review testes → Validar antes de deploy → Rollback se necessário
- **DevOps**: Execute deployment checklist antes de ir pra produção

---

## 📁 Estrutura de Arquivos

```
docs/testing/
├── 00-TESTING_STRATEGY.md ......... Visão geral 3-camadas (ler primeiro)
├── 01-INITIAL_TESTS.md ........... 23 testes de happy path
├── 02-REGRESSION_TESTS.md ........ 19 testes de features antigas
├── 03-PERFORMANCE_TESTS.md ....... 18 métricas de latência/throughput
├── 04-TEST_EXECUTION_GUIDE.md .... Como rodar testes (manual/auto)
├── 05-DEPLOYMENT_CHECKLIST.md .... Pré-deploy + rollback plan
├── 06-DEBUGGING_GUIDE.md ......... Troubleshooting de falhas
├── 07-TEST_RESULTS_TEMPLATE.md ... Documentar resultados
├── README.md ..................... Visão geral + fluxo
└── INDEX.md (este arquivo) ....... Coordenação de tudo
```

---

## 🚀 Fluxo Rápido (Como Começar)

### Para Agentes (Automatizado)
```
1. Ler: README.md (5 min)
2. Ler: TESTING_STRATEGY.md (10 min)
3. Executar: INITIAL_TESTS.md (30 min)
   → Se 23/23 passa → Continuar
   → Se algum falha → Ler DEBUGGING_GUIDE.md → Corrigir → Retry
4. Executar: REGRESSION_TESTS.md (20 min)
5. Executar: PERFORMANCE_TESTS.md (15 min)
6. Documentar: TEST_RESULTS_TEMPLATE.md (5 min)
7. Deploy: DEPLOYMENT_CHECKLIST.md (10 min)

TOTAL: ~90 minutos
```

### Para Engenheiros (Review Manual)
```
1. Ler: TESTING_STRATEGY.md
2. Review: INITIAL_TESTS.md + REGRESSION_TESTS.md
3. Executar: test-results de agente
4. Validar: Todos os testes OK?
5. Deploy: DEPLOYMENT_CHECKLIST.md
```

---

## 📊 O que Cada Arquivo Cobre

| Arquivo | Seções | Testes | Tempo | Goal |
|---------|--------|--------|-------|------|
| **00-TESTING_STRATEGY.md** | 1 | N/A | 10min | Entender estratégia 3-camadas |
| **01-INITIAL_TESTS.md** | 5 | 23 | 30min | Validar Phase 2 (auto-prov) |
| **02-REGRESSION_TESTS.md** | 5 | 19 | 20min | Garantir sem quebras |
| **03-PERFORMANCE_TESTS.md** | 7 | 18 | 15min | Validar eficiência |
| **04-TEST_EXECUTION_GUIDE.md** | 5 | - | - | Como rodar testes |
| **05-DEPLOYMENT_CHECKLIST.md** | 4 | - | 10min | Pré-deploy safety |
| **06-DEBUGGING_GUIDE.md** | 8 | - | - | Troubleshoot falhas |
| **07-TEST_RESULTS_TEMPLATE.md** | 1 | - | 5min | Documentar tudo |

---

## ✅ Critérios de Sucesso (Aprovação)

### Phase 1: Initial Tests
- [ ] 23/23 testes PASSARAM
- [ ] Console logs válidos
- [ ] localStorage com tenantId correto
- [ ] Admin endpoints retornam dados esperados

**Se falhar**: ⚠️ Parar aqui, ler DEBUGGING_GUIDE.md, corrigir, re-testar

### Phase 2: Regression Tests
- [ ] 19/19 testes PASSARAM
- [ ] Features antigas funcionam
- [ ] Sem 403/500 inesperados

**Se falhar**: 🔴 ROLLBACK imediato (revert para versão anterior)

### Phase 3: Performance Tests
- [ ] 80%+ das métricas dentro dos thresholds (mínimo 15/18)
- [ ] Sem memory leaks
- [ ] Sem 502 Bad Gateway

**Se falhar**: ⚠️ Investigar gargalos, otimizar queries, índices, etc.

### Phase 4: Deployment
- [ ] Todos os pre-deployment checks passaram
- [ ] Backup feito
- [ ] Health check OK pós-deploy
- [ ] Monitorado por 5 minutos

**If OK**: ✅ Deploy completo, Fase 2 em produção

---

## 🔍 Vista Geral dos Testes

### Initial Tests (23 casos)
```
1. Autenticação (4)
   ✅ Signup, login, senha errada, email inválido

2. Auto-Provisioning (5)
   ✅ Tenant criado automático, RLS, console logs

3. Admin Endpoints (10)
   ✅ GET/PATCH settings, GET members, GET billing, GET audit

4. Segurança (3)
   ✅ Cross-tenant bloqueado, audit logs, secrets ocultos

5. Error Handling (1)
   ✅ Validação de input

Aceitação: 23/23 ✅
```

### Regression Tests (19 casos)
```
1. Message Library (5)
   ✅ CRUD + isolação por tenant

2. Campaigns (5)
   ✅ CRUD + isolação

3. Inbox (4)
   ✅ Listar, marcar lido, deletar + isolação

4. Billing (3)
   ✅ Saldo, transações, trial

5. Warmup (2)
   ✅ Config endpoint + isolação

Aceitação: 19/19 ✅ (ou ROLLBACK)
```

### Performance Tests (18 métricas)
```
1. Page Load Times (5)
   ⏱️ FCP < 1.5s, Dashboard < 2s, APIs < 500ms

2. API Response Times (5)
   ⏱️ Auto-prov < 800ms, queries < 600ms

3. Throughput (2)
   📊 10+ concurrent < 2s

4. Memory (3)
   💾 < 100MB após login

5. Database (3)
   🗄️ Queries < 100-200ms

Aceitação: 80%+ (mínimo 15/18)
```

---

## 🛠️ Variáveis de Ambiente Críticas

```bash
# Must-have
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # NEW em Phase 2
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...

# Check
NODE_ENV=production
DATABASE_URL=postgresql://...
```

**⚠️ IMPORTANTE**: Se `SUPABASE_SERVICE_ROLE_KEY` não estiver configurado, auto-provisioning falha com RLS violation.

---

## 🚨 Problemas Comuns & Soluções Rápidas

| Sintoma | Causa Provável | Solução |
|---------|---|---|
| 403 "violates row-level security" | Service role key não configurado | Adicionar `SUPABASE_SERVICE_ROLE_KEY` a `.env` |
| "User without tenant" | Auto-provisioning não rodou | Verificar `[Auth] getOrCreateUserTenant` logs |
| 502 Bad Gateway | Warmup runtime crashed | Verificar `docker logs` e restart containers |
| Admin endpoints 404 | Routes não implementadas | Verificar `/api/routes-admin-tenants.mjs` |
| Performance lento | Queries sem índices | Verificar índices em `instance_registry` table |

**Mais detalhes**: Ler [06-DEBUGGING_GUIDE.md](06-DEBUGGING_GUIDE.md)

---

## 📞 Escalação

| Problema | Contato |
|----------|---------|
| Erro de RLS policies | Verificar `SUPABASE_SERVICE_ROLE_KEY` |
| Auto-provisioning falha | Verificar `modules/auth/index.js` + logs |
| Admin endpoints 403 | Verificar `user_tenant_roles` (deve ter owner) |
| Performance degradada | Verificar índices + `EXPLAIN ANALYZE` queries |
| Precisa rollback | Executar `ROLLBACK_PROCEDURE` em DEPLOYMENT_CHECKLIST.md |

---

## 📈 Timeline Estimada

| Fase | Documento | Tempo | Blocker? |
|------|-----------|-------|----------|
| Setup | TESTING_STRATEGY.md | 10min | Não |
| Initial | INITIAL_TESTS.md | 30min | **SIM** (23/23 obrigatório) |
| Regression | REGRESSION_TESTS.md | 20min | **SIM** (19/19 ou rollback) |
| Performance | PERFORMANCE_TESTS.md | 15min | Não (mas informativo) |
| Deploy | DEPLOYMENT_CHECKLIST.md | 10min | **SIM** (antes de prod) |
| **TOTAL** | - | **~85 min** | - |

---

## 📚 Documentação Relacionada

- [AGENTS.md](../../AGENTS.md) — Instruções gerais do projeto
- [Phase 2 Memory](../memory/phase2_deployment_status.md) — Status de deployment
- [Security Architecture](../memory/security_architecture_gaps.md) — Gaps & fixes
- [Supabase Docs](https://supabase.com/docs/guides/auth) — Auth reference
- [Deployment Guide](../../docs/DEPLOYMENT.md) — Deploy procedures

---

## 🎓 Exemplo: Como Agente Deve Ler

### Agente começa aqui (este arquivo)
```
"OK, preciso executar 90 minutos de testes."
"São 4 fases: Initial → Regression → Performance → Deploy."
"Se algum dos 2 primeiros falhar, devo parar."
"Primeiro, vou ler TESTING_STRATEGY.md para entender contexto."
```

### Lê TESTING_STRATEGY.md
```
"Entendi: Phase 2 adicionou auto-provisioning."
"Preciso validar que novo usuário consegue criar tenant automaticamente."
"E que features antigas (campaigns, inbox, billing) não quebraram."
```

### Lê INITIAL_TESTS.md
```
"Agora vou copiar os códigos JavaScript de cada teste."
"Colar no console do navegador (F12)."
"Marcar cada um como ✅ ou ❌."
"Se algum falha, vou ler DEBUGGING_GUIDE.md."
```

### Executa teste a teste
```javascript
// Teste 1.1 - Signup
fetch(...) → Resultado: ✅ PASSED

// Teste 1.2 - Login
fetch(...) → Resultado: ✅ PASSED

// ... continua com próximos ...

// Se algum falha:
// "Teste 2.1 retornou 403 RLS violation"
// → Ler DEBUGGING_GUIDE.md Seção 2.1
// → "Solução: Adicionar SUPABASE_SERVICE_ROLE_KEY"
// → Corrigir .env
// → Re-testar
```

### Documenta em TEST_RESULTS_TEMPLATE.md
```markdown
## Fase 1: Initial Tests
| # | Teste | Status |
|1.1| Signup | ✅ |
|1.2| Login | ✅ |
...
Total: 23/23 ✅ PASSOU
```

### Prossegue para Regression
```
"Initial tests passaram, agora vou rodar Regression."
"Ler REGRESSION_TESTS.md..."
```

---

## ✨ O Que Mudou em Phase 2

**Code Changes**:
- `modules/auth/index.js` — Added `getSupabaseAdmin()` + `getOrCreateUserTenant()`
- `api/routes-admin-tenants.mjs` — NEW endpoints para tenant config
- `modules/admin/tenant-config.service.js` — NEW service layer

**RLS Changes**:
- Adicionado policies para auto-provisioning
- Service role key pode criar/atualizar tenants
- Isolamento por tenant_id mantido

**Database Changes**:
- `audit_logs` table criada para tracking
- `instance_registry` table atualizada com indices

---

## 🎯 Prioridades (Must-Have)

1. **✅ Initial Tests 23/23 PASSAM** — Non-negotiable
2. **✅ Regression Tests 19/19 PASSAM** — Non-negotiable (ou rollback)
3. **✅ Performance 80%+ OK** — Desejável (não bloqueia)
4. **✅ Deployment Checklist** — Before going live

---

## 📝 Checklist Agente (Antes de Começar)

- [ ] Ler este INDEX.md
- [ ] Ler TESTING_STRATEGY.md
- [ ] Verificar `.env` tem `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Rodar health check: `curl https://app.ruptur.cloud/api/local/health`
- [ ] Abrir DevTools (F12)
- [ ] Começar INITIAL_TESTS.md

---

## 🏁 Resultado Final (Success Criteria)

```
✅ 23/23 Initial Tests PASSARAM
✅ 19/19 Regression Tests PASSARAM
✅ 15/18+ Performance Metrics OK
✅ Deployment Checklist COMPLETADO
✅ Deploy feito, health check OK
✅ Monitorado por 5 minutos

= Phase 2 ✅ COMPLETO
```

---

**Para Agentes**: Comece pelo README.md, depois TESTING_STRATEGY.md, depois INITIAL_TESTS.md  
**Para Engenheiros**: Review TESTING_STRATEGY.md + resultados finais  
**Para DevOps**: Execute DEPLOYMENT_CHECKLIST.md  

---

**Versão**: 1.0 (2026-05-08)  
**Arquitetura**: Multi-tenant SaaS + Auto-provisioning  
**Status**: ✅ Pronto para Execução
