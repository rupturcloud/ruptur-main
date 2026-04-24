# LEGACY INVENTORY — dev/tiatetendeai/ruptur/saas

## ESTRUTURA ATUAL

```
saas/
├── runtime/
│   ├── server.mjs (2611L — god-file)
│   │   ├── HTTP server (port 8787)
│   │   ├── Warmup scheduler + state mgmt
│   │   ├── UAZAPI client
│   │   ├── Supabase integration
│   │   └── Audit/logging
│   └── jarvis/
│       └── resolve-activation.mjs (Jarvis activation logic)
│
├── shared/
│   └── ecosystem-branding.json (hardcoded branding)
│
├── scripts/
│   └── jarvis/resolve-activation.mjs
│
├── runtime-data/
│   └── warmup-state.json (persistent state)
│
├── dist/ (Front Lindona static)
├── manager-dist/ (Warmup Manager static)
├── dashboard-dist/ (Legacy SafeFlow static)
│
├── package.json (4 scripts)
├── .env (prod config)
├── Dockerfile (Node 20 slim)
├── docker-compose.yml (Traefik labels)
└── README.md
```

## INVENTÁRIO POR ITEM

### 1. runtime/server.mjs (85.8K)

**Status**: Core monolítico
**Domínios inclusos**:
- HTTP router (serving dist/, manager-dist/, API locals)
- Warmup scheduler (tick 60s)
- State persistence (JSON file)
- UAZAPI client (polling instances)
- Supabase client (read/write state)
- Audit trail
- Logging

**Ação**: 🔒 CONGELAR — análise forense primeiro
**Destino**: saas/modules/warmup-core/ (com documentação)
**Risco**: Alto — múltiplas responsabilidades acopladas

---

### 2. runtime-data/warmup-state.json (4.3K)

**Status**: Persistent state (JSON file)
**Schema**:
- config.settings (servidor, token, defaults)
- config.routines (warmup rotinas)
- config.messages (templates)
- scheduler (enabled, status, round, lastManualAction)
- summary (KPIs)
- currentPool (persistent pool)
- instanceStates (per-instance state)
- logs (audit trail)

**Ação**: 🔄 ADAPTAR — migrar para DB quando pronto
**Destino**: saas/runtime-data/ (manter estrutura)
**Risco**: Médio — sem transações, sem lock

---

### 3. dist/ (Front Lindona)

**Status**: Static HTML (7.1K index.html)
**Conteúdo**:
- Tech-dark design (dark mode, laranja gradiente)
- 2 cards: Diagnóstico IA + System Status
- Botão para Warmup Manager

**Ação**: ✅ MOVER — sem alteração
**Destino**: saas/web/dist/
**Risco**: Baixo

---

### 4. manager-dist/ (Warmup Manager)

**Status**: React static build (Vite)
**Conteúdo**:
- 12+ páginas (dashboard, instâncias, telemetria, etc)
- Supabase integration (hardcoded keys)
- UAZAPI integration

**Ação**: ✅ MOVER com cautela
**Destino**: saas/web/manager-dist/
**Risco**: Médio — hardcoded env vars em JS

---

### 5. dashboard-dist/ (Legacy SafeFlow)

**Status**: Antigo, em transição
**Ação**: ❄️ CONGELAR — manter para backwards compat
**Destino**: saas/web/dashboard-dist/ (archive)
**Risco**: Baixo

---

### 6. package.json

**Status**: Minimal (4 scripts)
**Scripts**:
- start: node runtime/server.mjs
- runtime: node runtime/server.mjs
- jarvis:ativar: node scripts/jarvis/resolve-activation.mjs
- jarvis:ativar:json: node scripts/jarvis/resolve-activation.mjs --json

**Ação**: ✅ ADAPTAR — adicionar novos scripts conforme necessário
**Destino**: saas/package.json
**Risco**: Baixo

---

### 7. .env / Dockerfile / docker-compose.yml

**Status**: Infraestrutura
**Ação**: ✅ MOVER com adaptação de portas/paths
**Destino**: saas/.env, saas/Dockerfile, saas/docker-compose.yml
**Risco**: Médio — credenciais expostas

---

### 8. shared/ecosystem-branding.json

**Status**: Config hardcoded
**Conteúdo**: Branding colors, strings, URLs
**Ação**: ✅ MOVER para saas/shared/config/
**Risco**: Baixo

---

### 9. scripts/jarvis/resolve-activation.mjs

**Status**: Jarvis local activation
**Ação**: ✅ MOVER para saas/scripts/jarvis/
**Risco**: Baixo

---

## CLASSIFICAÇÃO RESUMIDA

| Item | Classificação | Destino | Risco | Prioridade |
|------|---------------|---------|-------|-----------|
| runtime/server.mjs | 🔒 CONGELAR | saas/modules/warmup-core/ | Alto | P0 |
| warmup-state.json | 🔄 ADAPTAR | saas/runtime-data/ | Médio | P0 |
| dist/ | ✅ MOVER | saas/web/dist/ | Baixo | P1 |
| manager-dist/ | ✅ MOVER | saas/web/manager-dist/ | Médio | P1 |
| dashboard-dist/ | ❄️ CONGELAR | saas/web/dashboard-dist/ | Baixo | P3 |
| package.json | ✅ ADAPTAR | saas/package.json | Baixo | P2 |
| .env/.env.example | ✅ ADAPTAR | saas/.env | Alto | P0 |
| Dockerfile | ✅ ADAPTAR | saas/Dockerfile | Baixo | P2 |
| docker-compose.yml | ✅ ADAPTAR | saas/docker-compose.yml | Médio | P2 |
| ecosystem-branding.json | ✅ MOVER | saas/shared/config/ | Baixo | P3 |
| scripts/jarvis/ | ✅ MOVER | saas/scripts/jarvis/ | Baixo | P3 |

