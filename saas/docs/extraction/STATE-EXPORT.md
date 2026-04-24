# STATE EXPORT — Ruptur SaaS Migration Discoveries

> **Copie o conteúdo deste arquivo para seu state system e Obsidian**

---

## 🎯 Projeto Ruptur — SaaS Migration Audit

**Data**: 2026-04-19  
**Escopo**: Auditoria técnica + Forense Warmup + Planejamento migração  
**Status**: Phase 0-2 ✅ Completo | Phase 3-4 🔲 Planejadas

### Ouro Estratégico Identificado
**Sistema de Aquecimento (Warmup)**: Automatização de aquecimento WhatsApp via UAZAPI
- Operacional em produção desde [data]
- 44 instâncias totais, 29 conectadas
- Zero erros de corrupção de estado
- **PROTEGER**: Comportamento crítico — preserve antes de refatorar

---

## 🏗️ Estrutura Migração (4 Fases)

### Phase 0: Auditoria ✅
- **O quê**: Inventário legado + forense warmup
- **Resultado**: 11 items classificados, documentação completa
- **Artefatos**: LEGACY-INVENTORY.md, WARMUP-DOSSIER.md

### Phase 1: Estrutura Nova ✅
- **O quê**: Criar 34 diretórios em `/Users/diego/dev/ruptur-cloud/ruptur-main/saas/`
- **Resultado**: Estrutura pronta para migrações
- **Diretórios**: modules/, integrations/, shared/, docs/, runtime-data/, scripts/, web/

### Phase 2: Arquivos Não-Críticos ✅
- **O quê**: Copiar package.json, Dockerfile, .env.example, frontend assets, scripts
- **Resultado**: 9 arquivos + 3 diretórios movidos (4.2 MB)
- **Próximo**: Copiar manualmente `.env` com credenciais (NÃO foi automatizado)

### Phase 3: Integration Isolation 🔲
- **O quê**: Criar wrappers de UAZAPI, Supabase, Stripe, Bubble
- **Destino**: `/integrations/{service}/`
- **Objetivo**: Desacoplar integrações sem alterar comportamento

### Phase 4: Deep Warmup Analysis 🔲
- **O quê**: Extrair constants, documentar regras, criar health checks
- **Destino**: `/modules/warmup-core/` + constants
- **Objetivo**: Preparar para refatoração segura (read-only first)

---

## 🔍 Sistema de Aquecimento — Dados Técnicos

### Configuração
```
Ciclo: 60 segundos (TICK_INTERVAL_MS = 60000)
Capacidade: 6 instâncias por ciclo (MAX_QUEUE_EXECUTIONS_PER_TICK)
Cadência: Mínimo 345600 ms = 4 dias entre mensagens mesma instância
Limite Diário: 250 mensagens por instância
Taxa Anti-Ban: 12 mensagens por minuto
```

### Estado de Produção (KVM2)
```
Total de instâncias: 44
Instâncias conectadas: 29 (última check)
Erros de corrupção: 0 (desde início)
Audit trail: Completo
```

### Integração UAZAPI
```
Endpoint: https://tiatendeai.uazapi.com
Auth: adminToken via header
Polling: Cada 60s (GET /instance/all)
Despacho: POST /send com webhookUrl
```

### Proteções Integradas
- ✅ Rotina `warmup-default-24x7` (imutável)
- ✅ Sistema de cooldown pós-envio
- ✅ Health scores por instância
- ✅ Pool management (healthy vs ready)
- ✅ Audit trail completo

### Regras Críticas (PROIBIDO mexer)
```
❌ Reescrever scheduler
❌ Alterar cadência (MIN_INTERVAL, MAX_DAILY)
❌ Mudar algoritmo shuffle
❌ Remover protected routines
❌ Mexer state persistence sem lock
❌ Alterar timestamp precision
❌ Remover audit trail
```

---

## 📋 Inventário Legado — 11 Items

