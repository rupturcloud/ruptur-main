# 🎯 WEBHOOK PRONTO — Instruções para Outro Agente

**De**: Claude Code (Backend Infrastructure)  
**Para**: Outro Agente (cuidando de Diego)  
**Data**: 2026-05-08  
**Status**: ✅ **BACKEND 100% PRONTO**

---

## 🚀 RESUMO EXECUTIVO

Backend Ruptur **já está pronto** para receber webhooks UAZAPI. Implementei:

✅ Handler para processamento de webhooks UAZAPI (`handleUAZAPIWebhook`)  
✅ Endpoint `/api/bubble/validate` modificado para detectar webhooks  
✅ Logging detalhado de cada evento recebido  
✅ Documentação completa com exemplos  
✅ Build passing, código pronto para produção  

**Próximo passo**: Você (outro agente) coordena com Diego para:
1. Configurar webhook global em UAZAPI
2. Validar que eventos chegam
3. Fazer deploy da nova versão

---

## 📋 O QUE FOI IMPLEMENTADO

### 1. Webhook Handler em `routes-bubble.mjs`

```javascript
export async function handleUAZAPIWebhook(req, res, json, body) {
  const { event, instance_id, data } = body || {};
  
  if (!event || !instance_id) {
    return json(res, 400, { error: 'event e instance_id obrigatórios' }, req);
  }

  console.log(`[UAZAPI Webhook] ${event} | instance: ${instance_id} | data:`, ...);
  return json(res, 200, { ok: true, event, instance_id }, req);
}
```

**Localização**: `/saas/api/routes-bubble.mjs` (linhas ~169-200)

### 2. Gateway Modificado

POST `/api/bubble/validate` agora detecta automaticamente:
- Se `X-Token` header → validação de token Bubble (comportamento antigo)
- Se `event + instance_id` no body → processa como webhook UAZAPI (novo)
- Caso contrário → retorna 400 bad request

**Localização**: `/saas/api/gateway.mjs` (linhas ~1783-1796)

### 3. Commit da Implementação

```
commit: fix: adicionar handler para webhooks UAZAPI em /api/bubble/validate
files: routes-bubble.mjs, gateway.mjs
status: ✅ build passing
```

---

## 📚 DOCUMENTAÇÃO DISPONÍVEL

| Arquivo | Propósito | Para Quem |
|---------|-----------|-----------|
| **COMECE_AQUI_AGORA.md** | 5 passos simples (5min) | Diego |
| **WEBHOOK_UAZAPI_ESPERADO.md** | Exemplos de payloads | Técnico/debug |
| **WEBHOOK_AGENT_TASK.md** | 6 passos para monitorar (35min) | Você (Agent) |
| **PHASE_1_ACAO_IMEDIATA.md** | Timeline completa (75min) | Você (Agent) |

---

## 🎯 PRÓXIMAS AÇÕES (você deve fazer)

### Ação 1️⃣: Informar Diego

Envie para Diego (em PT-BR):

> Webhook backend está pronto! Para começar Phase 1, configure webhook global em UAZAPI:
> 
> 1. Acesse: https://tiatendeai.uazapi.com
> 2. Vá em: Settings → Webhooks → Webhook Global
> 3. Adicione:
>    - **URL**: `https://app.ruptur.cloud/api/bubble/validate`
>    - **Eventos**: message.received, message.sent, instance.connected, instance.disconnected
> 4. Salve
> 
> Leia: `COMECE_AQUI_AGORA.md` (5 minutos)

### Ação 2️⃣: Coordenar Monitoramento

Quando Diego configurar webhook:

1. Avise Diego que você vai monitorar logs
2. Você entra na VPS:
   ```bash
   ssh root@ruptur.cloud
   cd /opt/ruptur/saas
   docker-compose logs -f saas-web | grep -i "UAZAPI Webhook"
   ```
3. Diego envia msg WhatsApp para `553173663601`
4. Você vê logs chegarem em 2-5 segundos

### Ação 3️⃣: Deploy

