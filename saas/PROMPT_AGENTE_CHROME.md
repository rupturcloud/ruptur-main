# 📋 PROMPT PARA AGENTE CLAUDE FOR CHROME

**Objetivo**: Executar Phase 1 (Tasks 1.4-1.7) enquanto Diego configura webhook e envia msg WhatsApp

---

## 🎯 CONTEXTO

- **Instância**: 553173663601 (Atendimento Eficaz)
- **Instance Token**: 5896f4fa-c7f2-4511-9a0a-05698d64c746
- **Server**: https://tiatendeai.uazapi.com
- **Webhook**: Será configurado em UAZAPI → `https://app.ruptur.cloud/api/bubble/validate`
- **Status**: Backend pronto, aguardando webhook ativo + msg de teste

---

## 📌 TAREFAS DO AGENTE (Execute em ordem)

### TASK 1.4 — MONITORAR WEBHOOK

**Ação**:
1. SSH na VPS: `ssh root@ruptur.cloud`
2. Navegar: `cd /opt/ruptur/saas`
3. Ativar monitoramento de logs (janela 1):
   ```bash
   docker-compose logs -f saas-web 2>&1 | grep -i "bubble\|validate\|webhook"
   ```
4. **AGUARDAR** que Diego:
   - Configure webhook global em UAZAPI dashboard
   - Envie mensagem WhatsApp para 553173663601
5. **CAPTURAR** primeira linha de log com webhook recebido (copiar para próxima task)

**Resultado Esperado**: Log mostra `POST /api/bubble/validate` com status `200 OK`

**Tempo**: ~5 min (aguardando Diego)

---

### TASK 1.5 — DOCUMENTAR PAYLOAD

**Ação**:
1. A partir do log capturado em 1.4, extrair payload JSON completo
2. Criar arquivo: `/docs/WEBHOOK_PAYLOAD_UAZAPI.md` com:
   ```markdown
   # Webhook Payload UAZAPI

   ## Event: message.received

   **Capturado**: 2026-05-08 14:XX:XXZ

   \`\`\`json
   {
     "event": "message.received",
     "instance_id": "...",
     "data": {
       "id": "...",
       "sender": "...",
       "message": "...",
       "timestamp": "...",
       "type": "..."
     }
   }
   \`\`\`

   ### Campos Principais
   - `event`: Tipo de evento (message.received)
   - `instance_id`: ID da instância UAZAPI
   - `data.sender`: Número que enviou
   - `data.message`: Conteúdo da mensagem
   - `data.timestamp`: Horário (ISO 8601)
   - `data.type`: Tipo (text, image, etc)
   ```

3. Validar que todos campos estão presentes
4. Git add + commit

**Tempo**: ~10 min

**Commit message**:
```
docs: documentar payload webhook UAZAPI (message.received event)

Capturado de log ao vivo:
- Instance: 553173663601
- Event: message.received
- Timestamp: [data/hora do webhook]
- Validação: Todos campos principais presentes ✓
```

---

### TASK 1.6 — DEPLOY EM PRODUÇÃO

**Ação**:
1. (Já está em SSH da task anterior)
2. Em janela 2 (nova), executar:
   ```bash
   cd /opt/ruptur/saas
   docker-compose pull
   docker-compose up -d
   sleep 30
   docker-compose logs saas-web | head -30
   ```

3. Validar health:
   ```bash
   curl -s https://app.ruptur.cloud/api/local/health | jq .
   ```
   Esperado: `{"ok": true, "service": "ruptur-saas-gateway", ...}`

4. **AGUARDAR** que Diego teste E2E (task 1.7)

**Tempo**: ~5 min

---

### TASK 1.7 — VALIDAÇÃO E2E (Suporte)

**Ação** (Diego fará no navegador, agente valida via curl):

Enquanto Diego:
1. Acessa https://app.ruptur.cloud
2. Faz login
3. Navega para `/inbox`
4. Aguarda carregar Bubble iframe

**Você** (agente via curl):
```bash
# Testar token generation
TOKEN_RESPONSE=$(curl -s -X POST https://app.ruptur.cloud/api/bubble/token \
  -H "Authorization: Bearer <DIEGO_JWT_TOKEN>" \
  -H "Content-Type: application/json")

echo "Token gerado:"
echo $TOKEN_RESPONSE | jq .

# Extrair bubble_url
BUBBLE_URL=$(echo $TOKEN_RESPONSE | jq -r '.bubble_url')
echo "Bubble URL: $BUBBLE_URL"

# Testar se Bubble iframe carrega
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BUBBLE_URL")
echo "Bubble iframe status: $STATUS (esperado 200)"
```

