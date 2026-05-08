# 🚀 PHASE 1 — BOOT & INICIALIZAÇÃO

**Objetivo**: Conectar primeira instância WhatsApp e validar webhook  
**Tempo Estimado**: 3 dias  
**Status**: 🔴 COMEÇAR AGORA  
**Owner**: Agent (com direcionamento de Diego se necessário)

---

## 📋 CHECKLIST EXECUTIVO

### ✅ Pré-Requisitos (Validados)

- [x] UAZAPI Token funcional (UmiLwsiyjN01ipt5XuaU97vC4PTyPwHfhFN15CyHvJklANTzGX)
- [x] 31 instâncias acessíveis em UAZAPI
- [x] Ruptur backend routes prontas (/api/bubble/token + /api/bubble/validate)
- [x] Inbox.jsx reescrito com iframe
- [x] Build passing (npm run build ✅)
- [x] Financeiro documentado como débito técnico (não bloqueia)

### 🟡 Tarefas Phase 1

#### TASK 1.1 — Conectar Primeira Instância WhatsApp
**Responsável**: Agent  
**Tempo**: 1 hora  
**Descrição**: Criar nova instância no UAZAPI e obter QR code para conexão

**Checklist**:
- [ ] Chamar POST `/instance/create` em UAZAPI com payload:
  ```json
  {
    "name": "Suporte Ruptur Teste",
    "systemName": "ruptur-saas-test-001"
  }
  ```
- [ ] Receber response com `instance_id`
- [ ] Chamar POST `/instance/qrcode` ou `/instance/connect` para gerar QR
- [ ] Salvar QR code (validação manual: Diego escaneia com celular)
- [ ] Aguardar status ficar `connected` (pooling GET `/instance/status`)
- [ ] **Resultado Esperado**: Uma instância online e conectada

**Código de Referência**:
- `/modules/provider-adapter/uazapi-adapter.js` — métodos `createInstance()`, `getInstance()`

---

#### TASK 1.2 — Validar Conexão Online
**Responsável**: Agent  
**Tempo**: 30 minutos  
**Descrição**: Confirmar que instância está online e pronta para receber/enviar mensagens

**Checklist**:
- [ ] GET `/instance/{id}` → validar campo `connected === true`
- [ ] GET `/instance/{id}` → validar `current_presence` (deve ser `available` ou similar)
- [ ] Enviar mensagem de teste via UAZAPI para confirmar connectivity
- [ ] **Resultado Esperado**: Instância respondendo a comandos

---

#### TASK 1.3 — Configurar Webhook Global UAZAPI
**Responsável**: Agent + Diego (manual dashboard UAZAPI)  
**Tempo**: 2 horas  
**Descrição**: Registrar endpoint Ruptur como receptor de eventos UAZAPI

**Checklist**:
- [ ] Acessar dashboard UAZAPI (tiatendeai.uazapi.com)
- [ ] Navegar para: Settings → Webhooks → Webhook Global
- [ ] Adicionar URL: `https://app.ruptur.cloud/api/bubble/validate`
- [ ] Selecionar eventos a escutar:
  - `message.received` — Nova mensagem recebida
  - `message.sent` — Mensagem enviada
  - `instance.connected` — Instância conectou
  - `instance.disconnected` — Instância desconectou
  - `presence.changed` — Status online/offline mudou
- [ ] Salvar configuração
- [ ] **Resultado Esperado**: Webhook endpoint registrado

**Endpoint Esperado**:
```
POST /api/bubble/validate
Headers: X-Token: <token-base64>
Body: { event, data, instance_id, ... }
Response: { valid: true, ... }
```

---

#### TASK 1.4 — Testar Recebimento de Webhook
**Responsável**: Agent  
**Tempo**: 1 hora  
**Descrição**: Validar que eventos chegam em Ruptur corretamente

**Checklist**:
- [ ] Ativar logging em `/api/bubble/validate` (console.log payload)
- [ ] Enviar mensagem de teste para instância WhatsApp (número do celular)
- [ ] Monitorar logs da VPS: `docker-compose logs -f saas-web` (grep para "bubble")
- [ ] Confirmar que webhook foi recebido (status 200)
- [ ] Validar estrutura do payload (event, data, instance_id, etc)
- [ ] **Resultado Esperado**: Logs mostram webhook recebido e validado

