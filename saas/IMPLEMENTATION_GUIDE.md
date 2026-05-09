# Analytics & Onboarding — Guia de Implementação

**Status:** ✅ MVP Completo  
**Arquivo de Referência:** `docs/ANALYTICS_AND_ONBOARDING.md`  
**Branch:** `feat/billing-and-inbox-integration`  
**Commit:** `feat: Analytics and Onboarding System (MVP)`

---

## 1️⃣ Deploy da Migration

Aplicar a migration de database (`019_analytics_and_onboarding.sql`):

```bash
# Via Supabase CLI
supabase db push

# Ou via psql direto
psql -h $DB_HOST -U postgres -d ruptur < migrations/019_analytics_and_onboarding.sql
```

**Verifica:**
- [ ] Tabelas `analytics_events` e `onboarding_progress` criadas
- [ ] Views `analytics_funnel_metrics` e `trial_status_summary` criadas
- [ ] Índices para performance criados
- [ ] RLS policies habilitadas

---

## 2️⃣ Backend: Inicializar novo tenant

Quando um tenant é criado (SignUp.jsx ou admin), chamar:

```javascript
// Em routes-users.mjs ou endpoint de signup
import { OnboardingService } from '../modules/billing/onboarding.service.js';

const onboardingService = new OnboardingService(supabase);

async function handleNewTenant(tenantId) {
  // Inicializar onboarding (5 passos)
  await onboardingService.initializeProgress(tenantId);
  
  // Rastrear evento de signup
  const analyticsService = new AnalyticsService(supabase);
  await analyticsService.track('signup', {
    tenantId,
    userId: user.id,
  });
}
```

---

## 3️⃣ Frontend: Integrar no Dashboard

### TrialBanner no topo

**Arquivo:** `web/client-area/src/components/DashboardLayout.jsx`

```jsx
import TrialBanner from './TrialBanner';

export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard-layout">
      <TrialBanner />  {/* ← Adicionar aqui */}
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

### OnboardingDashboard na rota

**Arquivo:** `web/client-area/src/App.jsx`

```jsx
import OnboardingDashboard from './pages/OnboardingDashboard';

// Adicionar rota
<Route path="/onboarding" element={<OnboardingDashboard />} />
```

---

## 4️⃣ Rastrear eventos de negócio

Integrar `analyticsService.track()` nos pontos-chave:

### 4.1 Quando usuário vê planos

**Arquivo:** `pages/Billing.jsx` ou similar

```javascript
import { AnalyticsService } from '../services/analytics';

useEffect(() => {
  // Rastrear que visitou página de planos
  analyticsService.track('plan_viewed', {
    tenantId,
    planId: 'starter', // se filtrado
  });
}, []);
```

### 4.2 Quando inicia checkout

**Arquivo:** `components/CheckoutModal.jsx`

```javascript
const handleCheckoutStart = async () => {
  await analyticsService.track('checkout_start', {
    tenantId,
    planId: selectedPlan.id,
    amount: selectedPlan.price * 100, // centavos
    currency: 'BRL',
  });
  
  // ... prosseguir com checkout
};
```

### 4.3 Quando pagamento é concluído

**Arquivo:** `modules/billing/routes-billing.mjs`

```javascript
// Após sucesso de pagamento
await analyticsService.track('checkout_complete', {
  tenantId,
  planId: payment.plan_id,
  amount: payment.amount_cents,
  currency: payment.currency,
});
```

### 4.4 Quando upgrade é feito

```javascript
await analyticsService.track('upgrade', {
  tenantId,
  fromPlan: currentPlan.id,
  toPlan: newPlan.id,
  amount: newPlan.price * 100,
});
```

---

## 5️⃣ Completar passos de onboarding

Integrar chamadas para `completeStep()`:

### Step 1: Email verificado

```javascript
// Em algum endpoint de email verification
await onboardingService.completeStep(tenantId, 1);
```

### Step 2: Instância criada

**Arquivo:** `modules/instances/service.js`

```javascript
// Após criar instância
await onboardingService.completeStep(tenantId, 2, {
  instanceId: newInstance.id,
  provider: 'uazapi',
});
```

### Step 3: Campanha de teste enviada

**Arquivo:** `modules/campaigns/service.js`

```javascript
// Após enviar campanha de teste
await onboardingService.completeStep(tenantId, 3, {
  campaignId: testCampaign.id,
});
```

### Step 4: Time convidado

**Arquivo:** `modules/tenants/invites.js`

```javascript
// Após primeiro convite enviado
const invitedCount = await countInvitedUsers(tenantId);
if (invitedCount > 0) {
  await onboardingService.completeStep(tenantId, 4);
}
```

### Step 5: Upgrade feito

```javascript
// Após confirmação de pagamento
await onboardingService.completeStep(tenantId, 5, {
  planId: newPlan.id,
  transactionId: payment.id,
});
```

---

## 6️⃣ Dashboard de Analytics (opcional — future)

Criar página `/dashboard/analytics` para superadmin:

```javascript
// Endpoints já disponíveis para usar:
GET /api/analytics/dashboard?tenantId=...
GET /api/analytics/conversion?tenantId=...
GET /api/analytics/events?tenantId=...

