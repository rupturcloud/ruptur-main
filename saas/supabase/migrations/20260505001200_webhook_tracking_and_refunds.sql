-- ============================================================================
-- MIGRATION 010: Webhook Tracking + Refunds
-- Rastreamento idempotente de webhooks e suporte a chargeback/refunds
-- ============================================================================

-- 1. Tabela webhook_events para rastreamento de processamento
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  external_event_id VARCHAR(200) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  delivery_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant ON webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_external_id ON webhook_events(external_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- 2. Adicionar parent_transaction_id e refund_id a payments (se não existir)
ALTER TABLE IF EXISTS payments
ADD COLUMN IF NOT EXISTS parent_transaction_id VARCHAR(100);

ALTER TABLE IF EXISTS payments
ADD COLUMN IF NOT EXISTS refund_id UUID;

CREATE INDEX IF NOT EXISTS idx_payments_parent_transaction ON payments(parent_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_refund_id ON payments(refund_id);

-- 3. Tabela refunds para rastreamento de reembolsos
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reason VARCHAR(100) NOT NULL, -- 'chargeback', 'customer_request', 'error', etc
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'failed')),
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_tenant ON refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_original_payment ON refunds(original_payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- 4. Função para processar chargeback/refund (deduzir créditos)
DROP FUNCTION IF EXISTS process_refund(uuid, uuid, integer) CASCADE;
CREATE OR REPLACE FUNCTION process_refund(
  p_tenant_id uuid,
  p_payment_id uuid,
  p_refund_amount_cents integer
)
RETURNS TABLE (
  success boolean,
  balance_after integer,
  error_message varchar
) AS $$
DECLARE
  v_wallet_id uuid;
  v_balance_before integer;
  v_balance_after integer;
  v_refund_credits integer;
  v_current_version integer;
  v_updated_rows integer;
BEGIN
  -- 1. Encontrar wallet do tenant
  SELECT id, balance, version
  INTO v_wallet_id, v_balance_before, v_current_version
  FROM wallets
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false,
      0::integer,
      'Wallet não encontrado'::varchar;
    RETURN;
  END IF;

  -- 2. Calcular créditos a reverter (p_refund_amount_cents / 100)
  v_refund_credits := p_refund_amount_cents / 100;

  -- 3. Validar se tem saldo para reverter (pode ir negativo em caso de chargeback)
  -- Para chargeback, permitimos ir negativo (registra débito)
  v_balance_after := v_balance_before - v_refund_credits;

  -- 4. Atualizar wallet com lock otimista
  UPDATE wallets
  SET balance = v_balance_after,
      version = version + 1,
      updated_at = NOW()
  WHERE id = v_wallet_id
    AND version = v_current_version;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    RETURN QUERY SELECT
      false,
      v_balance_before,
      'Version mismatch - retry'::varchar;
    RETURN;
  END IF;

  -- 5. Registrar transação de refund
  INSERT INTO wallet_transactions (
    tenant_id, type, amount, description, reference,
    balance_before, balance_after
  ) VALUES (
    p_tenant_id, 'debit', v_refund_credits, 'Refund/Chargeback', p_payment_id::varchar,
    v_balance_before, v_balance_after
  );

  RETURN QUERY SELECT
    true,
    v_balance_after,
    NULL::varchar;
END;
$$ LANGUAGE plpgsql;

-- 5. Função para marcar webhook como processado (idempotência)
DROP FUNCTION IF EXISTS mark_webhook_processed(uuid, varchar, varchar) CASCADE;
CREATE OR REPLACE FUNCTION mark_webhook_processed(
  p_tenant_id uuid,
  p_external_event_id varchar,
  p_status varchar DEFAULT 'success'
)
RETURNS TABLE (
  success boolean,
  was_already_processed boolean
) AS $$
DECLARE
  v_event_id uuid;
  v_updated_rows integer;
BEGIN
  -- 1. Tentar encontrar event existente
  SELECT id INTO v_event_id
  FROM webhook_events
  WHERE tenant_id = p_tenant_id
    AND external_event_id = p_external_event_id
  LIMIT 1;

  -- 2. Se já existe e foi sucesso, retornar (idempotência)
  IF v_event_id IS NOT NULL THEN
    RETURN QUERY SELECT
      true,
      true; -- was_already_processed
    RETURN;
  END IF;

  -- 3. Criar novo evento (será processado depois)
  INSERT INTO webhook_events (
    tenant_id, external_event_id, event_type,
    status, payload
  ) VALUES (
    p_tenant_id, p_external_event_id, 'payment_status_update',
    p_status::varchar, '{}'::jsonb
  );

  RETURN QUERY SELECT
    true,
    false; -- not_already_processed
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para auto-atualizar updated_at em refunds
DROP TRIGGER IF EXISTS trigger_refund_updated_at ON refunds;
CREATE OR REPLACE FUNCTION update_refund_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refund_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_refund_updated_at();

-- 7. RLS para webhook_events
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_tenant_isolation ON webhook_events;
CREATE POLICY webhook_events_tenant_isolation ON webhook_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- 8. RLS para refunds
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refunds_tenant_isolation ON refunds;
CREATE POLICY refunds_tenant_isolation ON refunds
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- 9. Grants
GRANT SELECT ON webhook_events TO authenticated;
GRANT SELECT ON refunds TO authenticated;

-- ============================================================================
-- FIM DA MIGRATION 010
-- ============================================================================
