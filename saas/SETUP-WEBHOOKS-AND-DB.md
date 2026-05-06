# 🔧 Setup: Webhooks Getnet e Database Migrations

**Status**: ✅ Implementado com validação de assinatura HMAC-SHA256

---

## 📋 Checklist de Configuração

- [ ] 1. Configurar migrations no Supabase
- [ ] 2. Obter webhook secret do painel Getnet
- [ ] 3. Configurar variáveis de ambiente
- [ ] 4. Registrar webhook URLs no painel Getnet
- [ ] 5. Testar webhook com curl
- [ ] 6. Validar processamento de payments

---

## 1️⃣ Rodar Migrations no Supabase

### Passo 1: Copiar SQL da Migration

```bash
# Arquivo: saas/migrations/002_wallets_and_payments.sql
cat migrations/002_wallets_and_payments.sql
```

### Passo 2: Executar no Supabase

1. Acesse: [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para: **SQL Editor**
4. Clique em: **New Query**
5. Cole todo o conteúdo de `migrations/002_wallets_and_payments.sql`
6. Clique em: **Run**

**Resultado esperado**: ✅ "Success"

### Tabelas criadas:
- `wallets` - Saldo de créditos por tenant
- `wallet_transactions` - Histórico de movimentações
- `payments` - Histórico de pagamentos
- `subscriptions` - Assinaturas recorrentes
- `plans` - Planos disponíveis
- `referral_links` - Links de referência
- `referral_commissions` - Comissões geradas

### RLS Habilitado:
- ✅ Tenants isolados (só acessam seus dados)
- ✅ Funções helper: `add_wallet_credits()`, `debit_wallet_credits()`
- ✅ Índices para performance

---

## 2️⃣ Obter Webhook Secret do Painel Getnet

### Passo 1: Acessar Painel Getnet

1. Acesse: https://secure.getnet.com.br/dashboard
2. Login com suas credenciais
3. Vá para: **Configurações** → **Webhooks** (ou **Settings** → **Webhooks**)

### Passo 2: Segurança do callback

A documentação pública da Plataforma Digital Getnet descreve autenticação OAuth2 para chamadas de API com `Client ID` e `Client Secret`, mas não documenta um header/segredo HMAC específico para callbacks de pagamento. O Portal Minha Conta Getnet também permite cadastrar URLs de callback sem exibir campo de segredo de assinatura.

Política adotada no Ruptur:

```bash
# Preferencial, caso a Getnet/Suporte forneça assinatura de callback:
GETNET_WEBHOOK_SECRET=whsec_prod_xxxxx...

# Mitigação explícita quando a Getnet não fornecer assinatura de callback:
GETNET_WEBHOOK_ALLOW_UNSIGNED=true
```

Com `GETNET_WEBHOOK_SECRET` definido, o backend exige assinatura `x-getnet-signature` ou `x-signature`. Sem secret, produção só aceita callback se `GETNET_WEBHOOK_ALLOW_UNSIGNED=true` estiver ativo. Nesse modo, mitigar com HTTPS, Cloudflare, rate limit, idempotência por evento/pagamento, validação de schema e logs de auditoria.

---

## 3️⃣ Configurar Webhook URLs no Painel Getnet

### Passo 1: Acessar Configuração de Webhooks

No painel Getnet, vá para: **Webhooks** → **Adicionar Webhook** (ou **Add Endpoint**)

### Passo 2: Registrar 5 Webhooks

Adicione os seguintes endpoints:

#### Webhook 1: Pagamentos Aprovados
```
URL:    https://api.ruptur.cloud/api/webhooks/getnet
Method: POST
Events: PAYMENT_CONFIRMED, PAYMENT_APPROVED
Status: ✅ Ativo
```

#### Webhook 2: Pagamentos Negados
```
URL:    https://api.ruptur.cloud/api/webhooks/getnet
Method: POST
Events: PAYMENT_DENIED, PAYMENT_CANCELLED
Status: ✅ Ativo
```

#### Webhook 3: Pagamentos de Assinatura
```
URL:    https://api.ruptur.cloud/api/webhooks/getnet
Method: POST
Events: SUBSCRIPTION_PAYMENT, SUBSCRIPTION_RENEWED
Status: ✅ Ativo
```

#### Webhook 4: Cancelamento de Assinatura
```
URL:    https://api.ruptur.cloud/api/webhooks/getnet
Method: POST
Events: SUBSCRIPTION_CANCELLED, SUBSCRIPTION_EXPIRED
Status: ✅ Ativo
```

#### Webhook 5: Chargebacks (Futuro)
```
URL:    https://api.ruptur.cloud/api/webhooks/getnet
Method: POST
Events: CHARGEBACK, REFUND
Status: ✅ Ativo
```

### Passo 3: Verificar Headers

Certifique-se de que o painel Getnet envia:

```
Headers esperados:
- Content-Type: application/json
- X-Signature: HMAC-SHA256 do body
- User-Agent: Getnet-Webhook/1.0
```

---

## 4️⃣ Testar Webhook Localmente

### Teste 1: Validação de Assinatura

```bash
# Gerar assinatura correta com openssl
WEBHOOK_SECRET="seu_webhook_secret"
PAYLOAD='{"event":"PAYMENT_APPROVED","payment_id":"pay_123"}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')

echo "Payload: $PAYLOAD"
echo "Signature: $SIGNATURE"

# Enviar webhook com assinatura válida
curl -X POST http://localhost:8787/api/webhooks/getnet \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d "$PAYLOAD"

# Esperado: { "ok": true, "received": true, "action": "payment_approved" }
```

### Teste 2: Webhook Inválido (Deve Rejeitar)

```bash
# Enviar com assinatura inválida
curl -X POST http://localhost:8787/api/webhooks/getnet \
  -H "Content-Type: application/json" \
  -H "X-Signature: invalid_signature_12345" \
  -d '{"event":"PAYMENT_APPROVED","payment_id":"pay_123"}'

# Esperado: { "ok": false, "error": "Webhook signature validation failed" }
# Status: 401
```

### Teste 3: Webhook de Teste (Dev Mode)

```bash
# Endpoint de teste (dev mode)
curl -X POST http://localhost:8787/api/webhooks/test \
  -H "Content-Type: application/json" \
  -d '{"test":"data","timestamp":"2026-05-02"}'

# Esperado: { "ok": true, "received": true, "echo": { ... } }
```

### Teste 4: Status de Webhooks

```bash
# Verificar configuração
curl http://localhost:8787/api/webhooks/status

# Esperado:
# {
#   "status": "ok",
#   "webhooks": {
#     "getnet": {
#       "endpoint": "/api/webhooks/getnet",
#       "validation": "HMAC-SHA256",
#       "status": "✅ Configured" ou "⚠️ Not configured"
#     }
#   }
# }
```

---

## 5️⃣ Fluxo Completo de Payment

### Passo 1: User Clica "Comprar Créditos"

```
Frontend → POST /api/messages/send
Headers: Authorization: Bearer <JWT_TOKEN>
Body: { instanceId, to, content }
```

### Passo 2: Servidor Verifica Créditos

```javascript
// modules/api/endpoints.js
const wallet = await supabase
  .from('wallets')
  .select('balance')
  .eq('tenant_id', tenantId);

if (wallet.balance < 10) {
  return 402 Insufficient credits
}
```

### Passo 3: Debita Créditos

```javascript
// Chama função Supabase
const result = await supabase.rpc('debit_wallet_credits', {
  p_tenant_id: tenantId,
  p_amount: 10,
  p_reference: messageId,
  p_description: 'Message sent to ' + to
});
```

### Passo 4: Registra na Auditoria

```javascript
await supabase.from('audit_logs').insert({
  tenant_id: tenantId,
  action: 'send_message',
  status: 'success',
  details: { to, provider }
});
```

---

## 🔒 Segurança de Webhooks

### Validação Implementada:

✅ **HMAC-SHA256 Signature**: Verifica autenticidade da Getnet  
✅ **Idempotência**: Processa cada webhook uma única vez (por `payment_id`)  
✅ **Error Handling**: Rejeita webhooks inválidos com status 401/500  
✅ **Logging**: Todos os webhooks são logados  

### No Painel Getnet:

✅ Ativar: **Webhook Security** / **Require Signature**  
✅ Configurar: **IP Whitelist** (opcional, mais seguro)  
✅ Testar: Usar **Test Webhook** do painel  

---

## 📊 Monitoramento

### Verificar Processamento de Webhooks

```sql
-- No Supabase SQL Editor
SELECT 
  created_at,
  event_type,
  status,
  COUNT(*) as count
FROM webhook_logs
GROUP BY 1, 2, 3
ORDER BY 1 DESC
LIMIT 20;
```

### Verificar Payments Aprovados

```sql
SELECT 
  getnet_payment_id,
  status,
  credits_granted,
  created_at
FROM payments
WHERE status = 'APPROVED'
ORDER BY created_at DESC
LIMIT 20;
```

### Verificar Créditos Adicionados

```sql
SELECT 
  t.tenant_id,
  t.type,
  t.amount,
  t.description,
  t.created_at
FROM wallet_transactions t
WHERE t.type = 'credit'
ORDER BY t.created_at DESC
LIMIT 20;
```

---

## 🚨 Troubleshooting

### Webhook não está sendo recebido

1. ✅ Verificar URL correta no painel Getnet
2. ✅ Validar que servidor está rodando (`GET /api/webhooks/status`)
3. ✅ Verificar firewall permite POST de IPs Getnet
4. ✅ Ver logs: `tail -f /tmp/server.log | grep Webhook`

### "Webhook signature validation failed"

1. ✅ Se a Getnet forneceu assinatura: verificar `GETNET_WEBHOOK_SECRET`
2. ✅ Confirmar se o header recebido é `x-getnet-signature` ou `x-signature`
3. ✅ Não copiar espaços extras do painel/suporte
4. ✅ Se o Portal Getnet não fornece assinatura: usar `GETNET_WEBHOOK_ALLOW_UNSIGNED=true` conscientemente e reforçar idempotência/auditoria

### Créditos não são adicionados

1. ✅ Verificar status do payment: `SELECT * FROM payments WHERE getnet_payment_id = '...'`
2. ✅ Verificar wallet existe: `SELECT * FROM wallets WHERE tenant_id = '...'`
3. ✅ Verificar transação: `SELECT * FROM wallet_transactions WHERE reference = '...'`
4. ✅ Rodar migration 002 novamente se tabelas não existem

---

## 📚 Próximas Tarefas

1. ✅ Implementar validação de webhook (FEITO)
2. ✅ Criar migrations (FEITO)
3. [ ] Configurar Getnet webhook secret em produção
4. [ ] Testar fluxo completo de payment em staging
5. [ ] Implementar reconciliação periódica de payments
6. [ ] Adicionar alertas para webhooks falhados

---

**Data**: 2 de maio de 2026  
**Status**: Ready for testing  
**Última atualização**: Implementação de validação de assinatura completa
