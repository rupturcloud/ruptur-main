/**
 * Migration 019: Analytics e Onboarding
 * Tabelas para rastreamento de eventos analytics e progresso de onboarding
 *
 * Tabelas:
 * - analytics_events: rastreamento de eventos do funil (signup, plan_viewed, checkout, etc)
 * - onboarding_progress: progresso de onboarding por tenant (5 passos)
 *
 * Índices para performance em queries agregadas e dashboards em tempo real
 */

-- ========================================
-- 1. Tabela analytics_events
-- ========================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  -- Tipos de eventos suportados:
  -- signup: novo usuário criado
  -- plan_viewed: usuário visitou página de planos
  -- checkout_start: iniciou checkout/pagamento
  -- checkout_complete: completou pagamento com sucesso
  -- upgrade: fez upgrade de plano
  -- trial_warning: aviso de trial expirando
  -- trial_expired: trial expirou
  -- churn: cancelou assinatura

  properties JSONB DEFAULT '{}',
  -- Propriedades customizáveis (planId, amount, provider, etc)
  -- Ex: {"planId": "starter", "amount": 99, "currency": "BRL"}

  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent VARCHAR(500),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_id ON analytics_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_event ON analytics_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_created ON analytics_events(tenant_id, created_at DESC);

-- Índice para JSONB properties (para queries em tempo real)
CREATE INDEX IF NOT EXISTS idx_analytics_events_properties ON analytics_events USING GIN(properties);

-- ========================================
-- 2. Tabela onboarding_progress
-- ========================================
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

  -- Passo atual (1-5)
  current_step SMALLINT DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 5),

  -- Rastreamento de conclusão de cada passo
  -- Estrutura: {"1": {"completed": true, "completedAt": "2026-05-08T..."}...}
  steps_progress JSONB DEFAULT jsonb_build_object(
    '1', jsonb_build_object('completed', false, 'completedAt', null),
    '2', jsonb_build_object('completed', false, 'completedAt', null),
    '3', jsonb_build_object('completed', false, 'completedAt', null),
    '4', jsonb_build_object('completed', false, 'completedAt', null),
    '5', jsonb_build_object('completed', false, 'completedAt', null)
  ),

  -- Datas importantes
  trial_starts_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + interval '7 days'),

  -- Status de onboarding
  status VARCHAR(50) DEFAULT 'in_progress',
  -- Valores: in_progress, completed, abandoned, paused

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_tenant ON onboarding_progress(tenant_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_status ON onboarding_progress(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_trial_ends ON onboarding_progress(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_current_step ON onboarding_progress(current_step);

-- ========================================
-- 3. View agregada: analytics_funnel_metrics
-- ========================================
-- Retorna métricas de conversão do funil para cada tenant
CREATE OR REPLACE VIEW analytics_funnel_metrics AS
SELECT
  tenant_id,
  COUNT(DISTINCT CASE WHEN event_type = 'signup' THEN user_id END) AS total_signups,
  COUNT(DISTINCT CASE WHEN event_type = 'plan_viewed' THEN user_id END) AS plan_views,
  COUNT(DISTINCT CASE WHEN event_type = 'checkout_start' THEN user_id END) AS checkout_starts,
  COUNT(DISTINCT CASE WHEN event_type = 'checkout_complete' THEN user_id END) AS checkout_completes,
  COUNT(DISTINCT CASE WHEN event_type = 'upgrade' THEN user_id END) AS upgrades,

  -- Taxas de conversão
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN event_type = 'plan_viewed' THEN user_id END) /
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'signup' THEN user_id END), 0),
    2
  ) AS signup_to_plan_view_rate,

  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN event_type = 'checkout_start' THEN user_id END) /
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'plan_viewed' THEN user_id END), 0),
    2
  ) AS plan_view_to_checkout_rate,

  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN event_type = 'checkout_complete' THEN user_id END) /
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'checkout_start' THEN user_id END), 0),
    2
  ) AS checkout_completion_rate,

  -- Taxa trial → paid
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN event_type = 'upgrade' THEN user_id END) /
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'signup' THEN user_id END), 0),
    2
  ) AS trial_to_paid_conversion_rate,

  MIN(created_at) AS first_event_at,
  MAX(created_at) AS last_event_at
