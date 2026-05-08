/**
 * Migration 015: UAZAPI Messaging Tables
 *
 * Tabelas agnósticas para armazenar eventos UAZAPI de mensageria:
 * - uazapi_messages: mensagens individuais (enviadas/recebidas)
 * - uazapi_chats: conversas/threads
 * - uazapi_contacts: contatos/participantes
 * - uazapi_message_status: status de entrega/leitura
 *
 * Integra-se com webhook-core para normalização e pub/sub para notificações.
 */

-- ============================================================================
-- 1. TABELA: uazapi_messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS uazapi_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Identificadores UAZAPI
  instance_id TEXT NOT NULL,
  message_id TEXT,
  chat_id TEXT NOT NULL,
  contact_id TEXT,

  -- Tipo e direção
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'contact', 'location', 'sticker', 'template')),
  direction TEXT NOT NULL
    CHECK (direction IN ('inbound', 'outbound')),

  -- Conteúdo
  body TEXT,
  media_url TEXT,
  media_type TEXT,
  metadata JSONB DEFAULT '{}',

  -- Status de entrega
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'pending', 'sent', 'delivered', 'read', 'failed', 'rejected')),
  error_code TEXT,
  error_message TEXT,

  -- Timestamps
  timestamp_from_provider TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_uazapi_messages_tenant_chat
  ON uazapi_messages(tenant_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_messages_instance_id
  ON uazapi_messages(instance_id, message_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_messages_created_at
  ON uazapi_messages(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uazapi_messages_status
  ON uazapi_messages(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_uazapi_messages_direction
  ON uazapi_messages(tenant_id, direction);

-- ============================================================================
-- 2. TABELA: uazapi_chats
-- ============================================================================

CREATE TABLE IF NOT EXISTS uazapi_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identificadores UAZAPI
  instance_id TEXT NOT NULL,
  chat_id TEXT NOT NULL UNIQUE,
  contact_id TEXT,
  contact_name TEXT,

  -- Metadados
  is_group BOOLEAN DEFAULT FALSE,
  chat_name TEXT,
  description TEXT,
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_body TEXT,

  -- Status
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'blocked', 'deleted')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_uazapi_chats_tenant
  ON uazapi_chats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_chats_instance_id
  ON uazapi_chats(instance_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_chats_contact_id
  ON uazapi_chats(instance_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_chats_status
  ON uazapi_chats(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_uazapi_chats_updated_at
  ON uazapi_chats(tenant_id, updated_at DESC);

-- ============================================================================
-- 3. TABELA: uazapi_contacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS uazapi_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identificadores UAZAPI
  instance_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,

  -- Dados do contato
  phone_number TEXT,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  avatar_url TEXT,

  -- Status WhatsApp
  is_wabiz_contact BOOLEAN DEFAULT FALSE,
  is_group BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,

  -- Metadados
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uazapi_contacts_tenant
  ON uazapi_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_contacts_instance_id
  ON uazapi_contacts(instance_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_contacts_phone
  ON uazapi_contacts(tenant_id, phone_number);

-- ============================================================================
-- 4. TABELA: uazapi_message_status
-- ============================================================================

CREATE TABLE IF NOT EXISTS uazapi_message_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES uazapi_messages(id) ON DELETE CASCADE,

  -- Rastreamento de status
  status TEXT NOT NULL
    CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  timestamp_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contexto
  recipient_id TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uazapi_message_status_tenant
  ON uazapi_message_status(tenant_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_message_status_message
  ON uazapi_message_status(message_id);
CREATE INDEX IF NOT EXISTS idx_uazapi_message_status_created
  ON uazapi_message_status(created_at DESC);

-- ============================================================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE TRIGGER update_uazapi_messages_updated_at
  BEFORE UPDATE ON uazapi_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_uazapi_chats_updated_at
  BEFORE UPDATE ON uazapi_chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_uazapi_contacts_updated_at
  BEFORE UPDATE ON uazapi_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE uazapi_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE uazapi_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE uazapi_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE uazapi_message_status ENABLE ROW LEVEL SECURITY;

-- Política padrão: bloquear acesso direto (service_role bypass only)
CREATE POLICY "uazapi_messages_rls"
  ON uazapi_messages FOR ALL
  USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY "uazapi_chats_rls"
  ON uazapi_chats FOR ALL
  USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY "uazapi_contacts_rls"
  ON uazapi_contacts FOR ALL
  USING (FALSE) WITH CHECK (FALSE);

CREATE POLICY "uazapi_message_status_rls"
  ON uazapi_message_status FOR ALL
  USING (FALSE) WITH CHECK (FALSE);

-- ============================================================================
-- FIM
-- ============================================================================
