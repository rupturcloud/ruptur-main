# 📡 Webhook UAZAPI — Estrutura e Validação

**Data**: 2026-05-08  
**Status**: ✅ Backend pronto para receber  
**Endpoint**: `POST https://app.ruptur.cloud/api/bubble/validate`

---

## 🎯 O QUE ESPERAR

Quando você configurar webhook global em UAZAPI apontando para:

```
https://app.ruptur.cloud/api/bubble/validate
```

O UAZAPI vai enviar eventos assim:

### Exemplo 1: Mensagem Recebida

```json
{
  "event": "message.received",
  "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746",
  "data": {
    "id": "msg_xyz123",
    "sender": "5511987654321",
    "message": "Olá! Tudo bem?",
    "timestamp": "2026-05-08T14:35:00Z",
    "type": "text"
  }
}
```

### Exemplo 2: Instância Conectou

```json
{
  "event": "instance.connected",
  "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746",
  "data": {
    "connected": true,
    "phone": "+55 11 98765-4321",
    "profileName": "Atendimento Eficaz",
    "timestamp": "2026-05-08T14:30:00Z"
  }
}
```

### Exemplo 3: Instância Desconectou

```json
{
  "event": "instance.disconnected",
  "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746",
  "data": {
    "connected": false,
    "reason": "qr_timeout",
    "timestamp": "2026-05-08T15:00:00Z"
  }
}
```

---

## ✅ VALIDAÇÃO: O QUE VER NOS LOGS

### Passo 1: Monitorar Logs da VPS

```bash
# SSH na VPS
ssh root@ruptur.cloud

# Entrar no diretório
cd /opt/ruptur/saas

# Ativar monitoramento contínuo
docker-compose logs -f saas-web | grep -i "UAZAPI Webhook\|bubble"
```

### Passo 2: Enviar Mensagem WhatsApp

Você (Diego) envia uma mensagem WhatsApp para `553173663601` (o número da instância conectada).

### Passo 3: Verificar Log

**Esperado** (vai aparecer no terminal):

```
[UAZAPI Webhook] message.received | instance: 5896f4fa-c7f2-4511-9a0a-05698d64c746 | data: {
  "id": "msg_123456",
  "sender": "5511987654321",
  "message": "Olá!",
  "timestamp": "2026-05-08T14:35:00Z",
  "type": "text"
}
```

---

## 🔍 ESTRUTURA DO WEBHOOK

Cada webhook UAZAPI que chegar em `/api/bubble/validate` DEVE ter:

| Campo | Tipo | Obrigatório | Exemplo |
|-------|------|:---:|---|
| `event` | string | ✅ | `"message.received"` |
| `instance_id` | string (UUID) | ✅ | `"5896f4fa-c7f2-4511-9a0a-05698d64c746"` |
| `data` | object | ⚠️ | `{ sender, message, ... }` |

---

## 🎯 TIPOS DE EVENTOS ESPERADOS

Ative **todos** esses no dashboard UAZAPI:

| Evento | Quando | Data Incluído |
|--------|--------|---|
| `message.received` | Mensagem chega | sender, message, timestamp, type |
| `message.sent` | Mensagem enviada | recipient, message, timestamp |
| `instance.connected` | Instância conectou | phone, profileName, timestamp |
| `instance.disconnected` | Instância desconectou | reason, timestamp |
| `presence.changed` | Status mudou (online/offline) | presence, timestamp |

---

## 🔴 SE NÃO VER LOGS

### Cenário 1: Webhook não dispara

**Verificar em UAZAPI**:
1. Dashboard → Settings → Webhooks
2. Webhook URL está exatamente: `https://app.ruptur.cloud/api/bubble/validate`
3. Status do webhook: ✅ **Active** ou **Enabled**
4. Eventos selecionados (pelo menos `message.received`)

### Cenário 2: Request chega mas é rejeitado (400)

**Causa**: Body não tem `event` ou `instance_id`

**Solução**: Verifique payload do UAZAPI se está correto (veja exemplos acima)

### Cenário 3: Conexão timeout

**Causa**: Firewall ou URL errada

**Solução**: Testar webhook com curl manual:

```bash
# Na VPS, testar endpoint localmente
curl -X POST http://localhost:3001/api/bubble/validate \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message.received",
    "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746",
    "data": {
      "sender": "5511987654321",
      "message": "Teste manual",
      "timestamp": "'$(date -Iseconds)'"
    }
  }'

# Esperado: { "ok": true, "event": "message.received", ... }
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

- [ ] Webhook configurado em UAZAPI (URL exata + eventos selecionados)
- [ ] Container saas-web está rodando (`docker-compose ps`)
- [ ] Health check OK: `curl http://localhost:3001/api/health`
- [ ] Monitorando logs: `docker-compose logs -f saas-web | grep UAZAPI`
- [ ] Enviar mensagem WhatsApp para 553173663601
- [ ] Ver log aparecer em 2-5 segundos
- [ ] Response é 200 OK

---

## 🚀 PRÓXIMO PASSO

1. **Você (Diego)** configura webhook em UAZAPI
2. **Agent** monitora logs
3. **Você** envia msg WhatsApp
4. **Logs** mostram evento recebido
5. **Deploy** nova versão com webhook handler ativo

**Tempo estimado para essa tarefa**: ~20 minutos

---

**Referência**: `PHASE_1_ACAO_IMEDIATA.md` (Task 1.3-1.4)
