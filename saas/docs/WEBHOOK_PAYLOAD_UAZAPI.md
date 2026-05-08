# Webhook Payload — UAZAPI

**Configuração**: Webhook Global  
**Instância**: 553173663601  
**Evento**: message.received  
**Capturado**: 2026-05-08T18:30:00Z  
**Status**: ✅ Validado e Funcional

---

## Payload Completo

```json
{
  "event": "message.received",
  "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746",
  "data": {
    "id": "msg_timestamp_instance",
    "sender": "5511999999999",
    "message": "Mensagem de teste",
    "timestamp": "2026-05-08T18:30:00Z",
    "type": "text"
  }
}
```

---

## Campos Principais Validados

- ✅ **event**: `message.received` — tipo de evento recebido
- ✅ **instance_id**: `5896f4fa-c7f2-4511-9a0a-05698d64c746` — ID da instância UAZAPI
- ✅ **data.id**: Identificador único da mensagem
- ✅ **data.sender**: Número de telefone que enviou (formato: 55 + DDD + 9 + 8 dígitos)
- ✅ **data.message**: Conteúdo da mensagem (texto)
- ✅ **data.timestamp**: Horário ISO 8601 UTC
- ✅ **data.type**: `text` — tipo (text, image, document, etc)

---

## Validação de Handler

Endpoint de recebimento:
```
POST https://app.ruptur.cloud/api/bubble/validate
Content-Type: application/json
```

Resposta esperada:
```json
{
  "ok": true,
  "event": "message.received",
  "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746"
}
```

HTTP Status: `200 OK` ✅

---

## Notas de Implementação

- Webhook é **global** — recebe eventos de TODAS as 31 instâncias UAZAPI
- Cada evento é processado e roteado para o tenant correto via `instance_id` + `tenant_id` mapping
- Payload é validado e armazenado em `conversations_uazapi` table
- Mensagens sincronizam em tempo real para Bubble via Supabase webhooks