Depois que validar webhook:

```bash
ssh root@ruptur.cloud
cd /opt/ruptur/saas
docker-compose pull
docker-compose down
docker-compose up -d
sleep 5
docker-compose logs saas-web | tail -10
curl -s http://localhost:3001/api/health | jq .
```

---

## 🔍 INSTÂNCIA CONFIRMADA

Diego já forneceu a instância a usar:

```
Número WhatsApp:    553173663601
Nome Instância:     Atendimento Eficaz
Instance Token:     5896f4fa-c7f2-4511-9a0a-05698d64c746
Server UAZAPI:      https://tiatendeai.uazapi.com
Status:             connected ✅
```

Esta é a instância que vai receber msgs WhatsApp e disparar webhooks.

---

## ⚡ TIMELINE ESPERADO

| Fase | Dono | Tempo | O Quê |
|------|------|-------|-------|
| 1 | Você | 5min | Informar Diego sobre webhook |
| 2 | Diego | 5-10min | Configurar webhook em UAZAPI |
| 3 | Você | 2min | SSH + monitorar logs |
| 4 | Diego | 5min | Enviar msg WhatsApp |
| 5 | Você | 10min | Capturar payload + documentar |
| 6 | Você | 10min | Deploy nova versão |
| **TOTAL** | | **~40min** | Phase 1 webhook completo |

---

## ✅ CHECKLIST PARA VOCÊ

- [ ] Leu este documento
- [ ] Revisou `WEBHOOK_AGENT_TASK.md` (seu guia de ações)
- [ ] Informou Diego via `COMECE_AQUI_AGORA.md`
- [ ] Aguardando Diego configurar webhook
- [ ] Monitorar logs: `docker-compose logs -f | grep UAZAPI`
- [ ] Capturar payload exemplo
- [ ] Deploy: `docker-compose pull && up -d`
- [ ] Validar health check
- [ ] Documenta em `WEBHOOK_PAYLOAD_EXEMPLO.md`
- [ ] ✅ Phase 1 completo!

---

## 🚨 SE ALGO DER ERRADO

### Webhook não dispara

**Checklist**:
1. URL exata em UAZAPI: `https://app.ruptur.cloud/api/bubble/validate` ✅
2. Status webhook: Active/Enabled ✅
3. Eventos selecionados: message.received ✅
4. Container rodando: `docker-compose ps` ✅
5. Health OK: `curl http://localhost:3001/api/health` ✅

Se tudo acima OK → Teste manual:

```bash
curl -X POST http://localhost:3001/api/bubble/validate \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message.received",
    "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746",
    "data": { "sender": "5511987654321", "message": "Teste" }
  }'

# Esperado: 200 OK com { "ok": true }
```

### Logs não aparecem

Tentar sem grep:

```bash
docker-compose logs -f saas-web | head -50
# Procure por linhas com [UAZAPI Webhook]
```

---

## 📞 REFERÊNCIAS RÁPIDAS

- **Documentação para Diego**: `COMECE_AQUI_AGORA.md`
- **Seu guia detalhado**: `WEBHOOK_AGENT_TASK.md`
- **Exemplos de payloads**: `WEBHOOK_UAZAPI_ESPERADO.md`
- **Timeline completa**: `PHASE_1_ACAO_IMEDIATA.md`
- **Arquivo de configuração**: `/opt/ruptur/saas/docker-compose.yml`
- **Chave de instância**: `5896f4fa-c7f2-4511-9a0a-05698d64c746`

---

## 🎯 STATUS FINAL

```
✅ Backend implementado
✅ Build passing
✅ Documentação pronta
🔴 BLOQUEADO: Aguardando webhook configurado

Próximo: Você coordena Diego → Configurar webhook UAZAPI
Depois: Você monitora logs → Deploy → Phase 1 completo
```

---

**Dúvidas?** Consulte `WEBHOOK_AGENT_TASK.md` para instruções detalhadas com comandos exatos.

**Boa sorte!** 🚀
