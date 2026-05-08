/**
 * Migração 017 — Tabelas UAZAPI para Inbox
 *
 * Cria tabelas para sincronização de dados do Bubble/UAZAPI:
 * - uazapi_chats: conversas WhatsApp
 * - uazapi_messages: mensagens
 * - uazapi_contacts: contatos
 * - uazapi_presence: status de presença
 * - uazapi_connection: status de conexão
 *
 * Data: 2026-05-08
 */

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CHATS TABLE — Conversas WhatsApp
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.uazapi_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  instance_id TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  last_message TEXT,
  last_message_timestamp TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active', 'archived', 'muted'
  is_group BOOLEAN DEFAULT FALSE,
  group_name TEXT,
  group_icon_url TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_chat_per_tenant UNIQUE(tenant_id, chat_id)
);

CREATE INDEX idx_uazapi_chats_tenant ON public.uazapi_chats(tenant_id);
CREATE INDEX idx_uazapi_chats_phone ON public.uazapi_chats(contact_phone);
CREATE INDEX idx_uazapi_chats_timestamp ON public.uazapi_chats(last_message_timestamp DESC);

-- ============================================================================
-- MESSAGES TABLE — Mensagens de Chat
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.uazapi_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  sender_phone TEXT,
  sender_name TEXT,
  body TEXT,
  message_type TEXT DEFAULT 'text', -- 'text', 'image', 'video', 'document', 'audio', 'location'
  media_url TEXT,
  media_filename TEXT,
  status TEXT DEFAULT 'received', -- 'sent', 'delivered', 'read', 'received'
  timestamp TIMESTAMPTZ,
  is_from_me BOOLEAN DEFAULT FALSE,
  instance_id TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_message_per_tenant UNIQUE(tenant_id, message_id)
);

CREATE INDEX idx_uazapi_messages_tenant ON public.uazapi_messages(tenant_id);
CREATE INDEX idx_uazapi_messages_chat ON public.uazapi_messages(chat_id);
CREATE INDEX idx_uazapi_messages_timestamp ON public.uazapi_messages(timestamp DESC);

-- ============================================================================
-- CONTACTS TABLE — Contatos
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.uazapi_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  email TEXT,
  last_interaction TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  tags TEXT[], -- array de tags customizadas
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_contact_per_tenant UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_uazapi_contacts_tenant ON public.uazapi_contacts(tenant_id);
CREATE INDEX idx_uazapi_contacts_phone ON public.uazapi_contacts(phone);

-- ============================================================================
-- PRESENCE TABLE — Status Online/Offline
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.uazapi_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_phone TEXT,
  status TEXT DEFAULT 'offline', -- 'online', 'offline', 'typing', 'recording'
  last_seen TIMESTAMPTZ,
  instance_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_presence_per_contact UNIQUE(tenant_id, contact_phone)
);

CREATE INDEX idx_uazapi_presence_tenant ON public.uazapi_presence(tenant_id);
CREATE INDEX idx_uazapi_presence_status ON public.uazapi_presence(status);

-- ============================================================================
-- CONNECTION TABLE — Status de Conexão da Instância
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.uazapi_connection (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  phone TEXT,
  qr_code TEXT,
  connection_status TEXT DEFAULT 'disconnected', -- 'connected', 'disconnected', 'connecting', 'qr_waiting'
  battery_level INTEGER,
  is_charging BOOLEAN,
  last_connection TIMESTAMPTZ,
  webhook_url TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_connection_per_instance UNIQUE(tenant_id, instance_id)
);

CREATE INDEX idx_uazapi_connection_tenant ON public.uazapi_connection(tenant_id);
CREATE INDEX idx_uazapi_connection_status ON public.uazapi_connection(connection_status);

-- ============================================================================
-- WEBHOOK EVENTS TABLE — Log de eventos recebidos
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.uazapi_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'messages', 'presence', 'connection', etc
  instance_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_uazapi_webhook_tenant ON public.uazapi_webhook_events(tenant_id);
CREATE INDEX idx_uazapi_webhook_event_type ON public.uazapi_webhook_events(event_type);
CREATE INDEX idx_uazapi_webhook_processed ON public.uazapi_webhook_events(processed);

-- ============================================================================
-- CHAT LABELS TABLE — Etiquetas para Conversas
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.uazapi_chat_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  label_name TEXT NOT NULL,
  label_color TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_label_per_chat UNIQUE(tenant_id, chat_id, label_name)
);

CREATE INDEX idx_uazapi_chat_labels_tenant ON public.uazapi_chat_labels(tenant_id);
CREATE INDEX idx_uazapi_chat_labels_chat ON public.uazapi_chat_labels(chat_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.uazapi_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_chat_labels ENABLE ROW LEVEL SECURITY;

-- Chats: usuário só vê chats do seu tenant
CREATE POLICY "uazapi_chats_select_own_tenant" ON public.uazapi_chats
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "uazapi_chats_insert_own_tenant" ON public.uazapi_chats
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Messages: similar ao chats
CREATE POLICY "uazapi_messages_select_own_tenant" ON public.uazapi_messages
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "uazapi_messages_insert_own_tenant" ON public.uazapi_messages
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Contacts
CREATE POLICY "uazapi_contacts_select_own_tenant" ON public.uazapi_contacts
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "uazapi_contacts_insert_own_tenant" ON public.uazapi_contacts
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Presence
CREATE POLICY "uazapi_presence_select_own_tenant" ON public.uazapi_presence
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Connection
CREATE POLICY "uazapi_connection_select_own_tenant" ON public.uazapi_connection
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Webhook Events
CREATE POLICY "uazapi_webhook_events_select_own_tenant" ON public.uazapi_webhook_events
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Chat Labels
CREATE POLICY "uazapi_chat_labels_select_own_tenant" ON public.uazapi_chat_labels
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "uazapi_chat_labels_insert_own_tenant" ON public.uazapi_chat_labels
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS para atualizar updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_uazapi_chats_updated_at
  BEFORE UPDATE ON public.uazapi_chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_uazapi_contacts_updated_at
  BEFORE UPDATE ON public.uazapi_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_uazapi_presence_updated_at
  BEFORE UPDATE ON public.uazapi_presence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_uazapi_connection_updated_at
  BEFORE UPDATE ON public.uazapi_connection
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
