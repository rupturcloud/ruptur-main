/**
 * Migration 011: Platform Admins & Invites
 *
 * Cria sistema de superadmin (admin de plataforma) com suporte a convites.
 *
 * Tabelas:
 * - platform_admins: Usuários com permissão global de plataforma
 * - platform_admin_invites: Convites pendentes com token de aceitação
 */

-- ============================================================================
-- 1. TABELA: platform_admins
-- Armazena superadmins que gerenciam toda a plataforma
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,

  -- Status do admin
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'inactive')),

  -- Permissões granulares (para futuro)
  permissions JSONB DEFAULT '{
    "manage_tenants": true,
    "manage_users": true,
    "view_audit_logs": true,
    "manage_billing": true,
    "manage_support": true
  }',

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(email);
CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_status ON platform_admins(status);

-- ============================================================================
-- 2. TABELA: platform_admin_invites
-- Convites pendentes para se tornar superadmin
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_admin_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,

  -- Token expira em 7 dias
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  -- Status do convite
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),

  -- Quem enviou o convite
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- Se foi aceito, qual user aceitou
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_invites_email ON platform_admin_invites(email);
CREATE INDEX IF NOT EXISTS idx_platform_admin_invites_token ON platform_admin_invites(token);
CREATE INDEX IF NOT EXISTS idx_platform_admin_invites_status ON platform_admin_invites(status);
CREATE INDEX IF NOT EXISTS idx_platform_admin_invites_expires ON platform_admin_invites(expires_at);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_invites ENABLE ROW LEVEL SECURITY;

-- Apenas superadmins podem ver outros superadmins
CREATE POLICY platform_admins_select ON platform_admins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Apenas superadmins podem criar/atualizar
CREATE POLICY platform_admins_write ON platform_admins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Superadmins veem convites pendentes
CREATE POLICY platform_admin_invites_select ON platform_admin_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_admins
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Qualquer pessoa pode aceitar um convite com token válido (sem RLS)
-- Esse controle será feito em aplicação

-- ============================================================================
-- 4. TRIGGER: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE TRIGGER update_platform_admins_updated_at
  BEFORE UPDATE ON platform_admins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_platform_admin_invites_updated_at
  BEFORE UPDATE ON platform_admin_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. FUNÇÃO: Gerar token de convite (SHA256)
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    digest(
      gen_random_uuid()::text || NOW()::text || random()::text,
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON platform_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE ON platform_admin_invites TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invite_token TO authenticated;

-- ============================================================================
-- FIM DA MIGRATION 011
-- ============================================================================
