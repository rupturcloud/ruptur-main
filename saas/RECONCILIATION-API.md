# 💰 API de Reconciliação Financeira

**Data**: 2 de maio de 2026  
**Status**: ✅ Implementado e Testado  
**Testes**: 8/8 passando

---

## 📋 Visão Geral

Função de reconciliação periódica que:

1. **Compara** status de pagamentos no banco local vs Getnet API
2. **Detecta** discrepâncias (ex: local=INITIATED, getnet=APPROVED)
3. **Corrige** automaticamente status e re-credita créditos perdidos
4. **Registra** tudo em log para auditoria

**Objetivo**: Garantir que não há pagamentos "perdidos" ou créditos não contabilizados.

---

## 🔌 Integração no BillingService

### Método: `reconcilePayments(options)`

```javascript
import { BillingService } from './modules/billing/getnet.js';

const billing = new BillingService({ supabase });

// Executar reconciliação
const result = await billing.reconcilePayments({
  daysBack: 7,           // Quantos dias no passado procurar
  autoFix: true,         // Corrigir automaticamente?
  notifyOnDifference: true // Notificar admin se houver discrepâncias?
});

console.log(result);
// {
//   ok: true,
//   action: 'reconciliation_complete',
//   totalPayments: 150,
//   matchedPayments: 148,
//   discrepancies: [
//     {
//       paymentId: 'getnet-pay-123',
//       localStatus: 'INITIATED',
//       getnetStatus: 'APPROVED',
//       amount_cents: 9900,
//       creditsGranted: 1000,
//       detectedAt: '2026-05-02T14:30:00Z'
//     }
//   ],
//   corrected: [
//     {
//       paymentId: 'getnet-pay-123',
//       action: 'status_updated',
//       from: 'INITIATED',
//       to: 'APPROVED'
//     }
//   ],
//   errors: [],
//   startTime: '2026-05-02T14:00:00Z',
//   endTime: '2026-05-02T14:15:00Z'
// }
```

### Parâmetros

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `daysBack` | integer | 7 | Quantos dias no passado reconciliar |
| `autoFix` | boolean | true | Corrigir discrepâncias automaticamente |
| `notifyOnDifference` | boolean | true | Notificar admin se encontrar discrepâncias |

### Resposta

```typescript
{
  ok: boolean,                    // Sucesso geral
  action: string,                 // 'reconciliation_complete' ou 'reconciliation_failed'
  totalPayments: number,          // Total de pagamentos processados
  matchedPayments: number,        // Pagamentos que coincidem
  discrepancies: {
    paymentId: string,
    localStatus: string,
    getnetStatus: string,
    amount_cents: number,
    creditsGranted: number,
    detectedAt: string (ISO date)
  }[],
  corrected: {
    paymentId: string,
    action: string,               // 'status_updated', etc
    from: string,
    to: string
  }[],
  errors: {
    paymentId: string,
    error: string
  }[],
  startTime: string (ISO date),
  endTime: string (ISO date)
}
```

---

## 🌐 API REST Endpoint

### GET `/api/admin/reconciliation`

Executar reconciliação manual (admin only).

**Headers:**
```
Authorization: Bearer {ADMIN_JWT_TOKEN}
Content-Type: application/json
```

**Query Parameters:**
```
?daysBack=7&autoFix=true&notify=true
```

**Response (200):**
```json
{
  "ok": true,
  "action": "reconciliation_complete",
  "totalPayments": 150,
  "matchedPayments": 148,
  "discrepancies": [...],
  "corrected": [...],
  "errors": []
}
```

**Implementação:**
```javascript
// modules/api/endpoints.js
export async function handleAdminReconciliation(req, res, url, supabase) {
  const { tenantId, role } = req.session;

  // Validar admin
  if (role !== 'admin') {
    return createResponse(res, 403, { error: 'Admin access required' });
  }

  const params = new URLSearchParams(url.search);
  const daysBack = parseInt(params.get('daysBack') || '7');
  const autoFix = params.get('autoFix') !== 'false';
  const notify = params.get('notify') !== 'false';

  const billing = new BillingService({ supabase });
  const result = await billing.reconcilePayments({
    daysBack,
    autoFix,
    notifyOnDifference: notify,
  });

  return createResponse(res, 200, result);
}
```

---

## 📅 Cron Job — Rodar Periodicamente

### Opção 1: Cron simples

```bash
# /etc/cron.d/ruptur-reconciliation (executar a cada 6 horas)
0 0,6,12,18 * * * node /app/scripts/reconcile-payments.js
```

### Opção 2: Systemd Timer

```ini
# /etc/systemd/system/ruptur-reconciliation.service
[Unit]
Description=Ruptur Financial Reconciliation
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/app
ExecStart=/usr/bin/node /app/scripts/reconcile-payments.js
StandardOutput=journal
StandardError=journal

# /etc/systemd/system/ruptur-reconciliation.timer
[Unit]
Description=Run Ruptur reconciliation every 6 hours

[Timer]
OnBootSec=10min
OnUnitActiveSec=6h

[Install]
WantedBy=timers.target
```

Ativar:
```bash
systemctl enable ruptur-reconciliation.timer
systemctl start ruptur-reconciliation.timer
systemctl status ruptur-reconciliation.timer
```

### Script Node.js

