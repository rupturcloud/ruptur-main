# DISCOVERY REPORT — SaaS Migration Audit

**Data**: 2026-04-19  
**Projeto**: Ruptur SaaS Legacy → Ruptur Cloud  
**Escopo**: Auditoria técnica + Forense warmup + Planejamento migração  
**Status**: Phase 1-2 Completo | Phases 3-4 Planejadas

---

## 📋 RESUMO EXECUTIVO

A migração do legado SaaS para a nova estrutura Ruptur Cloud foi planejada em 4 fases:

| Fase | Status | O Quê | Resultado |
|------|--------|-------|-----------|
| **0** | ✅ Completo | Auditoria e classificação | 11 items inventariados |
| **1** | ✅ Completo | Criar estrutura nova | 34 diretórios criados |
| **2** | ✅ Completo | Mover arquivos não-críticos | 9 files + 3 dirs (4.2MB) |
| **3** | 🔲 Pending | Isolate integrations | UAZAPI, Supabase, Stripe |
| **4** | 🔲 Pending | Deep warmup analysis | Extract constants, tests |

**Ouro Estratégico Identificado**: Sistema de Aquecimento (Warmup)
- Operacional em produção (KVM2)
- Preservado intacto até Phase 4
- Documentação completa criada

---

## 🔍 DESCOBERTAS CRÍTICAS

### Sistema de Aquecimento (Warmup)

**O que é**: Sistema automatizado de aquecimento de instâncias WhatsApp via UAZAPI.

**Dados Técnicos**:
- **Ciclo**: 60 segundos (TICK_INTERVAL_MS)
- **Capacidade**: 6 instâncias por ciclo (MAX_QUEUE_EXECUTIONS_PER_TICK)
- **Cadência**: Mínimo 4 dias entre mensagens mesma instância (warmupMinIntervalMs = 345600ms)
- **Limite Diário**: 250 mensagens por instância
- **Taxa Anti-Ban**: 12 mensagens por minuto máximo
- **Algoritmo**: Shuffle aleatório (sender/receiver)

**Status em Produção**:
- 44 instâncias totais
- 29 conectadas (última verificação)
- Zero erros de corrupção de estado observados
- Audit trail completo desde início

**Proteções Integradas**:
- Rotina `warmup-default-24x7` (não pode ser apagada)
- Sistema de cooldown pós-envio
- Health scores por instância
- Pool management (healthy vs ready tokens)

### Arquitetura Legado

**God-File Pattern**:
- `runtime/server.mjs` contém 2611 linhas
- Responsabilidades: router HTTP, scheduler, state, UAZAPI, Supabase, audit

**Integrations Acopladas**:
- UAZAPI: Polling de instâncias a cada 60s
- Supabase: Leitura/escrita de routines e state
- Bubble: Integração de inbox mapping
- Stripe: Webhooks de checkout

**State Persistence**:
- Arquivo JSON: `runtime-data/warmup-state.json` (4.3KB)
- Schema: config, scheduler, summary, currentPool, instanceStates, logs, auditTrail
- **Risco**: Sem transações, sem file locks (race condition potencial em concorrência)

### Frontend Stack

**Distribution**:
- `dist/` (7.1KB): Front Lindona (tech-dark, laranja gradiente)
- `manager-dist/` (1.8MB): Warmup Manager (React/Vite, 12+ páginas)
- `dashboard-dist/` (2.4MB): Legacy SafeFlow (em transição)

**Tecnologias**:
- React 19, Next.js 16
- Tailwind CSS 4
- Supabase SSR
- Hardcoded env vars em JS (security issue)

### Dependências Externas

**UAZAPI**:
- Endpoint: `https://tiatendeai.uazapi.com`
- Auth: `adminToken` header
- Operations: GET /instance/all, POST /send

**Supabase**:
- URL: `https://axrwlboyowoskdxeogba.supabase.co`
- Operations: Routines CRUD, State read/write
- Risk: Public key exposed em JS

**Stripe**:
- Checkout flows
- Subscription management
- Webhook handling

**Bubble**:
- Inbox integration mapping
- Auth bridges
- Embedded forms

---

## 📁 CLASSIFICAÇÃO INVENTÁRIO

### High Risk / Priority 0
| Item | Classificação | Ação | Motivo |
|------|---------------|------|--------|
| runtime/server.mjs | 🔒 CONGELAR | Análise forense primeiro | Múltiplas responsabilidades acopladas |
| warmup-state.json | 🔄 ADAPTAR | Migrar para DB (future) | Race condition risk, sem locks |
| .env (credenciais) | 🔒 PROTEGER | Copiar manualmente | Tokens de produção expostos |

