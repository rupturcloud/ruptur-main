# 🤖 Task para Agent — Monitorar e Validar Webhooks

**Responsável**: Agent Claude  
**Tempo**: ~30 minutos  
**Bloqueante**: Webhook precisa estar configurado em UAZAPI primeiro

---

## 📋 CHECKLIST

### ✅ PASSO 1: Confirmar Webhook Configurado (5min)

Agent verifica que webhook foi configurado:

```bash
# 1. SSH na VPS
ssh root@ruptur.cloud

# 2. Verificar se container está rodando
cd /opt/ruptur/saas
docker-compose ps | grep saas-web
# Esperado: saas-web UP (Healthy)

# 3. Testar saúde da aplicação
curl -s http://localhost:3001/api/health | jq .
# Esperado: { "ok": true, "service": "ruptur-saas-gateway", ... }
```

---

### 🟡 PASSO 2: Ativar Monitoramento de Logs (2min)

```bash
# Monitorar em tempo real (em um terminal)
cd /opt/ruptur/saas
docker-compose logs -f saas-web | grep -i "UAZAPI Webhook\|bubble\|validate"

# Vai mostrar:
# [UAZAPI Webhook] message.received | instance: 5896f4fa-... | data: {...}
```

**Deixar rodando enquanto Diego envia msg WhatsApp**

---

### 🔵 PASSO 3: Aguardar Evento (varia)

Quando Diego enviar mensagem WhatsApp para `553173663601`:

**Esperado no log** (em 2-5 segundos):

```
[UAZAPI Webhook] message.received | instance: 5896f4fa-c7f2-4511-9a0a-05698d64c746 | data: {
  "id": "msg_123456",
  "sender": "5511987654321",
  "message": "Olá, testando!",
  "timestamp": "2026-05-08T14:35:00Z",
  "type": "text"
}
```

**Se não ver log**:
- [ ] Confirmar webhook está ativo em UAZAPI (Diego verificar)
- [ ] Confirmar URL está exata: `https://app.ruptur.cloud/api/bubble/validate`
- [ ] Esperar 1min mais (UAZAPI pode ter delay)
- [ ] Testar webhook manualmente (veja seção abaixo)

---

### 💾 PASSO 4: Capturar Payload (10min)

Quando evento chegar no log:

1. **Copiar payload completo** do log
2. **Criar arquivo** `/saas/docs/WEBHOOK_PAYLOAD_EXEMPLO.md`:

```bash
cat > docs/WEBHOOK_PAYLOAD_EXEMPLO.md << 'EOF'
# Webhook UAZAPI — Exemplo Real Capturado

**Data**: 2026-05-08 14:35:00 UTC  
**Evento**: message.received  
**Instance**: 553173663601

## Payload Completo

```json
{
  "event": "message.received",
  "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746",
  "data": {
    "id": "msg_123456",
    "sender": "5511987654321",
    "message": "Olá, testando!",
    "timestamp": "2026-05-08T14:35:00Z",
    "type": "text"
  }
}
```

## HTTP Response

Status: 200 OK
Body: `{ "ok": true, "event": "message.received", "instance_id": "5896f4fa-..." }`

---

**Logs do backend** (capturado em docker-compose logs):

```
[UAZAPI Webhook] message.received | instance: 5896f4fa-c7f2-4511-9a0a-05698d64c746 | data: {
  "id": "msg_123456",
  "sender": "5511987654321",
  "message": "Olá, testando!",
  "timestamp": "2026-05-08T14:35:00Z",
  "type": "text"
}
```
EOF
```

3. **Commit**:

```bash
git add docs/WEBHOOK_PAYLOAD_EXEMPLO.md
git commit -m "docs: webhook payload real capturado em 2026-05-08"
```

---

### 🚀 PASSO 5: Deploy Nova Versão (10min)

Com webhook handler confirmado, fazer deploy:

```bash
# Já estamos com webhook handler ativo no código
# Fazer pull + restart para garantir última versão

cd /opt/ruptur/saas

# 1. Pull imagem
docker-compose pull

# 2. Restart containers
docker-compose down
docker-compose up -d

# 3. Esperar ~5s
sleep 5

# 4. Verificar saúde
docker-compose logs saas-web | tail -10
curl -s http://localhost:3001/api/health | jq .
```

---

### ✅ PASSO 6: Confirmar Sucesso (3min)

```bash
# Verificar que tudo rodou sem erros
docker-compose ps
# Esperado: saas-web, warmup-runtime ambos UP

# Testar endpoint webhook manualmente (sem UAZAPI)
curl -X POST http://localhost:3001/api/bubble/validate \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message.received",
    "instance_id": "5896f4fa-c7f2-4511-9a0a-05698d64c746",
    "data": {
      "sender": "5511987654321",
      "message": "Teste",
      "timestamp": "'$(date -Iseconds)'"
    }
  }' | jq .

# Esperado: { "ok": true, "event": "message.received", "instance_id": "..." }
```

---

## 🎯 RESUMO

| Step | Owner | Tempo | Status |
|------|-------|-------|--------|
| 1. Confirmar webhook | Agent | 5min | ⏳ Espera Diego |
| 2. Monitorar logs | Agent | 2min | ⏳ Ativo |
| 3. Aguardar evento | Diego | 5min | ⏳ Espera Diego |
| 4. Capturar payload | Agent | 10min | ⏳ Depois de 3 |
| 5. Deploy | Agent | 10min | ⏳ Depois de 4 |
| 6. Validar | Agent | 3min | ⏳ Depois de 5 |
| **TOTAL** | | **~35min** | 🔴 **FAZER AGORA** |

---

## 🔴 SE ALGO DER ERRADO

### Erro: "Webhook URL: Connection timeout"

**Causa**: URL errada ou firewall bloqueando

**Teste**:
```bash
# De sua máquina local:
curl -v https://app.ruptur.cloud/api/bubble/validate

# Esperado: HTTP 400 (sem body) ou 200 (sem X-Token)
# Não esperado: Connection refused, timeout
```

### Erro: "No logs appearing"

**Checklist**:
1. [ ] Webhook ativo em UAZAPI dashboard?
2. [ ] URL exatamente `https://app.ruptur.cloud/api/bubble/validate`?
3. [ ] Container saas-web rodando (`docker-compose ps`)?
4. [ ] Health check retorna 200 OK?
5. [ ] Tentou enviar msg do celular para 553173663601?
6. [ ] Esperou 30s?

Se tudo acima OK → UAZAPI pode estar com problema, contatar Diego

---

## 📞 PRÓXIMO PASSO

**Assim que webhook chegar OK**:
1. Documentar payload
2. Deploy nova versão
3. Phase 1 está 80% completo
4. Avançar para Phase 2 (data types Bubble)

---

**Referência**: `WEBHOOK_UAZAPI_ESPERADO.md` (exemplos de payloads)  
**Status**: 🔴 **AGUARDANDO WEBHOOK CONFIGURADO EM UAZAPI**
