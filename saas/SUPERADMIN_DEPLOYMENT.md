# 🚀 Deploy Completo: Sistema de Superadmin

## Status Atual

✅ **Implementado:**
- Rotas de API (`/api/admin/platform/*`)
- Service de gerenciamento
- Middleware de proteção
- Scripts de setup
- Documentação completa

⏳ **Pendente:**
- Aplicar migration SQL no Supabase (você faz isso)
- Rodar deploy em produção
- Executar script de setup

---

## 🎯 Plano de Ação

### PASSO 1: Aplicar Migration no Supabase (⏱️ 30 segundos)

**Abra:** https://app.supabase.com

**Navegue para:** SQL Editor → New Query

**Cole este SQL:**

```sql
-- ============================================================================
-- MIGRATION 011: Platform Admins & Invites
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  permissions JSONB DEFAULT '{"manage_tenants": true, "manage_users": true, "view_audit_logs": true, "manage_billing": true, "manage_support": true}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(email);
CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_status ON platform_admins(status);

CREATE TABLE IF NOT EXISTS platform_admin_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_invites_email ON platform_admin_invites(email);
CREATE INDEX IF NOT EXISTS idx_platform_admin_invites_token ON platform_admin_invites(token);
CREATE INDEX IF NOT EXISTS idx_platform_admin_invites_status ON platform_admin_invites(status);
CREATE INDEX IF NOT EXISTS idx_platform_admin_invites_expires ON platform_admin_invites(expires_at);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS platform_admins_select ON platform_admins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY IF NOT EXISTS platform_admins_write ON platform_admins
  FOR ALL USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY IF NOT EXISTS platform_admin_invites_select ON platform_admin_invites
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND status = 'active')
  );

CREATE OR REPLACE TRIGGER update_platform_admins_updated_at
  BEFORE UPDATE ON platform_admins FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_platform_admin_invites_updated_at
  BEFORE UPDATE ON platform_admin_invites FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE ON platform_admins TO authenticated;
GRANT SELECT, INSERT, UPDATE ON platform_admin_invites TO authenticated;
```

**Execute:** Clique em `RUN` ou `Ctrl+Enter`

**Resultado esperado:** ✅ Sem erros

---

### PASSO 2: Fazer Build

```bash
cd /Users/diego/dev/ruptur-cloud/ruptur-main/saas
npm run build 2>&1 | tail -20
```

**Resultado esperado:** ✅ Build completo sem erros

---

### PASSO 3: Deploy

**Qual sua plataforma de deploy?**
- [ ] Vercel / Netlify
- [ ] Docker (Railway, Render, etc)
- [ ] Cloud Run (GCP)
- [ ] Outro: ____________

**Instruções por plataforma:**

#### 🐳 Docker / Cloud Run / Railway

```bash
# 1. Build Docker
docker build -t ruptur-saas:latest .

# 2. Push para seu registry
docker push ruptur-saas:latest

# 3. Deploy na plataforma (use seu CLI)
# Ex: gcloud run deploy ...
# Ex: railway deploy ...
```

#### 🔗 Vercel / Netlify
- Push para `main` branch
- CI/CD automático executa build
- Deploy automático

---

### PASSO 4: Executar Setup (⏱️ 2 minutos)

Depois que as tabelas estão no Supabase e o código está em produção, rode:

```bash
node scripts/deploy-superadmin.mjs
```

**Saída esperada:**

```
======================================================================
🚀 DEPLOY SUPERADMIN — Ruptur SaaS
======================================================================

📝 PASSO 1: Aplicando Migration 011...
   ✅ Tabelas criadas

📧 PASSO 2: Adicionando diegoizac@gmail.com...
   ✅ Superadmin criado: diegoizac@gmail.com

📮 PASSO 3: Criando convite para ruptur.cloud@gmail.com...
   ✅ Convite criado: ruptur.cloud@gmail.com
   📌 Link: https://app.ruptur.cloud/admin/accept-invite?token=abc123...
   ⏰ Válido até: 10/05/2026

======================================================================
✅ DEPLOY CONCLUÍDO COM SUCESSO!
======================================================================
```

---

### PASSO 5: Enviar Convite para ruptur.cloud@gmail.com

Copie o link gerado e envie via:
- 📧 Email
- 💬 Slack DM
- 📱 WhatsApp

---

## 📋 Checklist de Execução

```
[ ] 1. Aplicado SQL no Supabase SQL Editor
[ ] 2. Tabelas criadas com sucesso
[ ] 3. Build rodou sem erros
[ ] 4. Deploy em produção
[ ] 5. Script de setup executado
[ ] 6. Convite enviado para ruptur.cloud@gmail.com
[ ] 7. Verificado que /api/admin/platform/admins retorna dados
```

---

## 🧪 Testes Rápidos

Depois de tudo pronto, teste:

```bash
# 1. Verificar se API está viva
curl https://app.ruptur.cloud/api/health

# 2. Listar superadmins (requer token JWT de diego)
curl -H "Authorization: Bearer <token>" \
  https://app.ruptur.cloud/api/admin/platform/admins

# 3. Listar convites pendentes
curl -H "Authorization: Bearer <token>" \
  https://app.ruptur.cloud/api/admin/platform/invites
```

---

## 🆘 Troubleshooting

### Erro: "Could not find the table 'public.platform_admins'"
**Causa:** Migration não foi aplicada\
**Solução:** Execute o SQL no Supabase SQL Editor

### Erro: "403 Forbidden: Platform admin access required"
**Causa:** Usuário não é superadmin\
**Solução:** Certifique-se de que o convite foi aceito

### Email não é enviado
**Causa:** Serviço de email não configurado\
**Solução:** Implementar integração com SendGrid/Mailgun

---

## 📞 Arquivo de Referência

Código implementado:
- **Rotas:** `api/gateway.mjs` (linhas ~533-600)
- **Service:** `modules/superadmin/platform-admin.service.js`
- **Migration:** `migrations/011_platform_admins_and_invites.sql`
- **Script:** `scripts/deploy-superadmin.mjs`

---

## ✅ Próximos Passos Opcionais

1. **Frontend:** Implementar tela de aceitação de convite
2. **Dashboard:** Painel de gerenciamento de superadmins
3. **Notificações:** Notificar quando novo convite é criado
4. **Auditoria:** Logs de ações de superadmin

---

**Criado em:** 2026-05-03\
**Status:** Pronto para deploy