### Medium Risk / Priority 1-2
| Item | Classificação | Ação | Motivo |
|------|---------------|------|--------|
| manager-dist/ | ✅ MOVER | Copiar com cuidado | Env vars hardcoded em JS |
| Dockerfile | ✅ ADAPTAR | Atualizar paths | Node 20 slim OK, paths mudaram |
| docker-compose.yml | ✅ MOVER | Traefik labels OK | Network config estável |

### Low Risk / Priority 3
| Item | Classificação | Ação | Motivo |
|------|---------------|------|--------|
| dist/ | ✅ MOVER | Cópia direta | HTML estático, sem deps |
| dashboard-dist/ | ❄️ CONGELAR | Archive | Legacy, backwards compat |
| package.json | ✅ ADAPTAR | Update scripts | Paths mudaram apenas |
| scripts/jarvis/ | ✅ MOVER | Cópia intacta | Activation logic, sem deps warmup |

---

## 🔧 ENDPOINTS HTTP EXPOSTOS

### Warmup API Local

```
GET  /warmup/api/local/warmup/state
     → Estado completo (config, scheduler, summary, pools, instances)

POST /warmup/api/local/warmup/settings
     → Atualizar settings (serverUrl, token, defaults)

POST /warmup/api/local/warmup/routines
     → CRUD routines (create, read, update, delete)

POST /warmup/api/local/warmup/messages
     → CRUD messages (templates)

POST /warmup/api/local/warmup/control
     → Controles de scheduler (start, stop, pause)

POST /warmup/api/local/warmup/clear-token
     → Limpar admin token (logout)
```

⚠️ **Segurança**: Estes endpoints **NÃO têm autenticação** (localhost only, assumed safe)

### Frontend Routes

```
GET  /
     → Serve dist/index.html (Front Lindona)

GET  /warmup/
     → Serve manager-dist/index.html (Warmup Manager)

GET  /warmup/instances
     → Manager dashboard page

GET  /warmup/telemetry
     → Telemetry visualization
```

---

## 🚀 MAPA DE FUNÇÕES CRÍTICAS

### State Management
- `loadState()` — Carregar JSON
- `saveState()` — Persister JSON
- `jsonClone()` — Clone seguro

### Scheduler & Timing
- `getReachableMinIntervalMs()` — Calcular intervalo
- `buildNextEligibleAt()` — Próxima elegibilidade
- `getCooldownRemaining()` — Cadência restante

### Health & Eligibility
- `calculateHealthScore()` — Score saúde instância
- `isRegeneratingCandidate()` — Candidata regeneração
- `markInstanceSent()` — Registrar envio

### Routines & Messages
- `buildDefaultRoutine()` — Rotina padrão 24/7
- `pickRoutineMessage()` — Selecionar mensagem
- `refreshProtectedRoutines()` — Atualizar rotinas protegidas

### Dispatch
- `runWarmupRound()` — Executar round warmup
- `fetchAllInstances()` — Poll UAZAPI
- `updateInstances()` — Atualizar pool

---

## ⏰ TIMER & SCHEDULER

**Main Loop**:
```javascript
setInterval(async () => {
  1. loadState()
  2. if (scheduler.enabled):
     - fetchInstancesFromUAZAPI()
     - updateInstances()
     - runWarmupRound()
     - markInstancesSent()
  3. saveState()
}, TICK_INTERVAL_MS) // 60000 ms = 60 seconds
```

**Warm-up Round (até 6 instâncias)**:
```
Para cada iteração:
  1. Selecionar sender (elegível)
  2. Selecionar receiver (shuffle)
  3. Pegar mensagem da rotina
  4. Despachar via UAZAPI webhook
  5. Registrar em currentPool
  6. Logar + auditar
```

---

## 🛡️ REGRAS CRÍTICAS (NÃO MEXER)

### 🔴 PROIBIDO
- ❌ Reescrever scheduler (comportamento em produção)
- ❌ Alterar cadência (MIN_INTERVAL, MAX_DAILY)
- ❌ Mudar algoritmo shuffle (ordem afeta resultado)
- ❌ Remover protected routines logic
- ❌ Mexer state persistence sem lock/transaction
- ❌ Alterar timestamp precision
- ❌ Remover audit trail

### 🟡 CUIDADO
- ⚠️ UAZAPI endpoint pode mudar (wrapper necessário)
- ⚠️ Estado JSON cresce (monitorar size)
- ⚠️ Race conditions em JSON (usar file lock quando refatorar)
- ⚠️ Cooldown em ms (client/server devem sincronizar)

### 🟢 SEGURO
- ✅ Mover arquivo config
- ✅ Extrair constants
- ✅ Adicionar logging
- ✅ Adicionar health checks
- ✅ Criar testes read-only
- ✅ Documentar

