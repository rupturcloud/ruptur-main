# WARMUP DOSSIER — FORENSE COMPLETA

## 1. MAPA DE FUNÇÕES CRÍTICAS

### State Management
```
loadState()               — Carregar estado de JSON
saveState()              — Persister estado em JSON
createDefaultState()     — Criar estado vazio
jsonClone()              — Clone seguro de objetos
```

### Configuration & Settings
```
getDefaultSettings()     — Settings padrão
normalizeSettings()      — Normalizar config entrada
mergeRuntimeSettings()   — Mesclar configs
hasRuntimeCredentialChange() — Detectar mudança token
```

### Instance Management
```
createDefaultInstanceState()  — Novo estado de instância
extractResolvedNumber()       — Parse de número WhatsApp
updateInstanceDna()          — Atualizar histórico da instância
```

### Scheduler & Timing
```
getReachableMinIntervalMs()   — Calcular intervalo mínimo
getNextLocalDayStart()        — Próximo dia local
buildNextEligibleAt()         — Próxima elegibilidade
isSameDay()                   — Comparar datas
rebaseActivityWindow()        — Resetar janela de atividade
getCooldownRemaining()        — Cadência restante
```

### Health & Eligibility
```
calculateHealthScore()        — Score de saúde da instância
isRegeneratingCandidate()     — Candidata para regeneração
buildNextRegenerationAt()     — Próxima regeneração
markInstanceSent()            — Marca envio realizado
markInstanceRegeneration()    — Marca regeneração
```

### Routines & Messages
```
buildDefaultRoutine()         — Rotina padrão 24/7
refreshProtectedRoutines()    — Atualizar rotinas protegidas
reconcileProtectedRoutines()  — Reconciliar com DB
ensureDefaultRoutine()        — Garantir rotina padrão
bootstrapProtectedRoutine()   — Criar rotina na inicialização
pickRoutineMessage()          — Selecionar mensagem de rotina
normalizeActivityLabel()      — Normalizar label mensagem
```

### Pool & Dispatch Logic
```
createEmptyPoolState()        — Pool vazio
createTrackId()               — Gerar ID de tracking
shuffle()                     — Embaralhar lista
```

### Audit & Logging
```
addRuntimeLog()              — Adicionar log operacional
addAuditEntry()              — Adicionar entrada auditoria
```

---

## 2. ENDPOINTS HTTP EXPOSTOS

### Warmup API Local
```
GET  /warmup/api/local/warmup/state
     → Retorna estado completo (config, scheduler, summary, etc)
     
POST /warmup/api/local/warmup/settings
     → Atualizar settings (serverUrl, token, defaults)
     
POST /warmup/api/local/warmup/routines
     → CRUD routines
     
POST /warmup/api/local/warmup/messages
     → CRUD messages
     
POST /warmup/api/local/warmup/control
     → Controles de scheduler (start/stop/pause)
     
POST /warmup/api/local/warmup/clear-token
     → Limpar admin token
```

### Frontend Routes
```
GET  /
     → Serve saas/dist/index.html (Front Lindona)
     
GET  /warmup/
     → Serve saas/manager-dist/ (Warmup Manager)
     
GET  /warmup/instances
     → Manager page para instâncias
     
GET  /warmup/telemetry
     → Manager page para telemetria
```

---

## 3. INTEGRAÇÃO UAZAPI

### Operações
```
POLL /instance/all
     → Listar instâncias conectadas (cada 60s ou on-demand)
     
Headers: admintoken: {WARMUP_ADMIN_TOKEN}
```

### Dados Consumidos
```
instance.jid                 — Identificador WhatsApp
instance.profileName         — Nome do perfil
instance.webhookUrl          — URL webhook (se houver)
instance.integration         — Tipo integração
instance.status              → healthyTokens, readyTokens
```

### Ações Disparadas
```
Se instância healthy:
  → Elegível para warmup
  → Entra no persistent pool
  
Se instância ready:
  → Pode receber mensagens
  → Entra na fila de despacho
```

---

## 4. REGRAS DE WARMUP (CRÍTICAS)