// Dados agregados por view:
SELECT * FROM analytics_funnel_metrics;
SELECT * FROM trial_status_summary WHERE days_remaining <= 7;
```

---

## 7️⃣ Trial Warning Automation (optional)

Criar job cron (7 dias antes de trial expirar):

```javascript
// Cron job (ex: Bull, node-cron)
async function sendTrialWarnings() {
  const expiringToday = await onboardingService.getTrialsExpiringToday();
  
  for (const tenant of expiringToday) {
    // Enviar email
    await sendEmail({
      to: tenant.email,
      subject: 'Your Ruptur trial expires in X days',
      template: 'trial-warning',
      data: tenant,
    });
    
    // Rastrear evento
    await analyticsService.track('trial_warning', {
      tenantId: tenant.tenant_id,
      daysRemaining: tenant.days_remaining,
    });
  }
}

// Agendar para rodar todo dia às 9 AM
schedule('0 9 * * *', sendTrialWarnings);
```

---

## ✅ Checklist de Integração

- [ ] Migration `019` aplicada no Supabase
- [ ] `AnalyticsService` inicializado em `gateway.mjs`
- [ ] `OnboardingService` inicializado em `gateway.mjs`
- [ ] `TrialBanner` integrado em `DashboardLayout`
- [ ] `OnboardingDashboard` rota adicionada
- [ ] `analyticsService.track()` em: signup, plan_viewed, checkout_start, checkout_complete, upgrade
- [ ] `onboardingService.completeStep()` em: email verify, instance create, campaign test, invite sent, upgrade done
- [ ] Testes passando: `npm test -- analytics-onboarding`
- [ ] Build sem erros: `npm run build`
- [ ] Documentation lida: `docs/ANALYTICS_AND_ONBOARDING.md`

---

## 🔍 Verificação

Depois de integrar, testar:

```bash
# 1. Health check
curl http://localhost:3001/api/local/health

# 2. Rastrear evento
curl -X POST http://localhost:3001/api/analytics/track \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "signup",
    "properties": { "tenantId": "test-123" }
  }'

# 3. Obter progresso
curl "http://localhost:3001/api/onboarding/progress?tenantId=test-123" \
  -H "Authorization: Bearer TOKEN"

# 4. Dashboard metrics
curl "http://localhost:3001/api/analytics/dashboard?tenantId=test-123" \
  -H "Authorization: Bearer TOKEN"
```

---

## 🎯 Fluxo Esperado (Exemplo)

```
1. Usuário faz signup
   → OnboardingService.initializeProgress()
   → AnalyticsService.track('signup')
   → Progress: 1/5 (Email)

2. Email verificado
   → OnboardingService.completeStep(1)
   → Progress: 2/5 (Instância)

3. Cria instância WhatsApp
   → OnboardingService.completeStep(2)
   → AnalyticsService.track('plan_viewed')
   → Progress: 3/5 (Campanha)

4. Envia campanha de teste
   → OnboardingService.completeStep(3)
   → AnalyticsService.track('checkout_start')
   → Progress: 4/5 (Time)

5. Convidou alguém
   → OnboardingService.completeStep(4)
   → Progress: 5/5 (Upgrade)

6. Fez upgrade de plano
   → OnboardingService.completeStep(5)
   → AnalyticsService.track('upgrade')
   → Progress: 100% ✅ COMPLETED

7. Dashboard mostra:
   - Trial → Paid conversion: 100%
   - ARPU: R$ 99
   - Days to paid: 3
```

---

## 📞 Suporte

Referências:
- Migration schema: `migrations/019_analytics_and_onboarding.sql`
- Services API: `docs/ANALYTICS_AND_ONBOARDING.md`
- Componentes: `web/client-area/src/pages/OnboardingDashboard.jsx`
- Testes: `__tests__/analytics-onboarding.test.js`

---

**✅ Ready to integrate!**