| # | Item | Classificação | Destino | Risco | Prioridade | Status |
|----|------|---------------|---------|-------|-----------|--------|
| 1 | runtime/server.mjs (2611L) | 🔒 CONGELAR | modules/warmup-core/ | Alto | P0 | Pendente |
| 2 | warmup-state.json | 🔄 ADAPTAR | runtime-data/ | Médio | P0 | ✅ Copiado |
| 3 | dist/ (Front Lindona) | ✅ MOVER | web/dist/ | Baixo | P1 | ✅ Copiado |
| 4 | manager-dist/ (Warmup UI) | ✅ MOVER | web/manager-dist/ | Médio | P1 | ✅ Copiado |
| 5 | dashboard-dist/ (Legacy) | ❄️ CONGELAR | web/dashboard-dist/ | Baixo | P3 | ✅ Copiado |
| 6 | package.json | ✅ ADAPTAR | saas/ | Baixo | P2 | ✅ Adaptado |
| 7 | .env/.env.example | ✅ ADAPTAR | saas/ | Alto | P0 | 🟡 .example ✅, .env manual |
| 8 | Dockerfile | ✅ ADAPTAR | saas/ | Baixo | P2 | ✅ Adaptado |
| 9 | docker-compose.yml | ✅ ADAPTAR | saas/ | Médio | P2 | ✅ Copiado |
| 10 | ecosystem-branding.json | ✅ MOVER | shared/config/ | Baixo | P3 | ✅ Copiado |
| 11 | scripts/jarvis/ | ✅ MOVER | scripts/jarvis/ | Baixo | P3 | ✅ Copiado |

---

## 🔧 Endpoints HTTP Expostos

### Warmup API Local
```
GET  /warmup/api/local/warmup/state      → Estado completo
POST /warmup/api/local/warmup/settings   → Atualizar settings
POST /warmup/api/local/warmup/routines   → CRUD routines
POST /warmup/api/local/warmup/messages   → CRUD messages
POST /warmup/api/local/warmup/control    → Start/Stop/Pause
POST /warmup/api/local/warmup/clear-token → Logout
```

⚠️ **Sem autenticação** (localhost only, presumido seguro)

### Frontend
```
GET  /                  → dist/index.html (Front Lindona)
GET  /warmup/           → manager-dist/index.html (Warmup Manager)
GET  /warmup/instances  → Manager dashboard
GET  /warmup/telemetry  → Telemetria
```

---

## 🚀 Mapa de Funções Críticas (40+)

### State Management
- `loadState()` — Carregar JSON
- `saveState()` — Persister JSON
- `jsonClone()` — Clone seguro

### Scheduler & Timing
- `getReachableMinIntervalMs()` — Calcular intervalo
- `getNextLocalDayStart()` — Próximo dia local
- `buildNextEligibleAt()` — Próxima elegibilidade
- `getCooldownRemaining()` — Cadência restante
- `rebaseActivityWindow()` — Resetar janela

### Health & Eligibility
- `calculateHealthScore()` — Score saúde
- `isRegeneratingCandidate()` — Candidata regeneração
- `buildNextRegenerationAt()` — Próxima regeneração
- `markInstanceSent()` — Registrar envio

### Routines & Messages
- `buildDefaultRoutine()` — Rotina padrão 24/7
- `refreshProtectedRoutines()` — Atualizar routines protegidas
- `pickRoutineMessage()` — Selecionar mensagem
- `normalizeActivityLabel()` — Normalizar label

### Dispatch
- `runWarmupRound()` — Executar round (até 6 instâncias)
- `fetchAllInstances()` — Poll UAZAPI
- `updateInstances()` — Atualizar pool
- `createTrackId()` — Gerar ID tracking
- `shuffle()` — Embaralhar (random sender/receiver)

### Instance Management
- `createDefaultInstanceState()` — Novo estado
- `extractResolvedNumber()` — Parse WhatsApp number
- `updateInstanceDna()` — Histórico da instância

### Audit & Logging
- `addRuntimeLog()` — Log operacional
- `addAuditEntry()` — Entrada auditoria

---

## 📊 Schema warmup-state.json

```json
{
  "config": {
    "settings": {
      "serverUrl": "https://tiatendeai.uazapi.com",
      "adminToken": "***",
      "supabaseUrl": "***",
      "supabaseKey": "***",
      "warmupMinIntervalMs": 345600,
      "warmupMaxDailyPerInstance": 250,
      "warmupCooldownRounds": 1,
      "antiBanMaxPerMinute": 12,
      "operatorLabel": "Operador local @127.0.0.1"
    },
    "routines": [
      {
        "id": "warmup-default-24x7",
        "mode": "one-to-one",
        "name": "Warmup 24/7 Padrão",
        "isActive": true,
        "messages": [],
        "totalSent": 0
      }
    ],
    "messages": [...]
  },
  "scheduler": {
    "enabled": false,
    "status": "stopped",
    "round": 0,
    "lastManualAction": {...}
  },
  "summary": {
    "totalInstances": 0,
    "connected": 0,
    "eligible": 0,
    "queuedEntries": 0,
    "cadenceBpm": 0
  },
  "currentPool": {
    "persistent": {
      "healthyTokens": [],
      "readyTokens": []
    }
  },
  "instanceStates": {...},
  "logs": [],
  "auditTrail": []
}
```