FROM analytics_events
GROUP BY tenant_id;

-- ========================================
-- 4. View: trial_status_summary
-- ========================================
-- Resumo de status de trial e progresso de onboarding
CREATE OR REPLACE VIEW trial_status_summary AS
SELECT
  op.tenant_id,
  op.current_step,
  op.trial_starts_at,
  op.trial_ends_at,
  EXTRACT(DAY FROM op.trial_ends_at - NOW())::INTEGER AS days_remaining,
  CASE
    WHEN EXTRACT(DAY FROM op.trial_ends_at - NOW()) <= 0 THEN 'expired'
    WHEN EXTRACT(DAY FROM op.trial_ends_at - NOW()) <= 1 THEN 'expiring_today'
    WHEN EXTRACT(DAY FROM op.trial_ends_at - NOW()) <= 2 THEN 'critical_warning'
    WHEN EXTRACT(DAY FROM op.trial_ends_at - NOW()) <= 7 THEN 'warning'
    ELSE 'active'
  END AS trial_status,
  op.status AS onboarding_status,
  (op.steps_progress -> '1' ->> 'completed')::BOOLEAN AS step1_completed,
  (op.steps_progress -> '2' ->> 'completed')::BOOLEAN AS step2_completed,
  (op.steps_progress -> '3' ->> 'completed')::BOOLEAN AS step3_completed,
  (op.steps_progress -> '4' ->> 'completed')::BOOLEAN AS step4_completed,
  (op.steps_progress -> '5' ->> 'completed')::BOOLEAN AS step5_completed,
  -- Progresso: quantos passos completados
  (
    (CASE WHEN (op.steps_progress -> '1' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END) +
    (CASE WHEN (op.steps_progress -> '2' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END) +
    (CASE WHEN (op.steps_progress -> '3' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END) +
    (CASE WHEN (op.steps_progress -> '4' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END) +
    (CASE WHEN (op.steps_progress -> '5' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END)
  ) AS completed_steps_count,
  ROUND(
    100.0 * (
      (CASE WHEN (op.steps_progress -> '1' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END) +
      (CASE WHEN (op.steps_progress -> '2' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END) +
      (CASE WHEN (op.steps_progress -> '3' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END) +
      (CASE WHEN (op.steps_progress -> '4' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END) +
      (CASE WHEN (op.steps_progress -> '5' ->> 'completed')::BOOLEAN THEN 1 ELSE 0 END)
    ) / 5.0,
    0
  ) AS progress_percentage
FROM onboarding_progress op;

-- ========================================
-- 5. RLS Policies
-- ========================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver analytics_events do seu tenant
CREATE POLICY "Users can view analytics of their tenant" ON analytics_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenants
      WHERE id = tenant_id AND EXISTS (
        SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = tenants.id
        AND tenant_users.user_id = auth.uid()
      )
    )
  );

-- Política: apenas serviço backend pode inserir analytics_events
CREATE POLICY "Service can insert analytics events" ON analytics_events
  FOR INSERT WITH CHECK (true);

-- Política: usuários podem ver onboarding_progress do seu tenant
CREATE POLICY "Users can view onboarding progress of their tenant" ON onboarding_progress
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenants
      WHERE id = tenant_id AND EXISTS (
        SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = tenants.id
        AND tenant_users.user_id = auth.uid()
      )
    )
  );

-- Política: apenas serviço backend pode atualizar onboarding_progress
CREATE POLICY "Service can update onboarding progress" ON onboarding_progress
  FOR UPDATE USING (true);

CREATE POLICY "Service can insert onboarding progress" ON onboarding_progress
  FOR INSERT WITH CHECK (true);

-- ========================================
-- 6. Função trigger: atualizar updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_onboarding_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_onboarding_progress_updated_at
BEFORE UPDATE ON onboarding_progress
FOR EACH ROW
EXECUTE FUNCTION update_onboarding_progress_updated_at();
