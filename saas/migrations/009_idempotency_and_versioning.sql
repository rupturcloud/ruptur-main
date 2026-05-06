-- ============================================================================
-- MIGRATION 009: Idempotência + Lock Otimista
-- Adiciona suporte para idempotência em payments e versionamento em wallets
-- ============================================================================

-- 1. Adicionar idempotency_key a payments
ALTER TABLE IF EXISTS payments
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key);

-- 2. Adicionar version a wallets para lock otimista
DO $$
BEGIN
  IF to_regclass('public.wallets') IS NOT NULL THEN
    ALTER TABLE public.wallets
    ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_wallets_version ON public.wallets(version);
  ELSE
    RAISE NOTICE 'Tabela public.wallets não existe; etapa de versionamento de wallets ignorada.';
  END IF;
END $$;

-- 3. Trigger para auto-incrementar version ao atualizar wallet
DROP FUNCTION IF EXISTS increment_wallet_version() CASCADE;
CREATE OR REPLACE FUNCTION increment_wallet_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regclass('public.wallets') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trigger_increment_wallet_version ON public.wallets;
    CREATE TRIGGER trigger_increment_wallet_version
      BEFORE UPDATE ON public.wallets
      FOR EACH ROW
      WHEN (OLD.balance IS DISTINCT FROM NEW.balance)
      EXECUTE FUNCTION increment_wallet_version();
  ELSE
    RAISE NOTICE 'Tabela public.wallets não existe; trigger de versionamento ignorado.';
  END IF;
END $$;

-- 4. Tabela webhook_delivery_log para idempotência de webhooks
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  external_event_id VARCHAR(200) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  delivery_attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_log_tenant ON webhook_delivery_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_event_id ON webhook_delivery_log(external_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_status ON webhook_delivery_log(status);

-- 5. Adicionar parent_transaction_id a payments (para rastreamento de refunds)
ALTER TABLE IF EXISTS payments
ADD COLUMN IF NOT EXISTS parent_transaction_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_payments_parent_transaction ON payments(parent_transaction_id);

-- 6. Helper: Função para criar checkout idempotente
DROP FUNCTION IF EXISTS create_payment_idempotent(uuid, varchar, integer, varchar) CASCADE;
CREATE OR REPLACE FUNCTION create_payment_idempotent(
  p_tenant_id uuid,
  p_idempotency_key varchar,
  p_amount_cents integer,
  p_payment_type varchar DEFAULT 'credit_purchase'
)
RETURNS TABLE (
  payment_id uuid,
  status varchar,
  created_new boolean
) AS $$
DECLARE
  v_payment_id uuid;
  v_existing_payment uuid;
BEGIN
  -- 1. Procurar payment existente com mesma idempotency_key
  SELECT id INTO v_existing_payment
  FROM payments
  WHERE idempotency_key = p_idempotency_key
    AND tenant_id = p_tenant_id
  LIMIT 1;

  -- 2. Se encontrou, retornar existente (idempotência)
  IF v_existing_payment IS NOT NULL THEN
    RETURN QUERY
    SELECT
      v_existing_payment,
      status,
      false as created_new
    FROM payments
    WHERE id = v_existing_payment;
    RETURN;
  END IF;

  -- 3. Criar novo payment
  v_payment_id := gen_random_uuid();

  INSERT INTO payments (
    id, tenant_id, idempotency_key, amount_cents,
    payment_type, status, created_at, updated_at
  ) VALUES (
    v_payment_id, p_tenant_id, p_idempotency_key, p_amount_cents,
    p_payment_type, 'INITIATED', NOW(), NOW()
  );

  -- 4. Retornar novo payment
  RETURN QUERY
  SELECT
    v_payment_id,
    'INITIATED'::varchar,
    true as created_new;
END;
$$ LANGUAGE plpgsql;

-- 7. Helper: Função para debit wallet com lock otimista (retries automáticos)
DROP FUNCTION IF EXISTS debit_wallet_credits_with_retry(uuid, integer, varchar, integer) CASCADE;
CREATE OR REPLACE FUNCTION debit_wallet_credits_with_retry(
  p_tenant_id uuid,
  p_amount integer,
  p_reference varchar,
  p_max_retries integer DEFAULT 3
)
RETURNS TABLE (
  success boolean,
  balance_after integer,
  new_version integer,
  error_message varchar
) AS $$
DECLARE
  v_current_version integer;
  v_balance_before integer;
  v_balance_after integer;
  v_attempt integer := 0;
  v_updated_rows integer;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;

    -- 1. Obter versão atual
    SELECT version, balance
    INTO v_current_version, v_balance_before
    FROM wallets
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT
        false,
        0::integer,
        0::integer,
        'Tenant não encontrado'::varchar;
      RETURN;
    END IF;

    -- 2. Validar saldo
    IF v_balance_before < p_amount THEN
      RETURN QUERY SELECT
        false,
        v_balance_before,
        v_current_version,
        'Saldo insuficiente'::varchar;
      RETURN;
    END IF;

    -- 3. Atualizar com lock otimista (WHERE version = current)
    v_balance_after := v_balance_before - p_amount;

    UPDATE wallets
    SET balance = v_balance_after,
        version = version + 1,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND version = v_current_version;

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    -- 4. Se atualizou, sucesso
    IF v_updated_rows > 0 THEN
      -- Registrar transação
      INSERT INTO wallet_transactions (
        tenant_id, type, amount, description, reference,
        balance_before, balance_after
      ) VALUES (
        p_tenant_id, 'debit', p_amount, 'Débito', p_reference,
        v_balance_before, v_balance_after
      );

      RETURN QUERY SELECT
        true,
        v_balance_after,
        v_current_version + 1,
        NULL::varchar;
      RETURN;
    END IF;

    -- 5. Se não atualizou (versão mudou), retry
    IF v_attempt >= p_max_retries THEN
      RETURN QUERY SELECT
        false,
        v_balance_before,
        v_current_version,
        'Máximo de tentativas excedido'::varchar;
      RETURN;
    END IF;

    -- Pequeno delay antes de retry (backoff exponencial)
    PERFORM pg_sleep(0.1 * v_attempt);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIM DA MIGRATION 009
-- ============================================================================
