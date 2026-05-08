# 🔗 INTEGRAÇÃO: BUBBLE + UAZAPI + RUPTUR (GCP)

**Data**: 2026-05-07  
**Escopo**: Apenas as 3 peças que você TEM AGORA  
**Foco**: Fazer Bubble inbox aparecer transparente dentro Ruptur

---

## 📊 O QUE VOCÊ TEM

### ✅ BUBBLE (Pronto)
- **App**: tiatendeai (seu projeto Bubble)
- **Plugin**: uazapiGO v2.0 (105 endpoints UAZAPI integrados)
- **Inbox Demo**: uazapigo-multiatendimento.bubbleapps.io (omnichannel pronto)
- **Autenticação**: System login / API keys
- **Status**: 100% funcional

### ✅ UAZAPI (Pronto)
- **Servidor**: tiatendeai.uazapi.com
- **Token Instance**: c81a5296-36db-4b80-8a47-96539591261b
- **Endpoints**: 105 (send, receive, webhooks, etc)
- **Webhook**: Já configurado → envia mensagens para Bubble
- **Status**: Vivo em produção

### ✅ RUPTUR (Produção)
- **API Gateway**: app.ruptur.cloud (porta 3001)
- **Supabase**: Multi-tenant com RLS
- **Auth**: JWT + API keys por tenant
- **Frontend**: SPA React/Next (web/client-area)
- **Integrações**: Getnet, Cakto, UAZAPI
- **Status**: Live GCP

---

## 🎯 O PROBLEMA HOJE

**Usuário em Ruptur**:
```
app.ruptur.cloud/dashboard
  ↓
Clica "Inbox" 
  ↓
❌ Não existe (ou é básico)
  ↓
Precisa ir para Bubble separadamente
  ↓
uazapigo-multiatendimento.bubbleapps.io
  ↓
"É outro site?"
```

**Resultado**: Fricção de contexto. Usuário perde confiança.

---

## ✅ A SOLUÇÃO: BUBBLE TRANSPARENTE EM RUPTUR

### Cenário Desejado
```
app.ruptur.cloud/inbox
  ↓
Abre Bubble inbox DENTRO de Ruptur
  ↓
Usuário não sabe que é Bubble (transparente)
  ↓
Responde mensagens WhatsApp
  ↓
Tudo funciona
```

---

## 🛠️ COMO FAZER (3 Passos)

### PASSO 1: Backend Ruptur — Criar Endpoint `/api/bubble/token` (2h)

**Objetivo**: Gerar token que prova "esse usuário tem permissão de acessar Bubble"

**Arquivo**: `/api/routes-bubble.mjs` (novo)

```javascript
// /api/routes-bubble.mjs

import { jwtDecode } from 'jwt-decode';

export async function handleBubbleRoutes(req, res, json) {
  const { method, url } = req;
  const path = new URL(url, `http://${req.headers.host}`).pathname;

  // GET /api/bubble/token
  if (method === 'GET' && path === '/api/bubble/token') {
    return handleBubbleToken(req, res, json);
  }

  return res.writeHead(404).end(json({ error: 'Not found' }));
}

async function handleBubbleToken(req, res, json) {
  try {
    // 1. Extrair JWT do header Authorization
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.writeHead(401).end(json({ error: 'No token' }));
    }

    // 2. Decodificar JWT (Supabase JWT)
    let decoded;
    try {
      decoded = jwtDecode(token);
    } catch (e) {
      return res.writeHead(401).end(json({ error: 'Invalid token' }));
    }

    const userId = decoded.sub; // UUID Supabase user
    const email = decoded.email;
    const tenantId = decoded.custom_claims?.tenant_id; // Se stored em JWT

    if (!userId || !tenantId) {
      return res.writeHead(401).end(json({ 
        error: 'Missing tenant_id in token. Você está logado em qual tenant?' 
      }));
    }

    // 3. Gerar token Bubble (simple JWT assinado por Ruptur)
    // Bubble vai usar esse token para validar que veio de Ruptur
    const bubbleToken = Buffer.from(JSON.stringify({
      user_id: userId,
      email: email,
      tenant_id: tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1h expiry
    })).toString('base64');

    // 4. Retornar URL Bubble + token
    const bubbleUrl = 'https://uazapigo-multiatendimento.bubbleapps.io';
    const bubbleWithToken = `${bubbleUrl}?token=${bubbleToken}&tenant_id=${tenantId}`;

    return res.writeHead(200).end(json({
      bubble_url: bubbleWithToken,
      token: bubbleToken,
      expires_in: 3600
    }));

  } catch (error) {
    console.error('Error generating bubble token:', error);
    return res.writeHead(500).end(json({ error: error.message }));
  }
}

