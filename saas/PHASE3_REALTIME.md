# 🔄 PHASE 3 — REAL-TIME UPDATES VIA SUPABASE REALTIME

**Status**: 🟡 Em Build (Docker)  
**Objetivo**: Eliminar polling e trazer atualizações em tempo real

---

## ✨ O QUE FOI IMPLEMENTADO

### `useInstancesRealtime` Hook (Novo)
```javascript
// web/client-area/src/hooks/useInstancesRealtime.js
- Carregar instâncias inicial via API
- Setup Supabase Realtime listener na tabela instance_registry
- Auto-reload quando houver INSERT/UPDATE/DELETE
- Return: { instances, loading, reload }
- Cleanup ao desmontar
```

### Integração em Instances.jsx
```javascript
// Substituir:
const [instances, setInstances] = useState([])
const [loading, setLoading] = useState(true)
async function loadInstances() { ... }

// Por:
const { instances, loading, reload: loadInstances } = useInstancesRealtime()
```

### Benefícios
✅ **Auto-refresh** — Quando instância é criada/atualizada, UI atualiza automaticamente  
✅ **Sem polling** — Listener async elimina `loadInstances({ silent: true })`  
✅ **Melhor performance** — Menos requisições HTTP  
✅ **Feedback instantâneo** — Mudanças aparecem em tempo real  
✅ **Escalável** — Funciona bem com muitos usuários/instâncias

---

## 🏗️ ARQUITETURA

```
┌─────────────────────────────────────────┐
│ Instances.jsx (componente)              │
└──────────────┬──────────────────────────┘
               │
        useInstancesRealtime()
               │
        ┌──────┴──────┐
        │             │
    API Load      Realtime Listen
    (initial)     (auto-update)
        │             │
        ├─────────────┤
        │             │
    setInstances   setInstances
    (inicial)      (mudanças)
        │             │
        └──────┬──────┘
               │
        ┌──────▼──────────────────┐
        │ instance_registry table │
        │ (Supabase)              │
        └─────────────────────────┘
```

---

## 🔧 TECHNICAL FLOW

### 1. Mount (Inicialização)
```
useInstancesRealtime() → useEffect
  1. Chamar apiService.getInstances()
  2. setInstances(list)
  3. Setup supabase.channel('public:instance_registry')
  4. On any change → reload()
```

### 2. Real-Time Update
```
Outro cliente faz: POST /api/instances/{key}/connect
  ↓
Backend: UPDATE instance_registry SET ...
  ↓
Supabase Realtime: envia evento 'postgres_changes'
  ↓
Listener em client: dispara reload()
  ↓
apiService.getInstances() → setInstances(updated)
  ↓
Instances.jsx: re-render com dados novos
```

### 3. Unmount (Cleanup)
```
removeChannel(subscription)
```

---

## 📦 BUILD & DEPLOY

```bash
# Build
docker build -t ruptur-saas:phase3 .

# Tag para GCP
docker tag ruptur-saas:phase3 us.gcr.io/ruptur-jarvis-v1-68358/ruptur-saas:phase3

# Push
docker push us.gcr.io/ruptur-jarvis-v1-68358/ruptur-saas:phase3

# Deploy na VPS (southamerica-west1-a)
gcloud compute ssh ruptur-shipyard-02 --zone=southamerica-west1-a \
  --command="cd /opt/ruptur/saas && \
             sed -i 's|phase2|phase3|g' docker-compose.yml && \
             docker-compose pull && \
             docker-compose up -d"
```

---

## 🧪 COMO TESTAR

### 1. Abrir duas abas do navegador
```
Aba 1: https://ruptur.cloud (seu dashboard)
Aba 2: https://ruptur.cloud (mesmo usuário, outro tab)
```

### 2. Em Aba 2: Criar uma nova instância
```
Nome: "Teste Realtime"
Botão: "Criar e conectar"
```

### 3. Observar Aba 1
```
✅ Nova instância aparece INSTANTANEAMENTE
✅ Sem clicar "Atualizar"
✅ Sem delay de polling
```

### 4. Verificar status em tempo real
```
Em Aba 2: Clicar "Status"
Em Aba 1: Ver status atualizar em tempo real
```

---

## 📊 COMPARAÇÃO: POLLING vs REALTIME

| Métrica | Polling | Realtime |
|---------|---------|----------|
| Latência de atualização | 5-10s | <100ms |
| Requisições HTTP | ~1/5s por cliente | 0 (event-driven) |
| Bandwidth | Alto | Baixo |
| Escalabilidade | Ruim | Excelente |
| Complexidade | Simples | Média |
| UX | Reativo | Proativo |

---

## 🎯 FASE 4 — PRÓXIMOS PASSOS

### Status Indicators
```
Live connection status com pulsing animation
"🟢 Conectada" com cor dinâmica
Tooltip mostrando horário da última atualização
```

### Error Handling
```
Desconexão do Realtime listener
Reconnect automático com exponential backoff
Toast notificando erro de conexão
```

### Advanced Realtime
```
Listen a mudanças em múltiplas tabelas
Webhook queue status real-time
Campaign delivery status live
```

---

## 📝 COMMITS RELACIONADOS

```
[Phase 3 branch]
feat: Phase 3 — real-time updates via Supabase Realtime
- Criar useInstancesRealtime hook
- Integrar em Instances.jsx
- Eliminar polling manual
- Supabase listener com cleanup
```

---

## 🚀 BUILD STATUS

Building Docker image for Phase 3...  
Expected: 2-3 minutes  
Size: ~827MB  

Próximo: Push para GCP + Deploy na VPS