```javascript
// scripts/reconcile-payments.js
import { BillingService } from '../modules/billing/getnet.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const billing = new BillingService({ supabase });

try {
  console.log('[Reconciliation] Iniciando...');
  
  const result = await billing.reconcilePayments({
    daysBack: 7,
    autoFix: true,
    notifyOnDifference: true,
  });

  console.log(`[Reconciliation] ✅ ${result.totalPayments} verificados, ${result.corrected.length} corrigidos`);

  // Log to file ou Slack
  if (result.discrepancies.length > 0) {
    console.warn(`[Reconciliation] ⚠️ ${result.discrepancies.length} discrepâncias detectadas!`);
    // TODO: Notificar admin
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
} catch (error) {
  console.error('[Reconciliation] ❌ Erro:', error);
  process.exit(1);
}
```

---

## 🔒 Segurança

### Implementado

✅ **Admin only**: Apenas admins podem rodar manualmente  
✅ **Audit logging**: Cada reconciliação registrada em `reconciliation_logs`  
✅ **Auto-fix apenas se**: status discrepante AND credits_granted > 0  
✅ **Erros isolados**: Falha em 1 pagamento não afeta os outros  
✅ **Idempotência**: Pode rodar múltiplas vezes sem duplicar créditos  

### Validações

```javascript
// Ignorar pagamentos muito novos (< 1h em processamento)
const ageMinutes = (Date.now() - createdAt) / 60000;
if (ageMinutes < 60) {
  skip; // Pular, pode estar em processamento
}

// Só corrigir se status diferente E credits pendentes
if (localStatus !== getnetStatus && creditsGranted > 0) {
  updateStatus();
  recreditTenant();
}
```

---

## 📊 Exemplo de Cenário

### Situação: Pagamento "perdido"

```
T=0:00    User clica "Comprar 1000 créditos"
          ↓
          POST /api/payments/create
          ↓
          Getnet recebe, payment_id = pay-123
          status = INITIATED (em processamento)

T=0:15    Webhook de Getnet: PAYMENT_APPROVED
          ↓
          Status → APPROVED
          Credits → +1000

          Mas... webhook API falha!
          Créditos NÃO foram creditados 😱
          
          Banco local: status=INITIATED, credits=0
          Getnet API: status=APPROVED

T=6:00    CRON JOB: reconciliation
          ↓
          Detecta: pay-123 local=INITIATED, getnet=APPROVED
          ↓
          Corrige: status → APPROVED
          ↓
          Re-credita: +1000 créditos ✅
          
          Log: reconciliation_logs[...] 
              discrepancies: 1
              corrected: 1

T=6:01    ✅ Usuário agora tem 1000 créditos
          Problema resolvido!
```

---

## 📈 Monitoramento

### Queries úteis

```sql
-- Últimas 10 reconciliações
SELECT * FROM reconciliation_logs
ORDER BY reconciled_at DESC
LIMIT 10;

-- Qual foi a última reconciliação?
SELECT * FROM reconciliation_logs
ORDER BY reconciled_at DESC
LIMIT 1;

-- Quantas discrepâncias em 7 dias?
SELECT SUM(discrepancy_count) as total_discrepancies
FROM reconciliation_logs
WHERE reconciled_at > NOW() - INTERVAL '7 days';

-- Ratos corrigidos
SELECT 
  DATE_TRUNC('day', reconciled_at) as dia,
  SUM(corrected_count) as total_corrigidos
FROM reconciliation_logs
GROUP BY 1
ORDER BY 1 DESC;

-- Erros ao reconciliar
SELECT * FROM reconciliation_logs
WHERE error_count > 0
ORDER BY reconciled_at DESC;
```

### Alertas recomendados

| Alerta | Condição | Ação |
|--------|----------|------|
| 🟡 Discrepâncias | > 5 em uma execução | Investigar causa raiz |
| 🔴 Muitos erros | error_count > 10 | Checar conectividade Getnet |
| 🔴 Não rodou | Última execução > 12h atrás | Checar cron job |

---

## 🧪 Testes

**Arquivo**: `test/reconciliation.test.js`  
**Status**: 8/8 passando ✅

```bash
node test/reconciliation.test.js
```

**Testes Implementados:**
1. ✅ Estrutura esperada do resultado
2. ✅ Lógica de detecção de discrepância
3. ✅ Cálculo de idade do pagamento
4. ✅ Filtro daysBack
5. ✅ Validação de statuses
6. ✅ Lógica de auto-fix com re-creditação
7. ✅ Cálculo de contadores
8. ✅ Estrutura do log de reconciliação

---

## 📧 Notificações (TODO)

Integrar com Slack/email para alertar admin:

```javascript
async function notifyReconciliationResults(result) {
  if (result.discrepancies.length > 0) {
    // Enviar Slack:
    // "⚠️ Reconciliação encontrou 3 discrepâncias"
    // "✅ 2 foram corrigidas"
    // "❌ 1 erro ao processar pay-456"
  }
}
```

---

## ✅ Checklist de Deploy

- [ ] Rodar migration `003_grace_period_cancellation.sql` (includes reconciliation_logs table)
- [ ] Criar script `scripts/reconcile-payments.js`
- [ ] Configurar cron job ou systemd timer (a cada 6h)
- [ ] Implementar endpoint `/api/admin/reconciliation`
- [ ] Testar reconciliação manual em staging
- [ ] Configurar alertas no Slack para discrepâncias
- [ ] Monitorar `reconciliation_logs` nas primeiras 24h
- [ ] Verificar que auto-fix está creditando corretamente

---

**Próxima tarefa**: Implementar testes de cenários de falha de payment (timeout, reject, duplicate)
