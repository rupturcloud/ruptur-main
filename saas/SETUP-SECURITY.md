# 🔐 Setup de Segurança - SaaS Ruptur

Implementação de Google OAuth, JWT, Multi-tenant isolation e Provider adapter pattern.

## 📋 Estrutura Implementada

```
modules/
├── auth/
│   ├── google-oauth.js      # Google OAuth flow
│   └── jwt-manager.js       # JWT sign/verify
├── provider-adapter/
│   ├── types.js             # Interface abstrata
│   ├── uazapi-adapter.js    # Implementação UAZAPI
│   └── provider-manager.js  # Gerenciador agnóstico
└── warmup-core/
    ├── server.mjs           # Servidor original (sem alteração)
    └── server-secured.mjs   # Novo servidor com segurança

middleware/
└── auth.js                  # JWT + Tenant validation + Rate limit

routes/
└── dev.js                   # Rota /dev com bypass de segurança

migrations/
└── 001_instance_registry.sql # Schema do Supabase
```

## 🚀 Setup Rápido (Desenvolvimento)

### 1. Variáveis de Ambiente

Adicione ao `.env`:

```bash
# Auth
JWT_SECRET=gere_uma_chave_forte_aqui_minimo_32_caracteres
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback

# Dev Mode (APENAS em desenvolvimento)
ENABLE_DEV_MODE=true
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# Outros
DOMAIN_PRIMARY=app.ruptur.cloud
```

### 2. Iniciar Servidor com Segurança

```bash
# Dev mode (com /dev bypass)
STANDALONE=true ENABLE_DEV_MODE=true node modules/warmup-core/server-secured.mjs

# Ou produção
STANDALONE=true node modules/warmup-core/server-secured.mjs
```

### 3. Testar /dev Routes

```bash
# Status do dev mode
curl http://localhost:8787/dev/status

# Gerar JWT fake
curl http://localhost:8787/dev/mock/token

# Listar instâncias mock
curl http://localhost:8787/dev/mock/instances

# Seed de dados
curl -X POST http://localhost:8787/dev/seed
```

---

## 🔑 Google OAuth Flow

### Cliente (Frontend)

```html
<!-- Botão de login -->
<a href="/auth/google">Login com Google</a>

<!-- Ou JavaScript -->
<script>
  document.getElementById('google-login').addEventListener('click', () => {
    window.location.href = '/auth/google';
  });
</script>
```

### Servidor

```
1. User clica "Login com Google"
2. GET /auth/google → Redireciona pra accounts.google.com
3. User faz login no Google
4. Google redireciona → /auth/google/callback?code=XXX
5. Servidor troca code por ID token
6. Servidor cria JWT com { userId, tenantId, role }
7. JWT é setado em cookie httpOnly
8. Redireciona pra /dashboard
```

---

## 🛡️ Middlewares de Segurança

### 1. JWT Authentication

Todo endpoint (exceto `/auth`, `/dev`, `/api/local/health`) requer JWT válido.

```javascript
// Middleware extrai automaticamente:
req.session = {
  userId: "...",
  email: "...",
  tenantId: "...",
  providerId: ["uazapi"],
  role: "admin"
}
```

### 2. Tenant Validation

Garante que usuário acessa APENAS dados de seu tenant.

```javascript
// ❌ Rejeita (tenant vem de query/header):
GET /api/wallet/balance?tenantId=OUTRO

// ✅ Aceita (tenant vem de JWT/sessão):
GET /api/wallet/balance
// Usa req.session.tenantId automaticamente
```

### 3. Rate Limiting

- 100 requisições por 15 minutos
- Por tenant (não IP)
- Retorna 429 se exceder

```javascript
// Resposta quando rate limit atingido
{
  "error": "Too many requests",
  "retryAfter": 600
}
```

---

## 📊 Instance Registry (Supabase)

### Setup

```bash
# 1. No Supabase, abra SQL editor
# 2. Cole o conteúdo de migrations/001_instance_registry.sql
# 3. Execute
```

### Tabelas

```
tenant_providers
  ├─ id (UUID)
  ├─ tenant_id (FK)
  ├─ provider ('uazapi', 'evolution')
  ├─ account_id
  ├─ credentials_ref (Supabase Vault)
  └─ metadata (adminField01, adminField02, etc)

instance_registry
  ├─ id (UUID)
  ├─ tenant_provider_id (FK)
  ├─ remote_instance_id (token UAZAPI)
  ├─ status
  ├─ instance_number
  └─ metadata

audit_logs
  ├─ id (UUID)
  ├─ tenant_id (FK)
  ├─ user_id (FK)
  ├─ action
  ├─ details (JSONB)
  └─ created_at
```

