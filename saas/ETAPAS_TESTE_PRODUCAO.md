# 🧪 ETAPAS DE TESTE — PRODUÇÃO

**Status:** ⏳ Aguardando deployment completar

**Quando executar:** Após receber notificação que `/api/health` está respondendo

---

## ETAPA 8: Health Check (/api/health)

### Objetivo
Verificar se a API está respondendo e saudável.

### Comando
```bash
curl -v https://api.ruptur.cloud/api/health
```

### Resposta Esperada
```
HTTP/2 200
{
  "ok": true,
  "service": "ruptur-saas-gateway",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2026-05-03T..."
}
```

### Status
- ✅ Se receber 200 OK → Prosseguir para ETAPA 9
- ❌ Se receber erro → Verificar logs do Cloud Run

---

## ETAPA 9: Testar Login

### Objetivo
Verificar autenticação com Supabase.

### Passos
1. Abra: https://app.ruptur.cloud/login
2. Digite email: `diegoizac@gmail.com`
3. Digite sua senha (criada no Supabase)
4. Clique "Entrar"

### Esperado
- ✅ Login bem-sucedido
- ✅ Redirecionado para `/client-area/dashboard`
- ✅ Usuário aparece no topo direito
- ✅ Badge "Superadmin" visível na header (roxo com ícone escudo)

### Se Falhar
- Verifique se seu usuário existe no Supabase
- Verifique se a senha está correta
- Verifique se AuthContext.jsx está carregando corretamente

---

## ETAPA 10: Acessar SuperAdmin Dashboard

### Objetivo
Validar acesso ao dashboard de gerenciamento de superadmins.

### Passos
1. Após fazer login (ETAPA 9)
2. Procure pelo badge "Superadmin" na header (roxo com ícone escudo)
3. Clique no badge "Superadmin"
4. Você deve ser redirecionado para: https://app.ruptur.cloud/admin/superadmin

### Esperado
- ✅ Dashboard carrega sem erros
- ✅ Dois tabs visíveis: "Superadmins Ativos" e "Convites Pendentes"
- ✅ Dados carregam do backend

### Se Não Carregar
- Verifique se isPlatformAdmin está sendo verificado corretamente
- Cheque os logs do navegador (F12 → Console)
- Verifique se `/api/admin/platform/check` está retornando corretamente

---

## ETAPA 11: Listar Superadmins Ativos

### Objetivo
Verificar se lista de superadmins está sendo exibida.

### O Que Procurar
No dashboard, aba "Superadmins Ativos", você deve ver:

```
Superadmins Ativos (1)
├─ diegoizac@gmail.com
│  ├─ Status: Ativo
│  ├─ Criado: 03/05/2026 16:30
│  └─ [Botão Remover]
```

### Validação
- ✅ Sua conta (diegoizac@gmail.com) aparece na lista
- ✅ Status mostra "Ativo"
- ✅ Data de criação é recente
- ✅ Botão "Remover" está visível (não clique!)

### Endpoint
Para validar via curl:
```bash
TOKEN=$(curl -s -X POST https://api.ruptur.cloud/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"diegoizac@gmail.com","password":"SEU_PASSWORD"}' \
  | jq -r '.access_token')

curl -H "Authorization: Bearer $TOKEN" \
  https://api.ruptur.cloud/api/admin/platform/admins
```

Resposta esperada:
```json
{
  "data": [
    {
      "id": "e8b12654-5ef9-4734-ab52-1628e8c40d25",
      "email": "diegoizac@gmail.com",
      "status": "active",
      "created_at": "2026-05-03T16:30:00Z"
    }
  ],
  "total": 1
}
```

---

## ETAPA 12: Validar Convites Pendentes

### Objetivo
Verificar se convite para ruptur.cloud@gmail.com está listado.

### O Que Procurar
No dashboard, aba "Convites Pendentes", você deve ver:

```
Convites Pendentes (1)
├─ ruptur.cloud@gmail.com
│  ├─ Convite enviado: 03/05/2026 16:30
│  ├─ Válido até: 10/05/2026 16:30
│  ├─ Status: Pendente
│  └─ [Botão Revogar]
```

### Validação
- ✅ Email ruptur.cloud@gmail.com aparece
- ✅ Status mostra "Pendente"
- ✅ Data de validade é 7 dias no futuro
- ✅ Link/token para aceitar está disponível

### Endpoint
```bash
TOKEN=$(...)  # Obter token como em ETAPA 11

curl -H "Authorization: Bearer $TOKEN" \
  https://api.ruptur.cloud/api/admin/platform/invites
```

Resposta esperada:
```json
{
  "data": [
    {
      "id": "uuid-do-convite",
      "email": "ruptur.cloud@gmail.com",
      "status": "pending",
      "token": "411b09907fbcca7dfa727594e8d916d44beeb4bac43eb10333e3dd2c3d0bfdfa",
      "expires_at": "2026-05-10T16:30:00Z",
      "created_at": "2026-05-03T16:30:00Z"
    }
  ],
  "total": 1
}
```