### Cadência
```
warmupMinIntervalMs:  345600 ms (4 dias default)
warmupMaxDailyPerInstance: 250 mensagens/dia
warmupCooldownRounds: 1 (cooldown após envio)
antiBanMaxPerMinute: 12 (rate limit)
```

### Eleigibilidade
```
Uma instância é elegível se:
  ✅ Conectada à UAZAPI
  ✅ Passou cooldown
  ✅ Não atingiu max daily
  ✅ Passou saúde check
  ✅ Fora de janela bloqueio
```

### Seleção de Destinatário
```
1. Listar instâncias elegíveis
2. Shuffle (embaralhar)
3. Pegar primeira que:
   - Não foi sender recentemente
   - Tem pool saudável
   - Está na mesma rotina
```

### Despacho
```
1. Selecionar sender + receiver
2. Pegar mensagem da rotina
3. Enviar via UAZAPI webhook
4. Registrar em currentPool
5. Marcar no instanceStates
6. Logar e auditar
```

---

## 5. ESTADO PERSISTIDO

### warmup-state.json Schema

```json
{
  "config": {
    "settings": {
      "serverUrl": "https://tiatendeai.uazapi.com",
      "adminToken": "...",
      "supabaseUrl": "...",
      "supabaseKey": "...",
      "defaultDelay": 3000,
      "warmupMinIntervalMs": 345600,
      "warmupMaxDailyPerInstance": 250,
      "warmupCooldownRounds": 1,
      "warmupReadChat": false,
      "warmupReadMessages": false,
      "warmupAsync": true,
      "antiBanMaxPerMinute": 12,
      "operatorLabel": "Operador local @127.0.0.1",
      "riskOverride": null
    },
    "routines": [
      {
        "id": "warmup-default-24x7",
        "mode": "one-to-one",
        "name": "Warmup 24/7 Padrão",
        "delayMax": 20,
        "delayMin": 8,
        "isActive": true,
        "messages": [],
        "createdAt": "...",
        "totalSent": 0,
        "senderInstances": [],
        "receiverInstances": []
      }
    ],
    "messages": [
      { "id": "1", "name": "...", "text": "...", "category": "..." }
    ]
  },
  "scheduler": {
    "enabled": false,
    "status": "stopped",
    "round": 0,
    "lastManualAction": { "action": "stop", "actor": "...", "reason": "...", "acceptedAt": "..." },
    "lastError": "..."
  },
  "summary": {
    "totalInstances": 0,
    "connected": 0,
    "eligible": 0,
    "heatingNow": 0,
    "regenerating": 0,
    "queuedEntries": 0,
    "cadenceBpm": 0,
    "isPulsing": false
  },
  "currentPool": {
    "persistent": {
      "updatedAt": "...",
      "healthyTokens": [],
      "readyTokens": []
    }
  },
  "instanceStates": {
    "token1": {
      "eligibilityReason": "...",
      "lastSentAt": "...",
      "cooldownUntil": "...",
      "sentToday": 0,
      "nextEligibleAt": "...",
      ...
    }
  },
  "logs": [],
  "auditTrail": []
}
```

---

## 6. TIMER E SCHEDULER

### Main Loop
```
TICK_INTERVAL_MS = 60000 (60 segundos)

Cada tick:
  1. loadState()
  2. Se scheduler.enabled:
     - fetchInstancesFromUAZAPI()
     - updateInstances()
     - runWarmupRound()
     - markInstancesSent()
  3. saveState()
```

### Run Warmup Round
```
Para cada instância elegível (até MAX_QUEUE_EXECUTIONS_PER_TICK = 6):
  1. Selecionar sender + receiver
  2. Pegar mensagem
  3. Despachar
  4. Registrar resultado
  5. Atualizar instanceStates
```

### Regeneration Loop
```
REGENERATION_RECEIVE_INTERVAL_MS = 2 * 60 * 60 * 1000 (2 horas)

Cada intervalo:
  - Listar instâncias regenerando
  - Atualizar nextRegenerationAt
  - Marcar como regenerating
```

---

## 7. DEPENDÊNCIAS EXTERNAS