---

## 📊 MIGRAÇÕES COMPLETADAS

**Phase 0** — Inventário & Forense
- [x] Identificados 11 itens legados
- [x] Classificados por risco/prioridade
- [x] Documentação completa do warmup criada

**Phase 1** — Estrutura Nova
- [x] 34 diretórios criados em `/Users/diego/dev/ruptur-cloud/ruptur-main/saas/`
- [x] Módulos isolados (tenants, users, onboarding, billing, whatsapp, inbox, crm, campaigns, warmup-core, health)
- [x] Integrations folders (bubble, uazapi, stripe)
- [x] Shared utilities (config, types, constants, utils)
- [x] Docs structure (extraction, architecture, integrations)

**Phase 2** — Arquivos Não-Críticos
- [x] package.json adaptado
- [x] .env.example copiado
- [x] Dockerfile adaptado para novo path
- [x] docker-compose.yml copiado
- [x] ecosystem-branding.json → shared/config/
- [x] scripts/jarvis/ copiado intacto
- [x] Frontend assets copiados (dist/, manager-dist/, dashboard-dist/)
- [x] warmup-state.json copiado
- [x] Documentation files criados

---

## 🔜 PRÓXIMAS FASES

### Phase 3 — Integration Isolation

**Objetivo**: Criar wrappers de integração sem alterar comportamento

1. **UAZAPI Wrapper**
   - `/integrations/uazapi/client.js` — HTTP client
   - `/integrations/uazapi/polling.js` — Instance polling
   - `/integrations/uazapi/webhook-handlers.js` — Webhook processing

2. **Supabase Wrapper**
   - `/integrations/supabase/client.js` — Auth + connect
   - `/integrations/supabase/operations.js` — CRUD operations

3. **Stripe Wrapper**
   - `/integrations/stripe/checkout.js` — Checkout flows
   - `/integrations/stripe/subscriptions.js` — Subscription mgmt
   - `/integrations/stripe/webhooks.js` — Event handling

4. **Bubble Wrapper**
   - `/integrations/bubble/inbox.js` — Inbox mapping
   - `/integrations/bubble/auth.js` — Auth bridges

### Phase 4 — Deep Warmup Analysis

**Objetivo**: Extrair constants, mapear dependências, criar safeguards

1. Extrair todas WARMUP_* constants → `shared/constants/warmup.js`
2. Mapear scheduler logic → `modules/warmup-core/scheduler.js` (copy, not move)
3. Mapear pool management → `modules/warmup-core/pool.js`
4. Documentar todas regras
5. Criar health checks
6. Criar testes read-only

---

## 📍 LOCALIZAÇÃO DOS ARQUIVOS

**Novo Repositório Base**:
```
/Users/diego/dev/ruptur-cloud/ruptur-main/saas/
```

**Documentação Criada**:
```
/Users/diego/dev/ruptur-cloud/ruptur-main/saas/docs/extraction/
  ├── LEGACY-INVENTORY.md      (este relatório — ver acima)
  ├── WARMUP-DOSSIER.md        (forense detalhada do warmup)
  ├── MIGRATION-PLAN.md        (plano faseado 0-4)
  └── DISCOVERY-REPORT.md      (este arquivo)
```

**Legado Original**:
```
/Users/diego/dev/tiatendeai/ruptur/saas/
```

---

## 🔐 CREDENCIAIS EXPOSTAS (Action Required)

**Arquivos com Credenciais**:
- `.env` (NÃO copiado automaticamente)
- `manager-dist/` (Supabase key hardcoded em JS)
- `runtime-data/warmup-state.json` (UAZAPI token stored)

**Ação Recomendada**:
1. Copiar `.env` manualmente
2. Rotacionar todos os tokens (OPENAI_API_KEY, SUPABASE_KEY, UAZAPI_ADMIN_TOKEN)
3. Usar env vars para Supabase key em JS (build time injection)
4. Adicionar authentication aos endpoints `/warmup/api/local/*`

---

## 📚 REFERÊNCIAS

- Arquivo god-file original: `/Users/diego/dev/tiatendeai/ruptur/saas/runtime/server.mjs` (2611 linhas)
- Estado persistido: `/Users/diego/dev/tiatendeai/ruptur/saas/runtime-data/warmup-state.json`
- Novo repo estrutura: `/Users/diego/dev/ruptur-cloud/ruptur-main/saas/`
- Documentação forense: `/Users/diego/dev/ruptur-cloud/ruptur-main/saas/docs/extraction/`

---

**Gerado**: 2026-04-19  
**Para integração em**: State system + Obsidian knowledge base  
**Próxima revisão**: Após Phase 3
