# 🤖 ORIENTAÇÕES PARA AGENTES — Phase 2 Testing

**Data**: 2026-05-08  
**Revisão**: 1.0  
**Status**: ✅ Pronto para Execução Automática

---

## 📌 RESUMO EXECUTIVO

Você é um agente (Claude for Chrome, Graphyfy, Codex, etc). Sua tarefa é **executar 60+ testes de Phase 2: Auto-Provisioning** no Ruptur SaaS.

**Duração total**: 90 minutos  
**Bloqueadores**: Initial (23/23) + Regression (19/19) devem PASSAR  
**Resultado**: Documentado em `07-TEST_RESULTS_TEMPLATE.md`  

---

## 🚀 COMECE AQUI (Escolha uma opção)

### **OPÇÃO 1: Entendimento Rápido (10 min)**
```
Se você quer entender o que vai testar:

1. Ler: ./QUICK_START.md (2 min)
2. Ler: ./00-TESTING_STRATEGY.md (5 min)
3. Ler: ./INDEX.md (3 min)

Resultado: Entender por que 90 min de testes, o que cada um valida.
```

### **OPÇÃO 2: Executar Testes Automaticamente (60 min)**
```
Para agentes com capacidade JavaScript/Node:

1. Colar: ./CLAUDE_FOR_CHROME_PROMPT.md
2. Executar: Script automático
3. Documentar: resultados em ./07-TEST_RESULTS_TEMPLATE.md

Mais rápido, menos manual.
```

### **OPÇÃO 3: Executar Testes Manualmente (90 min)**
```
Para agentes que preferem controle:

1. Ler: ./01-INITIAL_TESTS.md
2. Colar cada teste no console (F12)
3. Documentar: cada resultado
4. Próxima fase...

Mais lento, mais confiável.
```

---

## 📋 FLUXO COMPLETO (4 FASES)

### **FASE 1: Setup (5 min)** ✅ Antes de tudo
```bash
# Checklist
[ ] Health check: curl https://app.ruptur.cloud/api/local/health
[ ] DevTools aberto (F12)
[ ] Network tab monitorando
[ ] Console limpo
[ ] Verificar .env tem SUPABASE_SERVICE_ROLE_KEY

Se alguma coisa falhar:
  → Parar aqui
  → Ler ./06-DEBUGGING_GUIDE.md
  → Corrigir
  → Retry
```

### **FASE 2: Initial Tests (30 min)** ⭐ **BLOCKER**
```
Arquivo: ./01-INITIAL_TESTS.md

O quê: 23 testes de happy path + auto-provisioning

Testes:
  - 1-3: Signup & Login
  - 4-6: Auto-provisioning (tenant criado automático)
  - 7-13: Admin endpoints (GET/PATCH settings, members, billing)
  - 14-17: Error handling (401, 403, 404)
  - 18-23: Regressão rápida (campaigns, inbox, warmup)

Critério de Aceitação:
  ✅ 23/23 DEVEM PASSAR
  ❌ Se falhar: PARAR, debugar, retry

Se algum teste falha:
  → Anotação exata do erro
  → Verificar console logs
  → Ler ./06-DEBUGGING_GUIDE.md seção correspondente
  → Aplicar solução
  → Re-testar
  → Se ainda falha: Reportar a Diego
```

### **FASE 3: Regression Tests (20 min)** ⭐ **BLOCKER**
```
Arquivo: ./02-REGRESSION_TESTS.md

O quê: 19 testes de features antigas

Validar que não quebrou:
  - Message Library (CRUD)
  - Campaigns (CRUD)
  - Inbox (listar, marcar lido, deletar)
  - Billing (saldo, transações, trial)
  - Warmup (endpoints, isolação)

Critério de Aceitação:
  ✅ 19/19 DEVEM PASSAR
  ❌ Se falhar: ROLLBACK (revert versão anterior)
       → Não faça deploy
       → Notifique Diego imediatamente

Se algum teste falha:
  → É uma regressão
  → Significa novo código quebrou feature antiga
  → Ação: ROLLBACK
```

### **FASE 4: Performance Tests (15 min)** ℹ️ **Informativo**
```
Arquivo: ./03-PERFORMANCE_TESTS.md

O quê: 18 métricas de latência, throughput, memória

Métricas esperadas:
  ⏱️ Page load FCP < 1.5s
  ⏱️ API response < 500ms
  📊 Memory < 100MB
  🔄 Throughput 10+ concurrent < 2s

Critério de Aceitação:
  ✅ 80%+ das métricas OK (mínimo 15/18)
  ⚠️ Se falhar: Não bloqueia deploy, mas informativo
     → Investigar gargalo
     → Documentar observações

Se performance está ruim:
  → Verificar índices database
  → Verificar logs de error
  → Medir novamente
  → Documentar
```