### Row Level Security (RLS)

Ativado automaticamente. Usuários veem APENAS dados de seus tenants.

---

## 🔌 Provider Adapter Pattern

### Usar uma Instância UAZAPI

```javascript
import { createProviderManager } from './modules/provider-adapter/provider-manager.js';

const manager = createProviderManager();

const instances = await manager.listInstances('uazapi', {
  serverUrl: 'https://tiatendeai.uazapi.com',
  adminToken: 'xxx',
});

await manager.sendMessage('uazapi', credentials, 'token-123', {
  to: '5531999999999',
  type: 'text',
  content: 'Olá!',
});
```

### Adicionar Novo Provider (Evolution)

```javascript
// 1. Criar arquivo modules/provider-adapter/evolution-adapter.js
import { IProviderAdapter } from './types.js';

export class EvolutionAdapter extends IProviderAdapter {
  async listInstances() { ... }
  async sendMessage(instanceId, payload) { ... }
  // ... implementar interface
}

// 2. Registrar no manager
import { EvolutionAdapter } from './evolution-adapter.js';

providerManager.registerAdapter('evolution', 
  (credentials) => new EvolutionAdapter(credentials)
);
```

Pronto! Código usa `manager.listInstances('evolution', creds)` sem mudanças.

---

## 🚀 Deploy em Produção

### Checklist

- [ ] `JWT_SECRET` é uma string com 32+ caracteres aleatória
- [ ] `ENABLE_DEV_MODE=false` (ou não setado)
- [ ] `NODE_ENV=production`
- [ ] Google OAuth credentials criadas em GCP
- [ ] CORS whitelist específica (não `*`)
- [ ] Supabase migrations rodadas
- [ ] TLS/HTTPS forçado via Cloudflare
- [ ] Secrets (tokens UAZAPI) em Supabase Vault

### Variáveis Obrigatórias

```bash
JWT_SECRET=xxxxx # 32+ chars
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://app.ruptur.cloud/auth/google/callback
DOMAIN_PRIMARY=app.ruptur.cloud
CORS_ORIGIN=https://app.ruptur.cloud
NODE_ENV=production
ENABLE_DEV_MODE=false
```

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY . .
RUN npm install

ENV NODE_ENV=production
ENV ENABLE_DEV_MODE=false

CMD ["node", "modules/warmup-core/server-secured.mjs"]
```

---

## 🧪 Testes

### Dev Mode (Com Bypass)

```bash
# Status
curl http://localhost:8787/dev/status

# Gerar token
TOKEN=$(curl http://localhost:8787/dev/mock/token | jq -r .token)

# Usar token em requests
curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/wallet/balance
```

### Produção (Com Auth Real)

```bash
# 1. Fazer login no Google
open http://localhost:8787/auth/google

# 2. Cookie httpOnly é setado automaticamente
# 3. Requests subsequentes usam cookie

curl -b cookies.txt http://localhost:8787/api/wallet/balance
```

---

## 🆘 Troubleshooting

### "JWT_SECRET must be at least 32 characters"

```bash
# Gere uma chave forte
openssl rand -base64 32
# Cole em .env como JWT_SECRET=xxxxx
```

### "Dev mode disabled in production"

Dev routes (`/dev/`) são bloqueadas se `NODE_ENV=production`. Para ativar:

```bash
ENABLE_DEV_MODE=true NODE_ENV=development node ...
```

### "Unauthorized: No token"

Requisição não tem JWT. Faça login antes:

```bash
curl http://localhost:8787/auth/google
# Depois use o cookie setado
```

### "Forbidden: Tenant must be from session"

Você tentou passar `tenantId` na query string. Remova:

```bash
# ❌ Errado
curl "http://localhost:8787/api/wallet/balance?tenantId=123"

# ✅ Certo (tenant vem do JWT/sessão)
curl http://localhost:8787/api/wallet/balance
```

---

## 📚 Próximos Passos

1. **Integrar endpoints existentes** (inbox, campaigns, wallet)
   - Cada um usa `req.session.tenantId` automaticamente

2. **Implementar Evolution adapter**
   - Crie `modules/provider-adapter/evolution-adapter.js`
   - Registre em `provider-manager.js`

3. **Secrets management**
   - Mover tokens UAZAPI pra Supabase Vault
   - Usar `credentials_ref` em lugar de plaintext

4. **Audit logging**
   - Cada ação sensível loga em `audit_logs`
   - Imutável (RLS prevents deletes)

---

## 🔗 Referências

- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [JWT.io](https://jwt.io/)
- [OWASP Multi-tenant](https://owasp.org/www-community/attacks/Multi-Tenancy_Failure)
