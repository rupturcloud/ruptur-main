# Analytics & Onboarding — Guia de Integração

## 📊 Visão Geral

Sistema completo de analytics e onboarding para rastrear a jornada do usuário (trial → paid).

- **Analytics Service**: Rastreamento de eventos (signup, plan_viewed, checkout, upgrade)
- **Onboarding Service**: 5 passos (Email → Instância → Campanha → Time → Upgrade)
- **Trial Countdown**: Banners dinâmicos com alertas por dias restantes
- **Dashboard**: Métricas de conversão, ARPU, churn em tempo real

---

## 🗄️ Database

### Migration: `019_analytics_and_onboarding.sql`

**Tabelas criadas:**
- `analytics_events` — Log de eventos do funil
- `onboarding_progress` — Status do onboarding por tenant

**Views:**
- `analytics_funnel_metrics` — Métricas de conversão agregadas
- `trial_status_summary` — Status de trial + onboarding

**Aplicar:**
```bash
supabase db push
# ou
psql -h db-host -U postgres -d ruptur < migrations/019_analytics_and_onboarding.sql
```

---

## 🚀 Backend: Services

### AnalyticsService

**Localização:** `modules/billing/analytics.service.js`

**Métodos principais:**

```javascript
// Rastrear evento
await analyticsService.track('signup', {
  tenantId: 'tenant-123',
  userId: 'user-456',
  planId: 'starter',
  amount: 9900, // centavos
  currency: 'BRL'
});

// Obter métricas de conversão
const metrics = await analyticsService.getConversionMetrics(tenantId);
// Retorna: signups, plan_views, checkout_starts, conversion_rates

// Obter ARPU
const arpu = await analyticsService.getARPUMetrics(tenantId);
// Retorna: totalRevenue, arpu, averageTransactionValue

// Dashboard completo
const dashboard = await analyticsService.getDashboardMetrics(tenantId);
```

**Tipos de evento suportados:**
- `signup` — Novo usuário criado
- `plan_viewed` — Visitou página de planos
- `checkout_start` — Iniciou checkout
- `checkout_complete` — Pagamento bem-sucedido
- `upgrade` — Fez upgrade de plano
- `trial_warning` — Aviso de trial expirando
- `trial_expired` — Trial expirou
- `churn` — Cancelou assinatura

### OnboardingService

**Localização:** `modules/billing/onboarding.service.js`

**5 Passos definidos:**

| # | Nome | Descrição | Analytics |
|---|------|-----------|-----------|
| 1 | Verificar Email | Confirmar email | `signup` |
| 2 | Criar Instância | Criar WhatsApp | `plan_viewed` |
| 3 | Testar Campanha | Enviar teste | `checkout_start` |
| 4 | Convidar Time | Convidar colega | `checkout_start` |
| 5 | Upgrade | Escolher plano | `upgrade` |

**Métodos principais:**

```javascript
// Inicializar onboarding (novo tenant)
await onboardingService.initializeProgress(tenantId);

// Obter progresso
const progress = await onboardingService.getProgress(tenantId);
// Retorna: currentStep, steps[], progressPercentage, trial info

// Completar um step
await onboardingService.completeStep(tenantId, 2, { metadata: {} });
// Atualiza progresso + rastreia analytics

// Status do trial
const trialStatus = await onboardingService.getTrialStatus(tenantId);
// Retorna: daysRemaining, alertLevel, completedSteps, etc

// Obter trials expirando hoje
const expiring = await onboardingService.getTrialsExpiringToday();
```

---

## 🔌 API Endpoints

Registrados em `api/gateway.mjs`

### Analytics

#### POST `/api/analytics/track`
Rastrear evento

```bash
curl -X POST http://localhost:3001/api/analytics/track \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "signup",
    "properties": {
      "tenantId": "tenant-123",
      "planId": "starter"
    }
  }'
```

**Resposta:**
```json
{
  "ok": true,
  "event": { "id": "evt-456", "created_at": "..." }
}
```

#### GET `/api/analytics/dashboard?tenantId=...`
Obter dashboard completo

```bash
curl http://localhost:3001/api/analytics/dashboard?tenantId=tenant-123 \
  -H "Authorization: Bearer TOKEN"
```

**Resposta:**
```json
{
  "tenantId": "tenant-123",
  "conversion": {
    "totalSignups": 100,
    "checkoutCompletes": 25,
    "trialToPaidConversionRate": 25
  },
  "revenue": {
    "totalRevenue": 2500,
    "arpu": 25,
    "transactionCount": 10
  },
  "churn": {
    "churnRate": 5
  }
}
```

#### GET `/api/analytics/conversion?tenantId=...`
Métricas de conversão

#### GET `/api/analytics/events?tenantId=...&eventType=signup&limit=100`
Histórico de eventos

### Onboarding

#### GET `/api/onboarding/progress?tenantId=...`
Obter progresso

```json
{
  "tenantId": "tenant-123",
  "currentStep": 2,
  "progressPercentage": 40,
  "steps": [
    {
      "id": 1,
      "name": "Verificar Email",
      "completed": true,
      "completedAt": "2026-05-08T10:00:00Z"
    },
    // ...
  ],
  "trialEndsAt": "2026-05-15T00:00:00Z"
}
```

#### POST `/api/onboarding/complete-step`
Completar um step