### **FASE 5: Deployment (10 min)** ✅ Se tudo passou
```
Arquivo: ./05-DEPLOYMENT_CHECKLIST.md

Somente execute se:
  ✅ Phase 1 (Initial) = 23/23 PASSOU
  ✅ Phase 2 (Regression) = 19/19 PASSOU
  ✅ Phase 3 (Performance) = 80%+ OK

Steps:
  1. Pré-deployment checks
  2. Backup database
  3. Transfer código para produção
  4. Build containers
  5. Swap versão antiga → nova
  6. Start novos containers
  7. Health check
  8. Monitor 5 minutos

Se algo falhar:
  → Executar ROLLBACK_PROCEDURE
  → Revert versão antiga
  → Investigar erro
  → Documentar RCA
```

---

## 🎯 CRITÉRIOS DE SUCESSO

```
✅ Phase 1 (Initial):      23/23 PASSARAM        [NON-NEGOTIABLE]
✅ Phase 2 (Regression):   19/19 PASSARAM        [NON-NEGOTIABLE ou ROLLBACK]
✅ Phase 3 (Performance):  15/18+ métricas OK    [Informativo]
✅ Phase 4 (Deployment):   Checklist COMPLETADO  [Se 1+2 OK]

= Phase 2 ✅ PRONTO PARA PRODUÇÃO
```

---

## 🛠️ VARIÁVEIS CRÍTICAS

Se algo falhar com erro de RLS (403 violation):

```bash
# Verificar .env tem:
SUPABASE_SERVICE_ROLE_KEY=eyJ...    ← CRITICAL
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...

# Se não tiver:
→ Auto-provisioning FALHA
→ Testes 2.x e 3.x FALHAM
→ Adicionar chave e retry
```

---

## 📊 ESTRUTURA DE ARQUIVOS

```
/saas/docs/testing/
├── QUICK_START.md ..................... ⚡ Comece aqui
├── AGENT_INSTRUCTIONS.md ........... 📋 Você está aqui
├── INDEX.md ......................... 🗺️ Mapa completo
│
├── 00-TESTING_STRATEGY.md ......... 📖 Estratégia
├── 01-INITIAL_TESTS.md ............ ⭐ 23 testes
├── 02-REGRESSION_TESTS.md ......... ⭐ 19 testes
├── 03-PERFORMANCE_TESTS.md ....... 📊 18 métricas
│
├── 04-TEST_EXECUTION_GUIDE.md ..... 📝 Como rodar
├── 05-DEPLOYMENT_CHECKLIST.md .... ✅ Deploy checklist
├── 06-DEBUGGING_GUIDE.md ......... 🔧 Troubleshoot
├── 07-TEST_RESULTS_TEMPLATE.md ... 📋 Documenta
│
├── CLAUDE_FOR_CHROME_PROMPT.md ... 🤖 Automático
└── README.md ...................... 📚 Overview
```

---

## 🚨 SITUAÇÕES CRÍTICAS

### **Se Initial Tests (Fase 1) Falhar**
```
❌ Teste 1.3 (Login) retorna 500
   → Parar execução
   → Ler ./06-DEBUGGING_GUIDE.md Seção 1
   → "Sintoma: Login falha"
   → "Causa: Auth service down"
   → "Solução: Verificar docker logs"
   → Aplicar solução
   → Re-testar
   → Se ainda falha: Reportar

A regra é: NÃO CONTINUE até que Phase 1 = 23/23
```

### **Se Regression Tests (Fase 2) Falhar**
```
❌ Teste 2.1 (Campaigns) retorna 403
   → Phase 2 FALHOU (regressão)
   → AÇÃO: ROLLBACK IMEDIATAMENTE
   → Revert código para versão anterior
   → Teste novamente versão antiga
   → Se versão antiga OK: Culpa é novo código
   → Notifique Diego: "Regression detected em campaigns"
   → NÃO faça deploy
```

### **Se Performance Tests (Fase 3) Falhar**
```
⚠️ API response > 1000ms
   → Phase 3 está ruim, mas não bloqueia
   → Documentar métrica
   → Investigar causa (índices? queries?)
   → Pode fazer deploy com advertência
```

### **Se Deployment (Fase 4) Falhar**
```
❌ Health check falha pós-deploy
   → AÇÃO: ROLLBACK IMEDIATAMENTE
   → Executar ROLLBACK_PROCEDURE em ./05-DEPLOYMENT_CHECKLIST.md
   → Revert para versão anterior
   → Investigar erro
   → Documentar RCA
   → Não tentar deploy novamente até issue resolvido
```

