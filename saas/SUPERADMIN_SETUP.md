# Setup de Superadmin — Guia Completo

Documento para configurar e gerenciar Superadmins da plataforma Ruptur.

## 📋 O que foi criado

### 1. **Migration 011** — Tabelas de Superadmin
- `platform_admins` — Armazena superadmins ativos
- `platform_admin_invites` — Gerencia convites pendentes
- Funcionalidades: RLS, triggers, função de geração de token

**Arquivo**: `migrations/011_platform_admins_and_invites.sql`

### 2. **PlatformAdminService** — Lógica de Negócio
Métodos:
- `isPlatformAdmin(userId)` — Verificar se é superadmin
- `listPlatformAdmins()` — Listar todos superadmins
- `addPlatformAdminDirect(email, userId, createdBy)` — Adicionar direto
- `invitePlatformAdmin(email, invitedBy)` — Convidar via email
- `acceptInvite(token, userId, email)` — Aceitar convite
- `removePlatformAdmin(adminId, removedBy)` — Desativar superadmin
- `listPendingInvites()` — Listar convites pendentes

**Arquivo**: `modules/superadmin/platform-admin.service.js`

### 3. **Middleware de Proteção**
Protege rotas administrativas, verificando se é superadmin.

**Arquivo**: `middleware/platform-admin-auth.js`

### 4. **Rotas de API**
```
GET  /api/admin/platform/admins         — Listar superadmins
GET  /api/admin/platform/invites        — Listar convites
POST /api/admin/platform/invite         — Convidar novo
POST /api/admin/platform/accept-invite  — Aceitar convite
POST /api/admin/platform/remove         — Desativar superadmin
```

**Arquivo**: `modules/superadmin/routes.js`

### 5. **Script de Setup**
Script para adicionar os primeiros superadmins.

**Arquivo**: `scripts/setup-superadmins.js`

### 6. **Template de Email**
Email HTML para convite de superadmin.

**Arquivo**: `templates/emails/platform-admin-invite.html`

---

## 🚀 Passo a Passo de Deployment

### Passo 1: Aplicar Migrations
```bash
# Acesse Supabase > SQL Editor
# Cole o conteúdo de: migrations/011_platform_admins_and_invites.sql
# Execute
```

Ou via CLI (se tiver Supabase CLI):
```bash
supabase migration up
```

### Passo 2: Registrar Rotas na Aplicação
Adicione a seguinte linha no arquivo principal da app (ex: `server.js` ou `app.js`):

```js
import registerPlatformAdminRoutes from './modules/superadmin/routes.js';
import createPlatformAdminMiddleware from './middleware/platform-admin-auth.js';

// ... seu código ...

// Registrar rotas de superadmin
registerPlatformAdminRoutes(app, {
  supabase,
  platformAdminMiddleware: createPlatformAdminMiddleware(supabase),
  emailService, // seu serviço de email
});
```

### Passo 3: Rodar Script de Setup
```bash
# Primeiro, certifique-se de ter as variáveis de ambiente:
# - SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - APP_URL (opcional, default: https://app.ruptur.cloud)

node scripts/setup-superadmins.js
```

**Saída esperada:**
```
🚀 Iniciando setup de superadmins...

📝 Passo 1: Criando superadmin diegoizac@gmail.com...
   ✅ Superadmin criado: diegoizac@gmail.com

📧 Passo 2: Criando convite para ruptur.cloud@gmail.com...
   ✅ Convite criado: ruptur.cloud@gmail.com
   📌 Link de convite: https://app.ruptur.cloud/admin/accept-invite?token=abc123def456...
   ⏰ Válido até: 10/05/2026

============================================================
✅ Setup concluído com sucesso!
============================================================
```

### Passo 4: Enviar Convite para ruptur.cloud@gmail.com
O link gerado no passo anterior deve ser enviado para o email.

Pode ser:
- ✅ Via Gmail/Outlook manualmente
- ✅ Via Slack DM
- ✅ Via formulário de "Convidar Admin" na interface web (implementar depois)

**Template de mensagem:**
```
Você foi convidado para ser Superadmin da Ruptur!

Link: https://app.ruptur.cloud/admin/accept-invite?token=...
Válido por: 7 dias

Clique no link para aceitar o convite.
```

---

## 📊 Status Atual

| Componente | Status | Notas |
|---|---|---|
| Migration | ✅ Criada | Pronta para aplicar |
| Service | ✅ Implementado | Todas as funções |
| Middleware | ✅ Implementado | Proteção de rotas |
| Rotas API | ✅ Implementadas | Prontas para registrar |
| Script Setup | ✅ Pronto | Pronto para rodar |
| Template Email | ✅ Pronto | HTML customizável |
| Frontend | ❌ Não implementado | Implementar depois |

---

## 🔒 Segurança

### RLS (Row Level Security)
- ✅ Usuários só veem seus próprios dados
- ✅ Superadmins podem ver/gerenciar todos
- ✅ Convites com token único (SHA256)
- ✅ Convites expiram em 7 dias

### Validações
- ✅ Email validado no convite
- ✅ Token único e seguro
- ✅ Permissões verificadas em middleware
- ✅ Auditoria de operações

---

## 🧪 Teste Manual

### Testar Adicionar Superadmin (direto)
```bash
curl -X POST http://localhost:3000/api/admin/platform/admins \
  -H "Authorization: Bearer <token-superadmin>" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Testar Listar Superadmins
```bash
curl http://localhost:3000/api/admin/platform/admins \
  -H "Authorization: Bearer <token-superadmin>"
```

### Testar Convidar Superadmin
```bash
curl -X POST http://localhost:3000/api/admin/platform/invite \
  -H "Authorization: Bearer <token-superadmin>" \
  -H "Content-Type: application/json" \
  -d '{"email": "newadmin@example.com"}'
```

### Testar Aceitar Convite
```bash
curl -X POST http://localhost:3000/api/admin/platform/accept-invite \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123...",
    "userId": "user-uuid",
    "email": "newadmin@example.com"
  }'
```

---

## 🚨 Troubleshooting

### Erro: "Only platform admins can..."
**Causa**: O usuário não é superadmin\
**Solução**: Rodar `setup-superadmins.js` ou adicionar manualmente via Supabase

### Erro: "Convite inválido ou expirado"
**Causa**: Token expirou (7 dias) ou é inválido\
**Solução**: Solicitar novo convite

### Email não é enviado
**Causa**: `emailService` não configurado\
**Solução**: Implementar serviço de email (SendGrid, Mailgun, etc)

---

## 📝 Próximos Passos

1. **Build & Deploy** — Rodar build, aplicar migration, rodar setup
2. **Frontend** — Implementar tela de aceitação de convite
3. **Dashboard** — Painel de gerenciamento de superadmins
4. **Logs** — Adicionar auditoria para ações de superadmin
5. **Notificações** — Notificar quando novo convite for criado

---

## 📞 Contato

Para dúvidas sobre este setup, entre em contato com o time DevOps.
