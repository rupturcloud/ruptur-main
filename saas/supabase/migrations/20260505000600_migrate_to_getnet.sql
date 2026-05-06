-- ============================================================
-- 006: Migração de Mercado Pago → Getnet
-- Renomeia colunas mp_* para getnet_* e adiciona campos novos
-- ============================================================

-- ---- PLANS ----
-- Renomear coluna de referência do provedor
ALTER TABLE plans RENAME COLUMN mp_plan_id TO getnet_plan_id;

-- ---- SUBSCRIPTIONS ----
ALTER TABLE subscriptions RENAME COLUMN mp_subscription_id TO getnet_subscription_id;
ALTER TABLE subscriptions RENAME COLUMN mp_payer_id TO getnet_customer_id;

-- Adicionar campo para cofre de cartão recorrente
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS getnet_vault_id TEXT;

-- ---- PAYMENTS ----
ALTER TABLE payments RENAME COLUMN mp_payment_id TO getnet_payment_id;
ALTER TABLE payments RENAME COLUMN mp_status TO getnet_status;
ALTER TABLE payments RENAME COLUMN mp_status_detail TO getnet_status_detail;

-- Adicionar número do pedido Getnet (order_id)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS getnet_order_id TEXT;

-- ---- ÍNDICES (recriar com nomes corretos) ----
DROP INDEX IF EXISTS idx_subscriptions_mp;
DROP INDEX IF EXISTS idx_payments_mp;

CREATE INDEX IF NOT EXISTS idx_subscriptions_getnet ON subscriptions(getnet_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_getnet ON payments(getnet_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(getnet_order_id);

-- ---- SEED: Atualizar planos com preços Getnet em centavos ----
UPDATE plans SET
  getnet_plan_id = NULL,
  price_cents = 9700,
  credits_per_month = 2000,
  max_instances = 1
WHERE id = 'starter';

UPDATE plans SET
  getnet_plan_id = NULL,
  price_cents = 19700,
  credits_per_month = 5000,
  max_instances = 3
WHERE id = 'pro';

UPDATE plans SET
  getnet_plan_id = NULL,
  price_cents = 49700,
  credits_per_month = 15000,
  max_instances = 10
WHERE id = 'business';
