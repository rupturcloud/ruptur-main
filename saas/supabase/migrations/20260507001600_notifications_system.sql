-- ============================================================================
-- MIGRATION 016: Notifications System
-- Preferências de notificação e logs de envio
-- ============================================================================

-- 1. Tabela de preferências de notificação
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  digest_enabled BOOLEAN DEFAULT false,
  digest_hour INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_tenant ON notification_preferences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_event_type ON notification_preferences(event_type);

-- 2. Tabela de logs de notificações (auditoria)
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'in_app', 'push')),
  payload JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, event_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant ON notification_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_id ON notification_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);

-- 3. RLS para notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM user_tenant_memberships WHERE tenant_id = notification_preferences.tenant_id
  ));

CREATE POLICY "Users can update their own preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. RLS para notification_logs (read-only for users)
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification logs"
  ON notification_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Function helper para trigger (chama a função principal com parâmetros corretos)
DROP FUNCTION IF EXISTS trigger_create_notification_preferences_fn() CASCADE;
CREATE OR REPLACE FUNCTION trigger_create_notification_preferences_fn()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar preferências padrão para tipos de eventos comuns
  INSERT INTO notification_preferences (tenant_id, user_id, event_type, email_enabled, sms_enabled)
  VALUES
    (NEW.tenant_id, NEW.user_id, 'campaign_launched', true, false),
    (NEW.tenant_id, NEW.user_id, 'campaign_failed', true, true),
    (NEW.tenant_id, NEW.user_id, 'credits_low', true, true),
    (NEW.tenant_id, NEW.user_id, 'payment_failed', true, true),
    (NEW.tenant_id, NEW.user_id, 'payment_success', true, false),
    (NEW.tenant_id, NEW.user_id, 'instance_disconnected', true, true),
    (NEW.tenant_id, NEW.user_id, 'instance_reconnected', true, false)
  ON CONFLICT (tenant_id, user_id, event_type) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para criar preferências padrão quando user_tenant_membership é criado
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON user_tenant_memberships CASCADE;
CREATE TRIGGER trigger_create_notification_preferences
AFTER INSERT ON user_tenant_memberships
FOR EACH ROW
EXECUTE FUNCTION trigger_create_notification_preferences_fn();
