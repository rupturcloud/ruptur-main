# 💰 Auditoria de Segurança Financeira - Ruptur SaaS

**Data**: 2 de maio de 2026  
**Status**: Análise de Getnet + Payment Flow  
**Risco**: 🔴 CRÍTICO - Vários pontos cegos identificados

---

## 🎯 Checklist de Segurança Financeira

### 1. ✅ Idempotência nas Transações Financeiras

**Status**: IMPLEMENTADO  
**Local**: `modules/billing/getnet.js:419`

```javascript
if (dbPayment && dbPayment.status !== 'APPROVED') {
  // Só processa se não foi aprovado antes
}
```

**Validação**: Webhook pode ser retentado múltiplas vezes sem duplicar créditos.

---

### 2. ❌ CRÍTICO - Validação de Assinatura de Webhook

**Status**: NÃO IMPLEMENTADO  
**Risco**: ALTO - Webhook pode ser falsificado

```javascript
// ❌ FALTANDO em handleWebhook()
async handleWebhook(body, query = {}) {
  // ⚠️  Não há validação de assinatura!
  // ⚠️  Qualquer um pode enviar um webhook falso
  
  const eventType = body.event || body.type;
  // ...
}
```

**Implementação Necessária**:
```javascript
// ✅ DEVE ser implementado
async validateWebhookSignature(body, signature) {
  // Usar HMAC-SHA256 com webhook secret
  // const hash = crypto.createHmac('sha256', GETNET_WEBHOOK_SECRET)
  //   .update(body)
  //   .digest('hex');
  // return hash === signature;
}
```

**Ação**: Configurar webhook secret no painel Getnet e validar assinatura em cada webhook.

---

### 3. ⚠️ Reconciliação Financeira

**Status**: PARCIALMENTE IMPLEMENTADO  
**Faltam**: Relatórios de reconciliação

```javascript
// ✅ EXISTE:
- payments table com getnet_payment_id
- subscriptions table com getnet_subscription_id
- Histórico de créditos (wallet_transactions)

// ❌ FALTAM:
- Function de reconciliação periódica
- Relatório: pagamentos no Getnet vs BD local
- Alertas de divergências
- Recovery automático de falhas
```

**Implementação Necessária**:
```javascript
async reconcilePayments() {
  // 1. Buscar todos os payments do Getnet (últimos 30 dias)
  // 2. Comparar com tabela de payments no BD
  // 3. Gerar relatório de divergências
  // 4. Alertar se houver pagamento não processado
}
```

---

### 4. ⚠️ Testes de Falha de Pagamento

**Status**: NÃO IMPLEMENTADO  
**Risco**: MÉDIO - Fluxos de erro não foram testados

**Cenários Faltantes**:
- ❌ Pagamento iniciado mas não confirmado (timeout)
- ❌ Webhook chega antes de INSERT do pagamento
- ❌ Webhook duplicado (idempotência validada)
- ❌ Cartão rejeitado (insufficient funds, expired, etc)
- ❌ Getnet API indisponível (circuit breaker)
- ❌ Erro ao adicionar créditos (rollback)

**Implementação Necessária**:
```javascript
// Test suite
describe('Billing - Failure Scenarios', () => {
  it('handles duplicate webhook', async () => {
    // Simular webhook duplicado
  });
  
  it('handles card rejection', async () => {
    // Simular PAYMENT_DENIED
  });
  
  it('handles getnet timeout', async () => {
    // Simular falha de API
  });
});
```

---

### 5. ✅ Separar "Tentativa" de "Confirmação"

**Status**: IMPLEMENTADO  
**Local**: `modules/billing/getnet.js`

```javascript
// ✅ Distinção clara:
// 1. createCheckoutPreference() → cria payment com status inicial
// 2. handlePaymentApproved() → webhook confirma com APPROVED
// 3. Créditos adicionados APENAS após webhook (não no passo 1)
```

**Fluxo Correto**:
```
1. API: createCheckoutPreference() → { status: 'INITIATED' }
2. Front: Usuário preenche cartão e clica "Pagar"
3. Getnet: Processa pagamento
4. Webhook: handlePaymentApproved() → { status: 'APPROVED' }
5. Sistema: Adiciona créditos
```

---

### 6. ❌ CRÍTICO - Grace Period e Soft Delete

**Status**: NÃO IMPLEMENTADO  
**Risco**: ALTO - Dados financeiros deletados permanentemente

**Problemas Identificados**:
```javascript
// ❌ Cancelamento direto sem grace period
async cancelSubscription(subscriptionId) {
  // Deleta imediatamente - SEM período de carência
  // SEM reversão de créditos em caso de cancel <24h
  // SEM possibilidade de recovery
}

// ❌ Soft delete não está implementado
// Pagamentos/Assinaturas são deletados, não marcados como deletados
```

**Implementação Necessária**:
```javascript
// ✅ DEVE ter:
1. Grace period de 24h após cancel
2. Soft delete (campo deleted_at, não deletar row)
3. Reversão automática se cancel dentro de 24h
4. Notificação ao cliente antes de desativar

async cancelSubscriptionWithGracePeriod(subscriptionId) {
  // 1. Mark as "pending_cancellation" com data de execução
  // 2. Enviar email ao cliente: "Seu plano será cancelado em 24h"
  // 3. Ativar endpoint para "undo_cancellation"
  // 4. Após 24h, marcar como deleted_at (soft delete)
}
```

---

### 7. ⚠️ Auditoria Completa de Transações Financeiras

**Status**: PARCIALMENTE IMPLEMENTADO  
**Faltam**: Auditoria detalhada de todas as transações