```bash
curl -X POST http://localhost:3001/api/onboarding/complete-step \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-123",
    "stepId": 2,
    "metadata": { "instanceId": "inst-789" }
  }'
```

#### GET `/api/onboarding/trial-status?tenantId=...`
Status do trial

```json
{
  "trialStatus": "warning",
  "daysRemaining": 2,
  "completedSteps": 2,
  "progressPercentage": 40
}
```

---

## 🎨 Frontend: Componentes React

### OnboardingDashboard.jsx

**Localização:** `web/client-area/src/pages/OnboardingDashboard.jsx`

Exibe:
- Progress bar (0-100%)
- Trial countdown com alerta
- 5 cards de passos
- Botões de ação por step

**Uso:**
```jsx
import OnboardingDashboard from './pages/OnboardingDashboard';

// No Dashboard principal
<OnboardingDashboard />
```

**Props:** Usa `useAuth()` e `tenantId` do contexto

### TrialBanner.jsx

**Localização:** `web/client-area/src/components/TrialBanner.jsx`

Sticky banner no topo com:
- Alertas dinâmicas: info (4+ dias) → warning (2-3 dias) → critical (≤1 dia)
- CTA "Fazer Upgrade"
- Progress bar visual

**Uso:**
```jsx
import TrialBanner from './components/TrialBanner';

// No layout principal (dashboard)
<TrialBanner />
<DashboardContent />
```

**Lógica de alerta:**
```
Dia 1-6:  Info (azul)      → "Trial disponível por X dias"
Dia 7:    Warning (amarelo) → "Trial expira em 1-2 dias"
Dia 8+:   Critical (vermelho) → "Trial expirado! Upgrade agora"
```

---

## 📈 Exemplo: Fluxo Completo de Onboarding

### 1. Novo usuário se registra
```javascript
// Backend: trigger na signup
const progress = await onboardingService.initializeProgress(newTenant.id);
// Rastreia analytics: 'signup'
```

### 2. Dashboard exibe progresso
```jsx
<OnboardingDashboard />
// Mostra: "Passo 1 de 5 - Verificar Email"
```

### 3. Usuário cria instância WhatsApp
```javascript
// No endpoint de criar instância
await onboardingService.completeStep(tenantId, 2);
// Rastreia: 'plan_viewed'
// Atualiza: currentStep → 3
```

### 4. Usuário vê banner de trial
```jsx
<TrialBanner />
// "Trial expira em 5 dias | 40% do onboarding concluído"
```

### 5. Usuário faz upgrade
```javascript
await onboardingService.completeStep(tenantId, 5);
// Rastreia: 'upgrade'
// Status: 'completed' ✅
```

### 6. Dashboard exibe métricas
```javascript
const metrics = await analyticsService.getDashboardMetrics(tenantId);
// Conversão trial → paid: 100%
// ARPU: R$ 99,00
```

---

## 🧪 Testes

**Arquivo:** `__tests__/analytics-onboarding.test.js`

**Executar:**
```bash
npm test -- analytics-onboarding
```

**Cobre:**
- ✅ Rastreamento de eventos
- ✅ Cálculo de métricas
- ✅ Progresso de passos
- ✅ Lógica de trial countdown
- ✅ Validação de entrada

---

## ⚙️ Configuração

### Gateway (api/gateway.mjs)

Services já inicializados:
```javascript
const analyticsService = supabase ? new AnalyticsService(supabase) : null;
const onboardingService = supabase ? new OnboardingService(supabase) : null;
```

### Environment

Nenhuma nova variável de environment necessária (usa Supabase existente).

---

## 🔒 Segurança

- ✅ RLS policies habilitadas
- ✅ Validação de tenantId em todas as rotas
- ✅ Usuários veem apenas dados do seu tenant
- ✅ Rastreamento automático de IP + user agent (opcional)

---

## 📊 Queries Úteis

### Top 10 tenants por taxa de conversão
```sql
SELECT
  tenant_id,
  trial_to_paid_conversion_rate,
  total_signups
FROM analytics_funnel_metrics
ORDER BY trial_to_paid_conversion_rate DESC
LIMIT 10;
```

### Tenants com trial expirando hoje
```sql
SELECT
  tenant_id,
  days_remaining,
  trial_status,
  progress_percentage
FROM trial_status_summary
WHERE days_remaining <= 1
ORDER BY trial_ends_at ASC;
```

### Receita por período
```sql
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(DISTINCT tenant_id) as transactions,
  SUM((properties->>'amount')::integer) / 100 as revenue_brl
FROM analytics_events
WHERE event_type IN ('checkout_complete', 'upgrade')
GROUP BY day
ORDER BY day DESC;
```

---

## 🚨 Troubleshooting

### "Analytics não configurado"
- Verificar Supabase connection em `gateway.mjs`
- Verificar migration `019` foi aplicada

### Trial status retorna "not_found"
- Chamar `/api/onboarding/progress` primeiro para inicializar
- Verificar `onboarding_progress` table está criada

### Eventos não aparecem em dashboard
- Verificar RLS policies de `analytics_events`
- Confirmar `tenantId` está sendo passado

---

## 📝 Próximos Passos

- [ ] Email automático 7 dias antes de trial expirar
- [ ] Webhook para checkout → analytics track
- [ ] Segment.com / Amplitude integration (opcional)
- [ ] Dashboard de analytics para admin (superadmin)
- [ ] Exportar relatório CSV de métricas
- [ ] A/B testing framework para onboarding
