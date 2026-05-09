/**
 * Migration 018: Webhook Queue Service
 *
 * Adiciona suporte para processamento assíncrono de webhooks com retry automático.
 * Campos adicionados (backward compatible):
 * - provider: qual gateway (stripe, getnet, etc)
 * - signature: assinatura do webhook (para validar)
 * - retry_count: tentativas de processamento
 * - next_retry_at: quando próximo retry
 * - updated_at: timestamp última atualização
 */

-- 1. Adicionar coluna provider se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_events' AND column_name = 'provider'
  ) THEN
    ALTER TABLE webhook_events ADD COLUMN provider VARCHAR(50) DEFAULT 'getnet';
  END IF;
END $$;

-- 2. Adicionar coluna signature se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_events' AND column_name = 'signature'
  ) THEN
    ALTER TABLE webhook_events ADD COLUMN signature TEXT;
  END IF;
END $$;

-- 3. Adicionar coluna retry_count se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_events' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE webhook_events ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 4. Adicionar coluna next_retry_at se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_events' AND column_name = 'next_retry_at'
  ) THEN
    ALTER TABLE webhook_events ADD COLUMN next_retry_at TIMESTAMPTZ;
  END IF;
END $$;

-- 5. Adicionar coluna updated_at se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_events' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE webhook_events ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 6. Atualizar CHECK constraint de status para incluir 'dead-letter'
DO $$
BEGIN
  -- Remove constraint antigo
  ALTER TABLE webhook_events DROP CONSTRAINT IF EXISTS webhook_events_status_check;

  -- Adiciona novo (se não existir)
  ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead-letter'));
EXCEPTION WHEN OTHERS THEN
  -- Constraint já pode existir
  NULL;
END $$;

-- 7. Criar índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry_count ON webhook_events(retry_count);
CREATE INDEX IF NOT EXISTS idx_webhook_events_next_retry ON webhook_events(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_created ON webhook_events(status, created_at DESC);

-- 8. Função para retornar estatísticas da fila (usada em WebhookQueueService)
CREATE OR REPLACE FUNCTION get_webhook_queue_stats()
RETURNS TABLE(
  pending_count BIGINT,
  processing_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT,
  dead_letter_count BIGINT,
  oldest_pending_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE status = 'dead-letter') as dead_letter_count,
    MIN(created_at) FILTER (WHERE status = 'pending') as oldest_pending_at
  FROM webhook_events;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger para auto-atualizar updated_at
CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_webhook_events_updated_at ON webhook_events;

CREATE TRIGGER trigger_update_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_events_updated_at();

-- 10. Seed: Migrar delivery_attempts → retry_count (se diferentes)
UPDATE webhook_events
SET retry_count = delivery_attempts
WHERE retry_count = 0 AND delivery_attempts > 0;

RAISE NOTICE '✅ Migration 018 completed: Webhook queue service support added';