```javascript
// ✅ EXISTE:
- Log de webhook recebido
- Log de comissão processada
- Status no payments table

// ❌ FALTAM:
- Auditoria de TODAS as mudanças (quem, quando, por quê)
- Histórico de alterações em subscriptions
- Log de refunds (ainda não implementado)
- Log de chargebacks
- Log de reconhecimentos de receita
```

**Implementação Necessária**:
```javascript
// ✅ DEVE ter tabela: payments_audit_log
CREATE TABLE payments_audit_log (
  id UUID PRIMARY KEY,
  payment_id UUID,
  action TEXT, -- 'created', 'approved', 'denied', 'refunded'
  old_status TEXT,
  new_status TEXT,
  actor_type TEXT, -- 'webhook', 'admin', 'user'
  actor_id TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP
);

// E logs detalhados para cada operação:
await logPaymentAudit({
  payment_id: paymentId,
  action: 'approved',
  old_status: 'INITIATED',
  new_status: 'APPROVED',
  actor_type: 'webhook',
  actor_id: 'getnet_webhook_handler',
  reason: 'Webhook PAYMENT_APPROVED recebido',
  metadata: { webhook_id: body.webhook_id, timestamp: body.timestamp }
});
```

---

### 8. ✅ Não Misturar Lógica de Negócio com Provider de Pagamento

**Status**: BOAS PRÁTICAS SEGUIDAS  
**Local**: Estrutura modular em `modules/billing/`

```javascript
// ✅ Bem separado:
// - modules/billing/getnet.js - Lógica específica Getnet
// - modules/billing/ pode ter adapter para Evolution, Stripe, etc
// - Endpoints chamam interface agnóstica
```

---

### 9. ❌ CRÍTICO - Controle de Concorrência

**Status**: NÃO IMPLEMENTADO  
**Risco**: CRÍTICO - Race conditions em transações

**Cenários de Risco**:
```javascript
// ❌ Race condition possível:
// T1: Webhook 1 começa - busca payment (status INITIATED)
// T2: Webhook 2 começa - busca payment (status INITIATED)
// T1: Atualiza para APPROVED e adiciona 1000 créditos
// T2: Atualiza para APPROVED e adiciona 1000 créditos (DUPLICADO!)
// Resultado: 2000 créditos em vez de 1000

async handlePaymentApproved(body) {
  const { data: dbPayment } = await this.supabase
    .from('payments')
    .select('*')
    .eq('getnet_payment_id', paymentId)  // ❌ Race condition aqui!
    .single();
  
  if (dbPayment && dbPayment.status !== 'APPROVED') {
    // ❌ Outro webhook pode ter marcado como APPROVED entre SELECT e UPDATE
    
    await this.supabase.from('payments').update({
      status: 'APPROVED',  // ❌ Sem lock/transaction
    }).eq('getnet_payment_id', paymentId);
  }
}
```

**Implementação Necessária**:
```javascript
// ✅ OPÇÃO 1: Usar transação com lock
const result = await this.supabase
  .rpc('process_payment_approved', {
    p_payment_id: paymentId,
    p_credits_to_grant: creditsAmount,
    // Função PL/pgSQL com SELECT FOR UPDATE
  });

// ✅ OPÇÃO 2: Usar campo para prevenção de duplicação
// Adicionar campo: idempotency_key UNIQUE
const { data } = await this.supabase
  .from('payments')
  .insert({
    getnet_payment_id: paymentId,
    webhook_id: body.webhook_id, // ← UNIQUE constraint
    status: 'APPROVED',
    // ...
  });
// Se webhook_id já existe, falha naturalmente (não duplica)

// ✅ OPÇÃO 3: Processar via job queue (mais robusto)
// Enqueue webhook para processamento serial
// Evita múltiplas transações simultâneas do mesmo payment
```

---

## 📋 Resumo de Ações Necessárias

| # | Ação | Prioridade | Risco | Status |
|---|------|-----------|-------|--------|
| 1 | Validar assinatura de webhook | 🔴 CRÍTICO | Webhook falsificado | ❌ TODO |
| 2 | Implementar função de reconciliação | 🟠 ALTA | Divergências não detectadas | ❌ TODO |
| 3 | Adicionar testes de falha de pagamento | 🟠 ALTA | Fluxos não testados | ❌ TODO |
| 4 | Grace period em cancelamento | 🟠 ALTA | Cancelamento irreversível | ❌ TODO |
| 5 | Soft delete para dados financeiros | 🟠 ALTA | Dados deletados permanentemente | ❌ TODO |
| 6 | Auditoria completa de transações | 🟠 ALTA | Compliance/compliance | ❌ TODO |
| 7 | Controle de concorrência (lock/transaction) | 🔴 CRÍTICO | Race conditions | ❌ TODO |

---

## 🔒 Configuração Getnet Necessária

1. **Webhook Secret**: Obter webhook secret do painel Getnet
2. **Webhook URLs**: Configurar 5 URLs no painel:
   - `https://api.ruptur.cloud/api/webhooks/getnet/payment` (PAYMENT_APPROVED, PAYMENT_DENIED)
   - `https://api.ruptur.cloud/api/webhooks/getnet/subscription` (SUBSCRIPTION_PAYMENT, SUBSCRIPTION_CANCELLED)
   - `https://api.ruptur.cloud/api/webhooks/getnet/chargeback` (futuro)

3. **IP Whitelist**: Adicionar IPs da Getnet

---

## 📚 Referências

- [Getnet Webhook Documentation](https://developers.getnet.com.br/)
- [Payment Card Industry (PCI) DSS](https://www.pcisecuritystandards.org/)
- [OWASP - Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [Database Transactions and Concurrency](https://www.postgresql.org/docs/current/tutorial-transactions.html)

---

**Próximo Passo**: Priorizar implementação de validação de webhook (CRÍTICO) antes de ir a produção.