export default handleBubbleRoutes;
```

**Integrar em `gateway.mjs`**:

```javascript
// Adicionar no import (topo do arquivo)
import * as bubbleRoutes from './routes-bubble.mjs';

// Adicionar no switch de rotas
if (path.startsWith('/api/bubble')) {
  return bubbleRoutes.handleBubbleRoutes(req, res, json);
}
```

**Testar**:
```bash
curl -X GET http://localhost:3001/api/bubble/token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response:
# {
#   "bubble_url": "https://uazapigo-multiatendimento.bubbleapps.io?token=...&tenant_id=...",
#   "token": "...",
#   "expires_in": 3600
# }
```

---

### PASSO 2: Frontend Ruptur — Componente Inbox (3h)

**Arquivo**: `/web/client-area/src/pages/Inbox.jsx` (novo)

```jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/auth'; // seu contexto auth
import { useNavigate } from 'react-router-dom';

export default function Inbox() {
  const { user, getToken } = useAuth(); // JWT token
  const [bubbleUrl, setBubbleUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchBubbleToken() {
      try {
        const token = await getToken(); // Get JWT from Supabase
        
        const res = await fetch('/api/bubble/token', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) {
          throw new Error('Failed to get bubble token');
        }

        const data = await res.json();
        setBubbleUrl(data.bubble_url);
        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setError(err.message);
        setLoading(false);
      }
    }

    if (user) {
      fetchBubbleToken();
    } else {
      navigate('/login');
    }
  }, [user]);

  if (loading) {
    return <div className="p-8">Carregando inbox...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Erro: {error}</div>;
  }

  if (!bubbleUrl) {
    return <div className="p-8">Nenhuma URL gerada</div>;
  }

  return (
    <div className="w-full h-screen">
      {/* Iframe transparente */}
      <iframe
        src={bubbleUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '0.5rem'
        }}
        title="Inbox Omnichannel"
        allow="camera;microphone"
      />
    </div>
  );
}
```

**Adicionar rota no React Router**:

```jsx
// Em seu routing setup
import Inbox from './pages/Inbox';

// Adicionar:
<Route path="/inbox" element={<Inbox />} />
```

**Testar**:
- Acesse: `app.ruptur.cloud/inbox`
- Deve carregar iframe Bubble
- Deve mostrar conversas WhatsApp
- Responsivo mobile

---

### PASSO 3: Bubble — Validar Token Ruptur (2h)

**Em Bubble** (tiatendeai app):

**Página**: Criar nova página "Inbox (Ruptur Token)" ou modify existente

**Workflow: Page Load**:

```
Trigger: Page loads
│
├─ Check if ?token param exists
│  └─ If NO: Usar login normal Bubble
│  └─ If YES: Continuar abaixo
│
├─ HTTP GET Ruptur /api/bubble/validate
│  ├─ Header: X-Token: [?token param]
│  ├─ Expected Response: { valid: true, tenant_id, user_id }
│  └─ If ERROR: Redirect to login
│
├─ Set State: current_tenant_id = response.tenant_id
├─ Set State: current_user_id = response.user_id
│
└─ Load conversations WHERE tenant_id = current_tenant_id
   (Filtra apenas conversas desse tenant)
```

**Backend Ruptur — Validar Token** (adicionar em `routes-bubble.mjs`):

```javascript
// POST /api/bubble/validate
async function handleBubbleValidate(req, res, json) {
  try {
    const token = req.headers['x-token'];
    
    if (!token) {
      return res.writeHead(401).end(json({ error: 'No token' }));
    }

    // Decodificar base64 token que geramos em PASSO 1
    let decoded;
    try {
      const decoded_str = Buffer.from(token, 'base64').toString('utf-8');
      decoded = JSON.parse(decoded_str);
    } catch (e) {
      return res.writeHead(401).end(json({ error: 'Invalid token format' }));
    }

    // Validar expiry
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      return res.writeHead(401).end(json({ error: 'Token expired' }));
    }

    // Retornar dados validados
    return res.writeHead(200).end(json({
      valid: true,
      user_id: decoded.user_id,
      email: decoded.email,
      tenant_id: decoded.tenant_id
    }));

  } catch (error) {
    console.error('Error validating token:', error);
    return res.writeHead(500).end(json({ error: error.message }));
  }
}
```

---

## 📊 FLUXO COMPLETO (Visão Geral)

```
1. Usuário em Ruptur clica "Inbox"
   ↓