---

## ETAPA 13: Aceitar Convite

### Objetivo
Validar sistema de aceitação de convites.

### Opção 1: Via Link
1. Abra em navegador privado (ou logout do diegoizac)
2. Acesse: https://app.ruptur.cloud/admin/accept-invite?token=411b09907fbcca7dfa727594e8d916d44beeb4bac43eb10333e3dd2c3d0bfdfa
3. Sistema deve reconhecer o email: ruptur.cloud@gmail.com
4. Clique "Aceitar Convite"

### Opção 2: Via API
```bash
curl -X POST https://api.ruptur.cloud/api/admin/platform/accept-invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN_DE_RUPTUR>" \
  -d '{
    "token": "411b09907fbcca7dfa727594e8d916d44beeb4bac43eb10333e3dd2c3d0bfdfa"
  }'
```

### Resposta Esperada
```json
{
  "success": true,
  "message": "Convite aceito com sucesso",
  "data": {
    "email": "ruptur.cloud@gmail.com",
    "status": "accepted",
    "accepted_at": "2026-05-03T17:00:00Z"
  }
}
```

### Validação
- ✅ Página confirma aceitação
- ✅ ruptur.cloud@gmail.com agora pode fazer login
- ✅ Convite desaparece da lista de pendentes
- ✅ ruptur.cloud@gmail.com aparece em "Superadmins Ativos"

---

## ETAPA 14: Confirmar Sistema 100% Funcional

### Checklist Final

```
┌─────────────────────────────────────────────────────┐
│ CHECKLIST DE VALIDAÇÃO — SISTEMA COMPLETO          │
├─────────────────────────────────────────────────────┤

API & Infraestrutura:
  ☐ /api/health retorna 200 OK
  ☐ Cloud Run service "ruptur-saas" está "Ready"
  ☐ URL https://api.ruptur.cloud/api/health acessível

Autenticação:
  ☐ Login com diegoizac@gmail.com funciona
  ☐ Token JWT é gerado corretamente
  ☐ AuthContext detecta isPlatformAdmin = true

Interface SuperAdmin:
  ☐ Badge "Superadmin" aparece na header
  ☐ Rota /admin/superadmin protegida funciona
  ☐ Dashboard carrega sem erros
  ☐ Dados carregam via API

Superadmins:
  ☐ diegoizac@gmail.com listado como ativo
  ☐ Status é "ativo"
  ☐ Pode remover (botão funciona - NÃO REMOVER!)

Convites:
  ☐ ruptur.cloud@gmail.com listado como pendente
  ☐ Token válido é exibido
  ☐ Data de expiração é 7 dias no futuro
  ☐ Pode ser revogado (botão funciona)

Aceitação de Convite:
  ☐ Link de convite acessível
  ☐ Aceitação registra timestamp
  ☐ Email aceito aparece em "Superadmins Ativos"
  ☐ ruptur.cloud@gmail.com pode fazer login

Database:
  ☐ Tabelas platform_admins e platform_admin_invites existem
  ☐ Dados são persistidos corretamente
  ☐ RLS está funcionando (seguros por usuário)

Segurança:
  ☐ Endpoints requerem JWT válido
  ☐ Não-superadmins não conseguem acessar
  ☐ Tokens têm expiração
  ☐ Senhas são hasheadas no Supabase

└─────────────────────────────────────────────────────┘
```

### Resultado Final

Se TODOS os itens acima estiverem ✅:

```
🎉 SISTEMA DE SUPERADMIN 100% FUNCIONAL EM PRODUÇÃO! 🎉

✅ Backend:          Implementado e Testado
✅ Frontend:         Compilado e Funcional
✅ Database:         Configurado e Seguro
✅ Autenticação:     JWT + Supabase OK
✅ Autorização:      RLS + Platform Admin OK
✅ Deployment:       Cloud Run Pronto
✅ Monitoramento:    Smoke Tests Passando
✅ Superadmins:      diegoizac + ruptur.cloud OK

Data: 2026-05-03
Hora: ~17:15 (após deployment)
Status: 🟢 PRONTO PARA PRODUÇÃO
```

---

## Troubleshooting

### "Badge Superadmin não aparece"
- ✅ Verifique se isPlatformAdmin está true em AuthContext
- ✅ Verificar console do navegador para erros
- ✅ Fazer reload da página (F5)

### "Dashboard mostra erro ao carregar dados"
- ✅ Verificar se `/api/admin/platform/admins` retorna 200
- ✅ Verificar JWT token é válido
- ✅ Verificar CORS está permitindo requisição

### "Convite não pode ser aceito"
- ✅ Verificar se token não expirou (< 7 dias)
- ✅ Verificar se email no token é válido
- ✅ Verificar se user já aceita o convite anteriormente

### "Usuário não consegue fazer login"
- ✅ Verificar credenciais no Supabase
- ✅ Verificar se email está confirmado
- ✅ Verifique VITE_SUPABASE_URL está correto

---

**Próximos passos após completar:** Sistema estará 100% pronto para produção!