---

## 🔐 Segurança — Ações Recomendadas

### ❌ Credenciais Expostas
- `.env` — Tokens de produção (NÃO copiado automaticamente)
- `manager-dist/` — Supabase key hardcoded em JS
- `warmup-state.json` — UAZAPI token stored

### ✅ Ações Necessárias
1. **Copiar `.env` manualmente** com credenciais reais
2. **Rotacionar todos tokens**: OPENAI_API_KEY, SUPABASE_KEY, UAZAPI_ADMIN_TOKEN
3. **Build-time injection** para Supabase key em JS (não hardcode)
4. **Autenticação** para endpoints `/warmup/api/local/*`

---

## 📁 Localização dos Arquivos

```
Novo Repositório:
  /Users/diego/dev/ruptur-cloud/ruptur-main/saas/

Documentação:
  /Users/diego/dev/ruptur-cloud/ruptur-main/saas/docs/extraction/
    ├── INDEX.md                  ← COMECE AQUI
    ├── DISCOVERY-REPORT.md       ← CONSOLIDADO
    ├── WARMUP-DOSSIER.md         ← DETALHES TÉCNICOS
    ├── LEGACY-INVENTORY.md       ← CLASSIFICAÇÃO
    ├── MIGRATION-PLAN.md         ← PLANO
    └── STATE-EXPORT.md           ← ESTE ARQUIVO

Legado Original:
  /Users/diego/dev/tiatendeai/ruptur/saas/
```

---

## 🔜 Próximas Fases — Ações

### Phase 3 (Integration Isolation)
1. Criar `/integrations/uazapi/` com client, polling, webhooks
2. Criar `/integrations/supabase/` com client, operations
3. Criar `/integrations/stripe/` com checkout, subscriptions, webhooks
4. Criar `/integrations/bubble/` com inbox, auth
5. Manter `server.mjs` INTACTO (somente referencias atualizadas)

### Phase 4 (Deep Warmup Analysis)
1. Extrair WARMUP_* constants → `/shared/constants/warmup.js`
2. Copiar (não mover) scheduler logic → `/modules/warmup-core/scheduler.js`
3. Copiar pool management → `/modules/warmup-core/pool.js`
4. Documentar todas regras + safeguards
5. Criar health checks
6. Criar testes read-only

---

## 📈 Estatísticas da Migração

| Métrica | Valor |
|---------|-------|
| Items Legados Inventariados | 11 |
| Diretórios Criados | 34 |
| Arquivos Movidos (Phase 2) | 9+ |
| Documentos Gerados | 5 |
| Linhas Warmup Code | 2.611 |
| Linhas Documentação | 1.200+ |
| Frontend Assets | 4.2 MB |
| Estado Warmup | 4.3 KB |

---

## ✅ Checklist de Integração ao State

Após ler este arquivo, integre ao seu sistema:

- [ ] Adicione "Ruptur SaaS Migration" ao seu knowledge base
- [ ] Crie pasta "ruptur/saas-migration/" no Obsidian
- [ ] Copie DISCOVERY-REPORT.md como página principal
- [ ] Link para WARMUP-DOSSIER.md como referência técnica
- [ ] Crie mapa visual de 4 fases de migração
- [ ] Registre localização dos arquivos no seu inventory
- [ ] Adicione tags: #ruptur #migration #warmup #phase-2-complete
- [ ] Schedule revisão para Phase 3 (após 1-2 semanas)

---

## 🔗 Referências Rápidas

**Warmup Crítico**:
- Ciclo: 60s
- Instâncias/ciclo: 6
- Cadência min: 4 dias
- Limite diário: 250 msgs
- Instâncias ativas: 29/44
- Status: Saudável ✅

**Arquitetura**:
- God-file: `server.mjs` (2.611 linhas)
- State: JSON sem transações
- Integrações: UAZAPI, Supabase, Stripe, Bubble
- Frontend: React 19, Next.js 16

**Riscos**:
- Race conditions (state JSON)
- Credenciais expostas
- Env vars hardcoded em JS
- Endpoints sem auth

---

**Gerado**: 2026-04-19  
**Versão**: Discovery Report v1.0  
**Para**: State System + Obsidian Knowledge Base