2. React manda GET /api/bubble/token (com JWT Ruptur)
   ↓
3. Ruptur valida JWT → Gera token Bubble → Retorna URL com token
   ↓
4. React abre iframe com URL Bubble + token
   ↓
5. Bubble page load → Valida token em Ruptur
   ↓
6. Bubble filtra conversas por tenant_id
   ↓
7. Usuário vê apenas SUAS conversas WhatsApp
   ↓
8. Responde mensagem → UAZAPI webhook → volta para Bubble
   ↓
9. Tudo transparente (usuário não sabe que é Bubble)
```

---

## ⚙️ VALIDAÇÃO SECURITY

### Concern: Passar token para Bubble é seguro?

✅ **SIM**, porque:

1. **Token é short-lived** (1h expiry)
2. **Token em URL é seguro porque**:
   - HTTPS sempre (app.ruptur.cloud é HTTPS)
   - Token validado em Ruptur antes de usar
   - Não contém senhas, apenas user_id + tenant_id
3. **Isolamento por tenant_id**: 
   - Usuário A (tenant 1) não vê conversations de usuário B (tenant 2)
   - Bubble filtra conversations by tenant_id
4. **Bubble valida cada token**:
   - Chamada HTTPS para Ruptur `/api/bubble/validate`
   - Se falhar: redirect login

### Concern: Bubble vê dados sensíveis?

✅ **NÃO**, porque:

- Bubble recebe apenas: `user_id`, `email`, `tenant_id`
- Não recebe: API keys, tokens completos, senhas
- Bubble busca conversations de Supabase via UAZAPI (que já tem controle)

---

## ⏱️ ESTIMATIVA

| Passo | O Quê | ETA | Complexidade |
|-------|-------|-----|--------------|
| 1 | Backend endpoint `/api/bubble/token` | 2h | Simples (JWT decode) |
| 2 | Frontend component `<Inbox />` | 3h | Simples (iframe) |
| 3 | Bubble valida token | 2h | Simples (HTTP call) |
| **TOTAL** | **Integração live** | **7h** | **Baixa** |

---

## 🚀 DEPLOY (Checklist)

- [ ] Criar `/api/routes-bubble.mjs`
- [ ] Integrar em `gateway.mjs`
- [ ] Testar endpoint `/api/bubble/token` localmente
- [ ] Criar `<Inbox />` componente
- [ ] Testar iframe Bubble em Ruptur (localhost)
- [ ] Bubble workflow validar token
- [ ] Teste E2E: login Ruptur → clica Inbox → vê conversas
- [ ] Deploy em produção (GCP)
- [ ] Monitor: 24h sem erros
- [ ] Documentar em AGENTS.md

---

## 💡 RESULTADO FINAL

```
app.ruptur.cloud
├─ Dashboard
├─ Campaigns
├─ ✨ Inbox ← BUBBLE (transparente)
├─ Analytics
└─ Settings
```

**Para usuário**: Tudo é Ruptur.  
**Tecnicamente**: Bubble cuida do inbox.  
**Vantagem**: Zero desenvolvimento de inbox. Bubble já faz.

---

## ⚠️ IMPORTANTE

**NÃO FAZER**:
- ❌ Migrar Bubble para outra plataforma
- ❌ Reconstruir inbox do zero
- ❌ Complicar com Chatwoot / N8N / outras ferramentas

**FAZER**:
- ✅ Apenas integrar o que já existe
- ✅ Manter Bubble rodando
- ✅ Manter UAZAPI webhook vivo
- ✅ Transparência para usuário

**Resultado**: MVP rápido (7h), produção estável, usuário feliz.

---

**Pronto para começar? Qual passo atacamos primeiro?**
