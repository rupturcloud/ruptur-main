# ⚡ COMECE AQUI AGORA

**Objetivo**: Configurar webhook UAZAPI em 5 minutos e começar Phase 1

---

## 🎯 SEU PRÓXIMO PASSO (Agora mesmo)

### PASSO 1: Acesse Dashboard UAZAPI

1. Abra: https://tiatendeai.uazapi.com
2. Faça login (se necessário)

---

### PASSO 2: Vá para Webhooks

Procure no menu:
- **Settings** ou **Configurações**
- **Webhooks** ou **Eventos**
- **Webhook Global** (se houver opção)

---

### PASSO 3: Configure Webhook

**Adicione novo webhook com:**

```
URL:        https://app.ruptur.cloud/api/bubble/validate
Método:     POST
Ativo:      ✅ Sim
```

---

### PASSO 4: Selecione Eventos

Marque as caixas:
- ✅ `message.received` (msg recebida)
- ✅ `message.sent` (msg enviada)
- ✅ `instance.connected` (conectou)
- ✅ `instance.disconnected` (desconectou)
- ✅ `presence.changed` (status mudou)

---

### PASSO 5: Salvar

Clique em **Save** ou **Confirmar**

---

### ✅ PRONTO!

Webhook está configurado. **Avise quando estiver feito.**

Depois disso:
1. Agent monitora logs
2. Você envia msg WhatsApp
3. Message aparece em Ruptur
4. Phase 1 completo 🎉

---

**Tempo estimado**: 5 minutos

**Se tiver dúvida no dashboard UAZAPI**: Leia arquivo `PHASE_1_ACAO_IMEDIATA.md` (Task 1.3)
