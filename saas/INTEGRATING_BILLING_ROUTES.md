# Integração das Rotas de Billing (Semana 3)

## O que fazer

Você precisa adicionar as seguintes funcionalidades ao `api/gateway.mjs`:

### 1. Imports (no topo do arquivo)

```javascript
import { WebhookService } from '../modules/billing/webhook.service.js';
import { MetricsService } from '../modules/billing/metrics.service.js';
import { AuditService } from '../modules/billing/audit.service.js';
import * as billingRoutes from './routes-billing.mjs';
```

### 2. Inicializar Services (após criar `supabase` client)

```javascript
const webhookService = supabase ? new WebhookService(supabase, null) : null;
const metricsService = supabase ? new MetricsService(supabase, null) : null;
const auditService = supabase ? new AuditService(supabase) : null;
```

### 3. Adicionar Rotas (no switch de rotas, antes do 404)

Substitua a rota POST `/api/webhooks/getnet` existente:

```javascript
// --- Webhooks: Processar eventos da adquirente ---
if (pathname === '/api/webhooks/getnet' && req.method === 'POST') {
  const handled = await billingRoutes.handleWebhookGetnet(
    req, res, webhookService, auditService, pathname, json
  );
  if (handled === false) return; // Rota manipulada
}

// --- Webhooks: Histórico ---
if (pathname === '/api/billing/webhooks' && req.method === 'GET') {
  const user = await extractUser(req);
  if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
  const tenantId = user.currentTenantId;
  return billingRoutes.getWebhookHistory(req, res, webhookService, tenantId, json);
}

// --- Refunds: Histórico ---
if (pathname === '/api/billing/refunds' && req.method === 'GET') {
  const user = await extractUser(req);
  if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
  const tenantId = user.currentTenantId;
  return billingRoutes.getRefundHistory(req, res, webhookService, tenantId, json);
}

// --- Metrics: Estatísticas ---
if (pathname === '/api/billing/metrics/stats' && req.method === 'GET') {
  const user = await extractUser(req);
  if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
  const tenantId = user.currentTenantId;
  return billingRoutes.getMetricsStats(req, res, metricsService, tenantId, json);
}

// --- Billing: Health Check ---
if (pathname === '/api/billing/health' && req.method === 'GET') {
  const user = await extractUser(req);
  if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
  const tenantId = user.currentTenantId;
  return billingRoutes.getHealthCheck(req, res, metricsService, tenantId, json);
}

// --- Billing: Auditoria ---
if (pathname === '/api/billing/audit' && req.method === 'GET') {
  const user = await extractUser(req);
  if (!user) return json(res, 401, { error: 'Não autenticado' }, req);
  const tenantId = user.currentTenantId;
  return billingRoutes.getAuditReport(req, res, metricsService, tenantId, json);
}
```

## Endpoints Disponíveis

### Webhooks
- **POST** `/api/webhooks/getnet` - Receber webhooks da Getnet
- **GET** `/api/billing/webhooks` - Histórico de webhooks processados
- **GET** `/api/billing/refunds` - Histórico de refunds/chargebacks

### Métricas & Health
- **GET** `/api/billing/metrics/stats` - Estatísticas de webhooks e pagamentos
- **GET** `/api/billing/health` - Status de saúde do sistema
- **GET** `/api/billing/audit` - Relatório de auditoria

## Testes Após Integração

```bash
# Testar webhook
curl -X POST http://localhost:3001/api/webhooks/getnet \
  -H "Content-Type: application/json" \
  -d '{"external_event_id":"test_123", "event_type":"payment_status_update", "tenant_id":"[uuid]"}'

# Testar histórico (autenticado)
curl -X GET http://localhost:3001/api/billing/webhooks \
  -H "Authorization: Bearer [jwt_token]"

# Testar métricas
curl -X GET http://localhost:3001/api/billing/metrics/stats \
  -H "Authorization: Bearer [jwt_token]"
```

## Status

- ✅ Services implementados (WebhookService, MetricsService)
- ✅ Rotas criadas em `routes-billing.mjs`
- ⏳ Integração no gateway.mjs (você completa)
- ✅ Migrations executadas
- ⚠️ Testes passando (22/39)

## Próximo Passo

Após integrar as rotas no `api/gateway.mjs`, você pode testar chamando os endpoints acima com um token JWT válido.
