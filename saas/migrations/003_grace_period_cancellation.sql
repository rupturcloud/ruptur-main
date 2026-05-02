/**
 * Migration 003: Grace Period para Cancelamento de Assinatura
 *
 * Adiciona suporte a cancelamento com período de graça de 24h:
 * - Usuario marca assinatura para cancelamento
 * - Sistema marca como pending_cancellation + grace_period_until
 * - Após 24h, processo automático confirma cancelamento
 * - Usuario pode desistir durante o período de graça
 *
 * Execução:
 * 1. Copie todo o SQL abaixo
 * 2. Acesse Supabase > SQL Editor
 * 3. Cole e execute
 */

-- ============================================================================
-- 1. ADICIONAR COLUNAS À TABELA subscriptions
-- ============================================================================

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS pending_cancellation BOOLEAN DEFAULT FALSE;

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMP WITH TIME ZONE;

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Index para queries de cancelamentos pendentes
CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_cancellation
ON subscriptions(pending_cancellation, grace_period_until)
WHERE pending_cancellation = TRUE;

-- ============================================================================
-- 2. CRIAR TABELA DE LOG DE CANCELAMENTOS
-- Para auditoria e histórico de tentativas
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_cancellation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'requested', 'cancelled', 'resumed', 'auto_cancelled'
  grace_period_until TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_logs_subscription_id
ON subscription_cancellation_logs(subscription_id);

CREATE INDEX IF NOT EXISTS idx_cancellation_logs_tenant_id
ON subscription_cancellation_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_cancellation_logs_action
ON subscription_cancellation_logs(action);

-- ============================================================================
-- 3. FUNÇÃO: Cancelar com Grace Period
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_subscription_with_grace_period(
  p_subscription_id UUID,
  p_reason TEXT DEFAULT 'User requested'
)
RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
  v_grace_period_until TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Buscar assinatura
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Subscription not found'
    );
  END IF;

  -- Grace period: 24h a partir de agora
  v_grace_period_until := NOW() + INTERVAL '24 hours';

  -- Marcar como pending_cancellation
  UPDATE subscriptions
  SET
    pending_cancellation = TRUE,
    grace_period_until = v_grace_period_until,
    cancellation_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_subscription_id;

  -- Registrar na auditoria
  INSERT INTO subscription_cancellation_logs
  (subscription_id, tenant_id, action, grace_period_until, reason)
  VALUES
  (p_subscription_id, v_subscription.tenant_id, 'requested', v_grace_period_until, p_reason);

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Cancellation scheduled with 24h grace period',
    'subscription_id', p_subscription_id,
    'grace_period_until', v_grace_period_until,
    'can_be_resumed_until', v_grace_period_until
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. FUNÇÃO: Resumir Assinatura (Desistir do Cancelamento)
-- ============================================================================

CREATE OR REPLACE FUNCTION resume_subscription(
  p_subscription_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  -- Buscar assinatura
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Subscription not found'
    );
  END IF;

  -- Validar se está com cancelamento pendente
  IF NOT v_subscription.pending_cancellation THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Subscription is not pending cancellation'
    );
  END IF;

  -- Validar se ainda está dentro do grace period
  IF v_subscription.grace_period_until < NOW() THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Grace period has expired. Subscription already cancelled.'
    );
  END IF;

  -- Resumir (remover marcação de cancelamento)
  UPDATE subscriptions
  SET
    pending_cancellation = FALSE,
    grace_period_until = NULL,
    cancellation_reason = NULL,
    updated_at = NOW()
  WHERE id = p_subscription_id;

  -- Registrar na auditoria
  INSERT INTO subscription_cancellation_logs
  (subscription_id, tenant_id, action, reason)
  VALUES
  (p_subscription_id, v_subscription.tenant_id, 'resumed', 'User cancelled the cancellation request');

  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Subscription resumed successfully',
    'subscription_id', p_subscription_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNÇÃO: Processar Cancelamentos Expirados
-- Chamada por cron job ou manually
-- ============================================================================

CREATE OR REPLACE FUNCTION process_expired_grace_periods()
RETURNS TABLE (
  processed_count INTEGER,
  failed_count INTEGER,
  details JSONB
) AS $$
DECLARE
  v_processed INTEGER := 0;
  v_failed INTEGER := 0;
  v_subscription RECORD;
  v_details JSONB := '[]'::jsonb;
BEGIN
  -- Buscar todas as assinaturas com grace period expirado
  FOR v_subscription IN
    SELECT * FROM subscriptions
    WHERE pending_cancellation = TRUE
    AND grace_period_until < NOW()
  LOOP
    BEGIN
      -- Atualizar status para cancelled
      UPDATE subscriptions
      SET
        status = 'cancelled',
        cancelled_at = NOW(),
        pending_cancellation = FALSE,
        grace_period_until = NULL,
        updated_at = NOW()
      WHERE id = v_subscription.id;

      -- Atualizar tenant (voltar para trial)
      UPDATE tenants
      SET
        plan = 'trial',
        monthly_credits = 0,
        getnet_subscription_id = NULL
      WHERE id = v_subscription.tenant_id;

      -- Registrar na auditoria
      INSERT INTO subscription_cancellation_logs
      (subscription_id, tenant_id, action, reason)
      VALUES
      (v_subscription.id, v_subscription.tenant_id, 'auto_cancelled', 'Grace period expired');

      v_processed := v_processed + 1;
      v_details := v_details || jsonb_build_object(
        'subscription_id', v_subscription.id,
        'tenant_id', v_subscription.tenant_id,
        'status', 'processed'
      );

    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_details := v_details || jsonb_build_object(
        'subscription_id', v_subscription.id,
        'status', 'error',
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_failed, v_details;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. TABELA: reconciliation_logs
-- Log de cada reconciliação financeira executada
-- ============================================================================

CREATE TABLE IF NOT EXISTS reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  days_back INTEGER NOT NULL,
  total_checked INTEGER NOT NULL,
  matched_count INTEGER NOT NULL,
  discrepancy_count INTEGER NOT NULL,
  corrected_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  auto_fix_enabled BOOLEAN DEFAULT TRUE,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_reconciled_at
ON reconciliation_logs(reconciled_at);

CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_discrepancy_count
ON reconciliation_logs(discrepancy_count)
WHERE discrepancy_count > 0;

-- ============================================================================
-- 7. PERMISSÕES
-- ============================================================================

GRANT EXECUTE ON FUNCTION cancel_subscription_with_grace_period TO authenticated;
GRANT EXECUTE ON FUNCTION resume_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION process_expired_grace_periods TO authenticated;

-- ============================================================================
-- FIM DA MIGRATION 003
-- ============================================================================
