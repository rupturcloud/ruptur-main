# 🚀 PHASE 1 — AÇÃO IMEDIATA

**Data**: 2026-05-08  
**Status**: 🔴 **COMEÇANDO AGORA**  
**Instância a Usar**: 553173663601 (Atendimento Eficaz)

---

## 🎯 INSTÂNCIA CONFIRMADA

```
Server URL:      https://tiatendeai.uazapi.com
Instance Token:  5896f4fa-c7f2-4511-9a0a-05698d64c746
Número:          553173663601
Status:          connected ✅
```

---

## 📋 TASKS IMEDIATAS (Saltando 1.1-1.2, já estão feitas)

### ✅ TASK 1.1-1.2 — PULADAS (instância já conectada)
- Instância já está online: `connected`
- Número já vinculado: `553173663601`
- Pronto para receber webhooks

### 🔴 TASK 1.3 — CONFIGURAR WEBHOOK GLOBAL UAZAPI

**Responsável**: Diego (manual no dashboard) ou Agent (via API se existir)

**Passos**:
1. Acessar: https://tiatendeai.uazapi.com (login)
2. Navegar para: **Settings → Webhooks → Webhook Global** (ou similar)
3. Adicionar webhook com:
   - **URL**: `https://app.ruptur.cloud/api/bubble/validate`
   - **Método**: POST
   - **Eventos a ativar**:
     - ✅ `message.received` — Nova mensagem
     - ✅ `message.sent` — Mensagem enviada
     - ✅ `instance.connected` — Instância conectou
     - ✅ `instance.disconnected` — Instância desconectou
     - ✅ `presence.changed` — Status online/offline
   - **Headers**: Nenhum especial (UAZAPI vai detectar)

4. Salvar e confirmar webhook está ativo

**Resultado Esperado**: Webhook registrado em UAZAPI, pronto para enviar eventos

---

### 🟡 TASK 1.4 — TESTAR RECEBIMENTO WEBHOOK

**Responsável**: Agent (validar logs) + Diego (enviar msg WhatsApp)

**Checklist**:
1. [ ] SSH na VPS: `ssh root@ruptur.cloud`
2. [ ] Ativar monitoramento de logs:
   ```bash
   cd /opt/ruptur/saas
   docker-compose logs -f saas-web | grep -i "bubble\|validate\|webhook"
   ```
3. [ ] Diego envia mensagem WhatsApp para `553173663601` (do seu celular)
4. [ ] Verificar logs:
   - Deve aparecer linha com `POST /api/bubble/validate`
   - Status deve ser `200 OK`
   - Payload deve estar no log
5. [ ] Capturar exemplo de payload (próximo task)

**Resultado Esperado**: Logs mostram webhook recebido com sucesso

---

### 💾 TASK 1.5 — DOCUMENTAR PAYLOAD WEBHOOK

**Responsável**: Agent (extrair do log)

**Checklist**:
1. [ ] Extrair payload do log de webhook (message.received)
2. [ ] Salvar em `/docs/WEBHOOK_PAYLOAD_UAZAPI.md`
3. [ ] Validar campos principais:
   - `event` — tipo de evento
   - `instance_id` — ID da instância (deve ser `5896f4fa-c7f2-4511-9a0a-05698d64c746`)
   - `data.sender` — quem enviou
   - `data.message` ou `data.text` — conteúdo
   - `data.timestamp` — horário

**Exemplo Esperado**:
```json
{
  "event": "message.received",
  "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746",
  "data": {
    "id": "msg_123456",
    "sender": "55119999999",
    "message": "Oi, tudo bem?",
    "timestamp": "2026-05-08T14:35:00Z",
    "type": "text"
  }
}
```

**Resultado Esperado**: Documento `/docs/WEBHOOK_PAYLOAD_UAZAPI.md` criado

---

### 🚀 TASK 1.6 — DEPLOY EM PRODUÇÃO

**Responsável**: Diego (SSH)

**Checklist**:
1. [ ] SSH na VPS: `ssh root@ruptur.cloud`
2. [ ] Executar:
   ```bash
   cd /opt/ruptur/saas
   docker-compose pull
   docker-compose up -d
   sleep 30
   docker-compose logs saas-web | head -20
   ```
3. [ ] Verificar health:
   ```bash
   curl -s https://app.ruptur.cloud/api/local/health | jq .
   ```
   Esperado: `{"ok": true, "service": "ruptur-saas-gateway", ...}`

**Resultado Esperado**: Container atualizado e rodando

---

### ✅ TASK 1.7 — TESTE E2E COMPLETO

**Responsável**: Diego (UI) + Agent (validação)

**Checklist**:
1. [ ] Diego acessa: https://app.ruptur.cloud
2. [ ] Faz login com sua conta
3. [ ] Navega para: `/inbox`
4. [ ] Aguarda carregamento (spinner "Carregando Inbox Omnichannel")
5. [ ] Verifica que iframe Bubble carregou (deve mostrar conversas)
6. [ ] Envia mensagem WhatsApp para `553173663601` (do celular)
7. [ ] Aguarda 5s para webhook processar
8. [ ] Verifica que mensagem aparece em Ruptur (Bubble inbox)

**Esperado**: 
- ✅ Inbox carrega sem erros
- ✅ Mensagem WhatsApp recebida aparece em tempo real
- ✅ Status conectado (badge verde ou similar)

**Resultado Esperado**: Phase 1 completo! 🎉

---

## 📊 TIMELINE

| # | Task | Tempo | Owner | Status |
|---|------|-------|-------|--------|
| 1.1-1.2 | Instância já conectada | ✅ | - | PULADO |
| 1.3 | Webhook Global | 20min | Diego | 🔴 FAZER AGORA |
| 1.4 | Teste Webhook | 20min | Agent+Diego | ⏳ Depois de 1.3 |
| 1.5 | Documentar Payload | 15min | Agent | ⏳ Depois de 1.4 |
| 1.6 | Deploy | 10min | Diego | ⏳ Depois de 1.5 |
| 1.7 | E2E | 10min | Diego+Agent | ⏳ Final |
| **TOTAL** | | **~75min** | | 🔴 **COMEÇAR** |

---

## 🎯 ORDEM DE EXECUÇÃO

```
1. Diego → Configure webhook global UAZAPI (20min)
   ↓
2. Agent → Ativar logs, capturar webhook (20min)
   ↓
3. Diego → Enviar msg WhatsApp (5min)
   ↓
4. Agent → Documentar payload (15min)
   ↓
5. Diego → Deploy docker-compose (10min)
   ↓
6. Diego → Teste E2E em Ruptur (10min)
   ↓
7. ✅ PHASE 1 COMPLETO
```

---

## 🚨 BLOQUEADORES

- 🟢 Nenhum — Instância conectada, infraestrutura pronta

---

## 📞 PRÓXIMO PASSO

**Ação 1 (Diego)**: Configure webhook global UAZAPI apontando para:
```
https://app.ruptur.cloud/api/bubble/validate
```

Assim que configurado → Agent monitora logs → teste webhook

**Então podemos começar Phase 2** (Data Types + 13 workflows Bubble)

---

**COMEÇANDO AGORA! ⚡**

Status: 🔴 **AGUARDANDO WEBHOOK CONFIGURADO**