**Validar**:
- ✅ Token gerado com sucesso
- ✅ Bubble URL contém ?token=...
- ✅ Bubble iframe carrega (200)
- ✅ Mensagem WhatsApp aparece em Ruptur (Diego confirma visualmente)

**Tempo**: ~10 min

---

## 📊 TIMELINE AGENTE

| Task | Tempo | Dependência | Status |
|------|-------|-------------|--------|
| 1.4 | 5min | Diego webhook + msg | ⏳ |
| 1.5 | 10min | 1.4 | ⏳ |
| 1.6 | 5min | 1.5 | ⏳ |
| 1.7 | 10min | 1.6 | ⏳ |
| **Total** | **~30min** | Sequencial | 🔴 START |

---

## ⚠️ DEPENDÊNCIAS DO DIEGO

**Antes do agente começar**:
1. [ ] Configure webhook global UAZAPI (URL: https://app.ruptur.cloud/api/bubble/validate)
2. [ ] Envie msg WhatsApp para 553173663601 (após webhook ativo)
3. [ ] Aguarde agente capturar webhook em logs
4. [ ] Faça deploy docker-compose (ou deixe agente fazer via SSH)
5. [ ] Teste E2E: login + /inbox + envie outra msg

---

## 🚀 INSTRUÇÕES PARA EXECUÇÃO

### Como passar para o agente:

Copie este bloco e cole no Claude for Chrome:

```
Você é um agente autônomo. Execute Phase 1 Boot (Tasks 1.4-1.7) do Ruptur SaaS:

CONTEXTO:
- Instância WhatsApp: 553173663601 (conectada)
- Webhook será enviado para: https://app.ruptur.cloud/api/bubble/validate
- Diego vai: 1) Configurar webhook UAZAPI, 2) Enviar msg WhatsApp

TAREFAS (execute em ordem):

1.4 MONITORAR WEBHOOK (5min):
  - SSH: ssh root@ruptur.cloud
  - Ativar logs: docker-compose logs -f saas-web | grep -i bubble
  - AGUARDAR Diego enviar msg WhatsApp
  - COPIAR primeira linha de webhook recebido

1.5 DOCUMENTAR PAYLOAD (10min):
  - Criar /docs/WEBHOOK_PAYLOAD_UAZAPI.md
  - Extrair JSON do webhook (do log capturado)
  - Validar campos: event, instance_id, data.sender, data.message, data.timestamp
  - Git add + commit com mensagem clara

1.6 DEPLOY (5min):
  - docker-compose pull && docker-compose up -d
  - Aguardar 30s
  - Validar: curl https://app.ruptur.cloud/api/local/health | jq .
  - Esperado: {"ok": true, ...}

1.7 E2E VALIDATION (10min):
  - Diego testa no navegador: login + /inbox
  - Você valida via curl:
    * POST /api/bubble/token → gera bubble_url
    * GET bubble_url → status 200
  - Diego confirma que msg WhatsApp aparece em Ruptur

RESULTADO ESPERADO:
- ✅ Logs mostram webhook recebido
- ✅ Payload documentado
- ✅ Deploy atualizado
- ✅ Inbox carrega em Ruptur
- ✅ Mensagem sincronizada

Comece AGORA quando Diego avisar que webhook está configurado.

Arquivo de referência: PHASE_1_ACAO_IMEDIATA.md (no repo do Ruptur)
```

---

## 📁 ARQUIVO DE REFERÊNCIA

**Agente pode ler**: `/Users/diego/dev/ruptur-cloud/ruptur-main/saas/PHASE_1_ACAO_IMEDIATA.md`

Tem checklist detalhado e contexto completo.

---

## ✅ SUCESSO CRITERIA

Phase 1 completo quando:
- ✅ Webhook recebido e logado
- ✅ Payload documentado em /docs/
- ✅ Deploy atualizado em produção
- ✅ Inbox carrega em https://app.ruptur.cloud/inbox
- ✅ Mensagem WhatsApp sincroniza em tempo real

---

**PRONTO PARA PASSAR PARA AGENTE DO CHROME!** 🚀