**Validação**:
```bash
# Na VPS
ssh root@ruptur.cloud
cd /opt/ruptur/saas
docker-compose logs saas-web | grep -i "bubble\|webhook" | tail -20
```

---

#### TASK 1.5 — Documentar Estrutura de Webhook
**Responsável**: Agent  
**Tempo**: 1 hora  
**Descrição**: Mapear o payload de webhook UAZAPI para uso em Bubble workflows

**Checklist**:
- [ ] Capturar exemplos de payload para:
  - `message.received` event
  - `message.sent` event
  - `presence.changed` event
  - `instance.connected` event
- [ ] Documentar campos principais (sender, message, timestamp, etc)
- [ ] Criar arquivo: `/docs/WEBHOOK_PAYLOAD_UAZAPI.md`
- [ ] Validar que todos os campos necessários estão presentes
- [ ] **Resultado Esperado**: Documentação clara para parametrizar workflows Bubble

**Exemplo Esperado**:
```json
{
  "event": "message.received",
  "instance_id": "d083c9ac-60f1-4726-b5ba-88735fdf7dd9",
  "data": {
    "id": "msg_123",
    "sender": "5511999999999",
    "message": "Olá, tudo bem?",
    "timestamp": "2026-05-08T14:30:00Z",
    "type": "text"
  }
}
```

---

#### TASK 1.6 — Deploy & Validação
**Responsável**: Diego (SSH) + Agent (validação)  
**Tempo**: 1 hora  
**Descrição**: Deploy em produção e teste E2E

**Checklist**:
- [ ] Diego faz SSH na VPS
- [ ] Executar: `docker-compose pull && docker-compose up -d`
- [ ] Aguardar 30s para container iniciar
- [ ] Verificar health: `curl https://app.ruptur.cloud/api/local/health`
- [ ] Teste E2E:
  - [ ] Login em https://app.ruptur.cloud/inbox
  - [ ] Verificar que token é gerado (check network tab)
  - [ ] Verificar que Bubble iframe carrega
  - [ ] Enviar mensagem de teste WhatsApp
  - [ ] Confirmar que aparece em Ruptur
- [ ] **Resultado Esperado**: Fluxo completo funciona

---

## 📊 TIMELINE

| Task | Tempo | Dependências | Status |
|------|-------|--------------|--------|
| 1.1 | 1h | Nenhuma | ⏳ Pending |
| 1.2 | 0.5h | 1.1 | ⏳ Pending |
| 1.3 | 2h | Nenhuma | ⏳ Pending |
| 1.4 | 1h | 1.3 | ⏳ Pending |
| 1.5 | 1h | 1.4 | ⏳ Pending |
| 1.6 | 1h | 1.1-1.5 | ⏳ Pending |
| **TOTAL** | **~6.5h** | Sequencial | 🔴 **COMEÇAR** |

---

## 🎯 CRITÉRIO DE SUCESSO

**Phase 1 Completa quando**:
1. ✅ Uma instância WhatsApp está online e conectada
2. ✅ Webhook Global configurado e testado
3. ✅ Eventos chegando em `/api/bubble/validate` (logs confirmam)
4. ✅ Payload mapeado e documentado
5. ✅ Deploy em produção validado
6. ✅ Teste E2E passando (msg WhatsApp → Ruptur UI)

---

## 📞 DECISÃO NECESSÁRIA DE DIEGO

Antes que Agent comece:

1. **Número WhatsApp para teste**: Qual número usar para conectar primeira instância?
2. **Aprovação para webhook**: Pode-se configurar webhook global em UAZAPI dashboard?
3. **Timeline**: Quando quer começar (hoje ou depois)?

---

## 🚀 DEPOIS DE PHASE 1

Quando Phase 1 estiver 100% completo:

→ Ir para **PHASE 2: Data Layer & Workflows** (5 dias)
- Criar 5 Data Types em Bubble
- Parametrizar 13 workflows UAZAPI
- Sincronizar histórico das 31 instâncias

---

**Status**: 🔴 **AGUARDANDO CONFIRMAÇÃO PARA COMEÇAR**

Tudo técnico está validado. Bloqueado em:
1. Número WhatsApp para teste
2. Aprovação para configurar webhook
3. Go/no-go do Diego