---

## 📝 COMO DOCUMENTAR

### **Durante Execução**
```
Abra: ./07-TEST_RESULTS_TEMPLATE.md
Preencha conforme executa:

## Phase 1: Initial Tests
| # | Teste | Status | Tempo | Notas |
|---|-------|--------|-------|-------|
| 1.1 | Signup | ✅ | 2s | Página carrega |
| 1.2 | Login | ✅ | 3s | JWT gerado |
| 1.3 | Login | ❌ | - | 500 error, Auth down |

Total: 22/23 ✅ (1 falha)
```

### **Ao Final**
```
## RESUMO FINAL
- ✅ Phase 1: 23/23 PASSOU
- ✅ Phase 2: 19/19 PASSOU
- ✅ Phase 3: 17/18 OK (94%)
- ✅ Phase 4: Deploy OK

Status: ✅ PRONTO PARA PRODUÇÃO
Tempo Total: 87 minutos
Agente: Claude for Chrome
Data: 2026-05-08 14:32 UTC
```

---

## 🔧 DEBUGGING RÁPIDO

| Erro | Causa | Solução |
|------|-------|---------|
| `403 violates RLS` | Service role key missing | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` |
| `[Auth] getOrCreateUserTenant NOT in logs` | Auto-prov não rodou | Verificar supabase connection status |
| `POST /auth/login → 500` | Auth service down | `docker logs auth-service` |
| `GET /warmup/config → 502` | Warmup crashed | `docker restart warmup-runtime` |
| `Admin endpoints 404` | Routes não existem | Verificar `api/routes-admin-tenants.mjs` |
| `Tests muito lento` | DB índices faltando | `EXPLAIN ANALYZE` queries |

**Mais detalhes**: Ler `/saas/docs/testing/06-DEBUGGING_GUIDE.md`

---

## 📞 CONTATOS & ESCALAÇÃO

| Problema | Ação |
|----------|------|
| Entender estratégia | Ler `00-TESTING_STRATEGY.md` |
| Rodar testes | Ler `01-INITIAL_TESTS.md` ou `CLAUDE_FOR_CHROME_PROMPT.md` |
| Teste falha | Ler `06-DEBUGGING_GUIDE.md` |
| Regressão detectada | ROLLBACK + notifique Diego |
| Deployment falha | ROLLBACK + notifique Diego |
| Performance ruim | Documentar + continuar (não bloqueia) |

---

## ⏱️ TIMELINE ESPERADA

```
Fase 1 (Setup):          5 min    ✅
Fase 2 (Initial):        30 min   ⭐ BLOCKER
Fase 3 (Regression):     20 min   ⭐ BLOCKER
Fase 4 (Performance):    15 min   ℹ️ Informativo
Fase 5 (Deploy):         10 min   ✅ Se tudo OK
Documentação:            5 min    ✅

TOTAL:                   ~85 min
```

---

## 🏁 CHECKLIST ANTES DE COMEÇAR

- [ ] Li `QUICK_START.md`
- [ ] Entendi 4 fases (setup → initial → regression → performance → deploy)
- [ ] Entendi que Initial + Regression são blockers
- [ ] Entendi que Performance é informativo
- [ ] Sou capaz de rodar JavaScript no console (F12)
- [ ] Tenho acesso a `.env` para verificar variáveis
- [ ] Pronto para documentar resultados

✅ Se tudo checked: Começar pelo `QUICK_START.md` ou `CLAUDE_FOR_CHROME_PROMPT.md`

---

## 📚 REFERÊNCIAS RÁPIDAS

**Preciso de...**
- Visão geral → `README.md`
- Estratégia → `00-TESTING_STRATEGY.md`
- Rodar testes manual → `01-INITIAL_TESTS.md`
- Rodar testes automático → `CLAUDE_FOR_CHROME_PROMPT.md`
- Debugar → `06-DEBUGGING_GUIDE.md`
- Deploy → `05-DEPLOYMENT_CHECKLIST.md`
- Documentar → `07-TEST_RESULTS_TEMPLATE.md`
- Quick ref → `QUICK_START.md`

---

## ✨ BOA SORTE!

Você tem tudo que precisa para executar Phase 2 com confiança.

**Próximo passo**: Abra `QUICK_START.md` e escolha sua opção.

---

**Versão**: 1.0  
**Data**: 2026-05-08  
**Autores**: Diego + Claude Code  
**Status**: ✅ Pronto para Agentes