### UAZAPI
```
Endpoint: settings.serverUrl (default: https://tiatendeai.uazapi.com)
Auth: adminToken via header
Operações:
  - GET /instance/all (listar instâncias)
  - POST /send (enviar mensagem via webhook)
```

### Supabase
```
URL: settings.supabaseUrl
Key: settings.supabaseKey
Operações:
  - OBSERVADO: Leitura de routines (se houver seleção de rotina)
  - Potencial: Escrita de logs/auditoria
```

### Local File System
```
STATE_FILE: saas/runtime-data/warmup-state.json
DNA_DIR: saas/runtime-data/instance-dna/
Writes: Estado persistido a cada tick (CRÍTICO)
```

---

## 8. COMPORTAMENTO CRÍTICO — NÃO MEXER

### Proteções Integradas
```
✅ Protected Routines (warmup-default-24x7)
   - Não pode ser apagada
   - Sempre criada na init
   - Reconcilia com DB

✅ Cooldown System
   - Cadência mínima respeitada
   - Bloqueio anti-ban

✅ Pool Management
   - Healthy vs Ready tokens
   - Persistent state por instância
   - Health scores calculados

✅ Audit Trail
   - Todas operações logadas
   - Manual actions rastreadas
   - Timestamps precisos
```

### O que Entrou em Produção
```
- Sistema de cadência (MIN_INTERVAL, MAX_DAILY)
- Seleção aleatória de sender/receiver
- Regras de elegibilidade
- Persistent pool com health scores
- Refresh de rotinas protegidas
- Cooldown após envio
- Regeneration tracking
- Audit trail completo
```

### Comportamento Observado (KVM2 Prod)
```
- Warmup 24/7 executa a cada 60s
- Até 6 instâncias por tick
- 44 instâncias total (última count)
- 29 conectadas quando testado
- Zero erros de corrupção estado (até agora)
- Audit trail rastreando tudo
```

---

## 9. MAPA DE ENCAIXE NO NOVO REPO

### Estrutura Proposta
```
saas/
├── modules/
│   └── warmup-core/
│       ├── server.mjs (ORIGINAL — sem mudanças)
│       ├── constants.js (extracted WARMUP_* constants)
│       ├── scheduler.js (extracted scheduler logic)
│       ├── pool.js (extracted pool management)
│       ├── state.js (extracted state load/save)
│       ├── uazapi.js (extracted UAZAPI client)
│       ├── routines.js (extracted routine logic)
│       └── rules.js (extracted eligibility rules)
│       
├── integrations/
│   ├── uazapi/
│   │   ├── client.js
│   │   ├── polling.js
│   │   └── webhook-handlers.js
│   │
│   ├── supabase/
│   │   ├── client.js
│   │   └── operations.js
│   │
│   └── bubble/
│       └── (future integration)
│
└── runtime-data/
    ├── warmup-state.json
    └── instance-dna/
```

### Próximos Passos (Não fazer AGORA)
```
1. Criar arquivo de constants com all WARMUP_* valores
2. Extrair scheduler logic (não mover, copiar com refs)
3. Extrair pool logic
4. Criar facade para UAZAPI (sem mudar behavior)
5. Criar facade para Supabase (sem mudar behavior)
6. Adicionar testes (read-only primeiro)
7. Documentar regras
8. Criar health check
```

---

## 10. RISCOS CRÍTICOS

🔴 **PROIBIDO:**
- Reescrever scheduler (comportamento está em produção)
- Alterar cadência (MIN_INTERVAL, MAX_DAILY)
- Mudar algoritmo de seleção (shuffle order importa)
- Remover protected routines logic
- Mexer em state persistence sem lock/transaction
- Alterar timestamp precision
- Remover audit trail

🟡 **CUIDADO:**
- UAZAPI endpoint pode mudar (wrapper necessário)
- Estado JSON cresce (monitorar size)
- Race conditions em estado JSON (usar file lock quando refatorar)
- Cooldown está em ms (client e server devem estar sincronizados)

🟢 **SEGURO:**
- Mover arquivo de config
- Extrair constants
- Adicionar logging adicional
- Adicionar health checks
- Criar testes read-only
- Documentar

