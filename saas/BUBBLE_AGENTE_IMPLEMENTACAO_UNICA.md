# 🎯 BUBBLE AGENTE — BRIEFING ÚNICO DE IMPLEMENTAÇÃO

**Destinatário**: Claude Agent (Haiku 4.5) rodando no Browser da Bubble  
**Data**: 2026-05-08  
**Projeto**: Ruptur SaaS — Inbox Omnichannel Backend  
**Status**: Pronto para Implementação (AGORA)

---

## 🔐 CREDENCIAIS & ACESSO

### Bubble
- **App**: tiatendeai
- **Link Editor**: https://bubble.io/editor/tiatendeai
- **Inbox Demo**: https://uazapigo-multiatendimento.bubbleapps.io
- **Status**: ✅ Logado, pronto

### UAZAPI
- **Servidor**: https://tiatendeai.uazapi.com
- **Instance Token**: `c81a5296-36db-4b80-8a47-96539591261b`
- **Free Server**: https://free.uazapi.com (TTL 1h, testes)
- **Docs**: https://docs.uazapi.com
- **Status**: ✅ Online, **31 instâncias criadas (8 online, 23 offline)**
  - Online: 553173623893, 553173663181, 553173663514, 553173663601, 553175052754, 553173663465, 553173393984, 553173623811
  - Offline: 23 outras (reconectar ou remover)

### Plugin Bubble
- **Nome**: uazapiGO v2.0
- **Link**: https://bubble.io/plugin/uazapigo---whatsapp-api-1725712298105x455773695640076300
- **Status**: ✅ Instalado, 71 actions + 20 data calls já configuradas

### Ruptur Backend
- **API Gateway**: http://localhost:3001 (dev) / app.ruptur.cloud (prod)
- **Webhook Endpoint**: POST `/api/bubble/token`
- **Webhook Endpoint**: POST `/api/bubble/validate`
- **JWT Format**: Bearer token de Supabase (1h TTL)
- **Status**: ✅ Endpoints criados, aguardando Bubble chamar

---

## 🏗️ ARQUITETURA ESPERADA

```
┌─────────────────────────────────────────────────────┐
│         USER: app.ruptur.cloud/inbox                │
│         (Clica em Inbox)                             │
└──────────────────┬──────────────────────────────────┘
                   │ React component
                   │ fetch('/api/bubble/token')
                   ▼
┌──────────────────────────────────────────────────────┐
│   RUPTUR Gateway: POST /api/bubble/token            │
│   - Recebe: Bearer token (JWT Supabase)             │
│   - Extrai: user_id, tenant_id                      │
│   - Gera: token_bubble (base64, 1h exp)             │
│   - Retorna: {bubble_url, token, expires_in}        │
└──────────────────┬──────────────────────────────────┘
                   │ Bubble URL com ?token=...
                   ▼
┌──────────────────────────────────────────────────────┐
│   BUBBLE IFRAME: uazapigo-multiatendimento...       │
│   - Page Load Workflow valida token                 │
│   - POST /api/bubble/validate (chama Ruptur)        │
│   - Recebe: {valid, user_id, tenant_id}             │
│   - Filtra: conversas WHERE tenant_id = X           │
│   - Mostra: inbox omnichannel (transparente)        │
└──────────────────┬──────────────────────────────────┘
                   │ REST calls via uazapiGO plugin
                   ▼
┌──────────────────────────────────────────────────────┐
│   UAZAPI: tiatendeai.uazapi.com                     │
│   - Gerenciar instâncias WhatsApp                   │
│   - Enviar/receber mensagens                        │
│   - Webhooks tempo real                             │
└──────────────────────────────────────────────────────┘
```

---

## 📋 13 WORKFLOWS A IMPLEMENTAR

### GRUPO 1: CONNECTION (1 workflow)

#### 1.1 `wf_connection_check` — Verificar Status Conexão
```
TRIGGER: Page Load Event
INPUT: —
PROCESS:
  1. Call uazapi_connection.status()
  2. Store: current_connection_status
OUTPUT: {status, connected, phone, instance_id}
BUBBLE UI: Badge mostrando "Online/Offline"
RUPTUR IMPACT: Exibe status na página Instances
```

---

### GRUPO 2: MESSAGES (3 workflows)

#### 2.1 `wf_messages_send` — Enviar Mensagem
```
TRIGGER: Custom Event "message_send" from Ruptur
INPUT: {chat_id, body, type, files}
         type: "text" | "image" | "video" | "document"
PROCESS:
  1. Validate: body não vazio
  2. Call uazapi_messages.send({
       chatId: chat_id,
       body: body,
       media: files (se type != text)
     })
  3. Store: message_id, status, timestamp
  4. Update Chat: last_message, last_message_timestamp
OUTPUT: {message_id, status, timestamp}
WU: 3-5
DB: Insert em messages table
```

#### 2.2 `wf_messages_webhook_received` — Receber Webhook
```
TRIGGER: Incoming Webhook (POST /webhooks/uazapi)
INPUT: {event_type, chat_id, sender_id, body, timestamp, status}
PROCESS:
  1. Validate HMAC (SECRET_KEY)
  2. Call uazapi_chats.find({chat_id})
  3. Create Message record
  4. Update Chat record (last_message, unread++)
  5. Calculate Lead Score
  6. Apply Labels (automático)
OUTPUT: {acknowledged: true}
WU: 10-15
DB: Insert messages, Update chats
REALTIME: Trigger Bubble Realtime para UI
```

#### 2.3 `wf_messages_mark_read` — Marcar Como Lido
```
TRIGGER: Custom Event from Ruptur
INPUT: {chat_id}
PROCESS:
  1. Call uazapi_messages.markRead({chat_id})
  2. Update Chat: unread_count = 0
OUTPUT: {success: true}
WU: 2-3
DB: Update chats
```

---

### GRUPO 3: CHATS (2 workflows)

#### 3.1 `wf_chats_list` — Listar Conversas (Server-Side)
```
TRIGGER: API Endpoint /api/chats (de Ruptur)
INPUT: {tenant_id, limit=50, offset=0}
PROCESS:
  1. Query DB: SELECT chats WHERE tenant_id=$1 ORDER BY last_message_timestamp DESC
  2. For each chat:
     - Load contact (contact_id)
     - Load labels (chat_labels)
     - Calculate unread_count
  3. Return: [{chat_id, contact, labels, unread_count, last_message, lead_score}]
OUTPUT: {chats[], total_count}
WU: 5-8
DB: Read-only
EXPOSE: Via API Workflows para Ruptur chamar
```

#### 3.2 `wf_chats_archive` — Arquivar Conversa
```
TRIGGER: Custom Event from Ruptur
INPUT: {chat_id}
PROCESS:
  1. Update Chat: status = "archived"
  2. Call uazapi_chats.archive({chat_id})
OUTPUT: {success: true}
WU: 2-3
DB: Update chats
```

---

### GRUPO 4: CONTACTS (1 workflow)

#### 4.1 `wf_contacts_sync` — Sincronizar Contatos (Server-Side)
```
TRIGGER: Scheduled Workflow (cron 5 min)
INPUT: —
PROCESS:
  1. Call uazapi_contacts.list()
  2. For each contact:
     - Upsert em DB: {phone, name, avatar, last_interaction}
     - Tag: tenant_id, custom_fields
  3. Sync com Google Contacts (opcional)
OUTPUT: {synced_count, updated_count}
WU: 8-12
DB: Upsert contacts
```

---

### GRUPO 5: LABELS (2 workflows)

#### 5.1 `wf_labels_apply` — Aplicar Rótulo a Conversa
```
TRIGGER: Custom Event from Ruptur
INPUT: {chat_id, label_name}
PROCESS:
  1. Create label se não existe: {name, color}
  2. Link chat_id ↔ label_id
  3. Call uazapi_chat_labels.add({chat_id, label_id})
OUTPUT: {success: true, label_id}
WU: 2-3
DB: Insert em chat_labels
```

#### 5.2 `wf_labels_list` — Listar Rótulos (Server-Side)
```
TRIGGER: API Endpoint /api/labels
INPUT: {tenant_id}
PROCESS:
  1. Query DB: SELECT labels WHERE tenant_id=$1
  2. For each: count chats com este label
OUTPUT: {labels[{id, name, color, chat_count}]}
WU: 2-3
DB: Read-only
EXPOSE: Via API Workflows
```

---

### GRUPO 6: LEADS (2 workflows)

#### 6.1 `wf_leads_score_calculate` — Calcular Lead Score
```
TRIGGER: Message Webhook (background)
INPUT: {chat_id, sender_id, body, sentiment}
PROCESS:
  1. Sentiment Analysis (HuggingFace API ou local)
     - Positivo: +30 points
     - Neutro: +10 points
     - Negativo: -20 points
  2. Message recency: se <1h: +5
  3. Message frequency: messages/day: (count / days)
  4. Response time: rápido responder: +10
  5. Total_score = (sentiment + recency + frequency + response) / 4
  6. Update Chat: lead_score
OUTPUT: {lead_score, category} (hot/warm/cold)
WU: 5-8
DB: Update chats (lead_score)
```

#### 6.2 `wf_leads_list_hot` — Listar Leads Hot (Server-Side)
```
TRIGGER: API Endpoint /api/leads/hot
INPUT: {tenant_id}
PROCESS:
  1. Query: SELECT chats WHERE tenant_id=$1 AND lead_score > 70
  2. Order by: lead_score DESC, last_message_timestamp DESC
  3. Load contact, last_message para cada
OUTPUT: {leads[{chat_id, contact, lead_score, last_message}]}
WU: 4-6
DB: Read-only
EXPOSE: Via API Workflows
```

---

### GRUPO 7: GRUPOS (1 workflow) — OPCIONAL (Tier 2)

#### 7.1 `wf_groups_create` — Criar Grupo
```
TRIGGER: Custom Event from Ruptur
INPUT: {group_name, members[phone]}
PROCESS:
  1. Validate: group_name, members > 1
  2. Call uazapi_groups.create({
       groupName: group_name,
       members: members
     })
  3. Store: group_id, metadata
OUTPUT: {group_id, group_name, members_count}
WU: 3-5
DB: Insert em groups table
```

---

## 📊 DATA TYPES A CRIAR NO BUBBLE

### Type: Chat
```
Fields:
  - chat_id (text, unique)
  - tenant_id (text, required)
  - contact (Contact, required)
  - status (text: "open" | "archived" | "blocked")
  - last_message (text)
  - last_message_timestamp (datetime)
  - unread_count (number)
  - lead_score (number 0-100)
  - labels (list of Label)
  - created_at (datetime)
  - updated_at (datetime)
```

### Type: Message
```
Fields:
  - message_id (text, unique)
  - chat_id (text, required)
  - sender_id (text, required)
  - body (text)
  - type (text: "text" | "image" | "video" | "document")
  - media_url (text, optional)
  - status (text: "pending" | "sent" | "delivered" | "read" | "error")
  - timestamp (datetime)
  - edited_at (datetime, optional)
  - reactions (list of text)
```

### Type: Contact
```
Fields:
  - contact_id (text, unique)
  - phone (text, unique)
  - tenant_id (text)
  - name (text)
  - avatar_url (text, optional)
  - email (text, optional)
  - tags (list of text)
  - last_interaction (datetime)
  - custom_fields (JSON)
```

### Type: Label
```
Fields:
  - label_id (text, unique)
  - tenant_id (text)
  - name (text)
  - color (text, hex: #FF0000)
  - created_at (datetime)
```

---

## 🔌 API WORKFLOWS A EXPOR PARA RUPTUR

### Endpoint 1: /api/chats
```
METHOD: GET
PARAMS: tenant_id, limit, offset
RETURNS: {chats, total_count}
AUTHENTICATION: Bearer token (validar tenant_id)
RATE_LIMIT: 4 req/sec per tenant
```

### Endpoint 2: /api/messages/send
```
METHOD: POST
BODY: {chat_id, body, type, files}
RETURNS: {message_id, status, timestamp}
AUTHENTICATION: Bearer token
```

### Endpoint 3: /api/labels
```
METHOD: GET
PARAMS: tenant_id
RETURNS: {labels[]}
AUTHENTICATION: Bearer token
```

### Endpoint 4: /api/leads/hot
```
METHOD: GET
PARAMS: tenant_id
RETURNS: {leads[]}
AUTHENTICATION: Bearer token
```

### Endpoint 5: /api/contacts/sync
```
METHOD: POST
BODY: {force_sync: boolean}
RETURNS: {synced_count}
AUTHENTICATION: Bearer token
```

---

## 🧪 TESTES A EXECUTAR

### Teste 1: Connection Check
```
PROCEDURE:
  1. Abrir Bubble editor
  2. Page Load → wf_connection_check
  3. Verificar console.log(current_connection_status)
  4. Expected: {status: "online", connected: true, phone: "+55..."}
```

### Teste 2: Send Message
```
PROCEDURE:
  1. Criar chat_id fake: "test_123"
  2. Trigger: wf_messages_send({
       chat_id: "test_123",
       body: "Test message",
       type: "text"
     })
  3. Expected: message_id retornado, status "sent"
  4. Verificar DB: INSERT em messages
```

### Teste 3: Webhook Reception
```
PROCEDURE:
  1. POST /webhooks/uazapi
  2. BODY: {
       event_type: "message.received",
       chat_id: "test_123",
       sender_id: "user_456",
       body: "Webhook test",
       timestamp: "2026-05-08T10:00:00Z"
     }
  3. Expected: {acknowledged: true}
  4. Verificar: Chat updated, Message created
```

### Teste 4: List Chats
```
PROCEDURE:
  1. GET /api/chats?tenant_id=xxx&limit=10
  2. Expected: [{chat_id, contact, lead_score, unread_count}]
  3. Verificar: Paginação funciona
```

### Teste 5: Lead Score
```
PROCEDURE:
  1. Trigger message com sentimento positivo
  2. wf_leads_score_calculate executar
  3. Verificar: lead_score aumentou
  4. GET /api/leads/hot → deve incluir este chat
```

---

## 🔧 VARIÁVEIS DE AMBIENTE A CONFIGURAR

```
# RUPTUR API (onde validar token)
RUPTUR_API_URL=http://localhost:3001  (dev) / app.ruptur.cloud (prod)
RUPTUR_WEBHOOK_SECRET=<HMAC secret key>

# UAZAPI
UAZAPI_BASE_URL=https://tiatendeai.uazapi.com
UAZAPI_INSTANCE_TOKEN=c81a5296-36db-4b80-8a47-96539591261b

# BUBBLE SETTINGS
BUBBLE_APP_NAME=tiatendeai
BUBBLE_API_VERSION=v2

# OPTIONAL: Integrations
HUGGINGFACE_API_KEY=<opcional, para sentiment>
GOOGLE_CONTACTS_API_KEY=<opcional, sync>

# SECURITY
JWT_SECRET=<use Ruptur JWT, não criar novo>
WEBHOOK_TIMEOUT_SECONDS=30
RATE_LIMIT_PER_TENANT=4 req/sec
```

---

## 📊 ESTIMATIVA WORKLOAD UNITS

| Workflow | Trigger | WU/exec | Est. Daily |
|----------|---------|---------|-----------|
| connection_check | Page load | 1 | 100 |
| messages_send | User action | 3-5 | 500 |
| messages_webhook | Incoming | 10-15 | 2000 |
| messages_mark_read | User action | 2-3 | 200 |
| chats_list | API call | 5-8 | 500 |
| chats_archive | User action | 2-3 | 100 |
| contacts_sync | Cron 5min | 8-12 | 2000 |
| labels_apply | User action | 2-3 | 200 |
| labels_list | API call | 2-3 | 300 |
| leads_score | Background | 5-8 | 500 |
| leads_list_hot | API call | 4-6 | 200 |
| groups_create | User action | 3-5 | 50 |
| **TOTAL** | — | — | **~7K/day** |

**Mensal**: 7K × 30 = 210K (dentro do 250K ✅)  
**Margem**: 40K de sobra

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### FASE 1: Setup (2h)
- [ ] Data Types criados (Chat, Message, Contact, Label)
- [ ] Tables no Bubble Database inicializadas
- [ ] Plugin uazapiGO v2.0 confirmado instalado
- [ ] Environment variables configuradas

### FASE 2: Connection (2h)
- [ ] wf_connection_check implementado
- [ ] Page Load trigger testado
- [ ] Console.log status funcionando

### FASE 3: Messages (4h)
- [ ] wf_messages_send implementado
- [ ] wf_messages_webhook_received implementado
- [ ] wf_messages_mark_read implementado
- [ ] Testes com mensagens reais

### FASE 4: Chats (3h)
- [ ] wf_chats_list (server-side) implementado
- [ ] wf_chats_archive implementado
- [ ] API Endpoint /api/chats exposto

### FASE 5: Contacts (2h)
- [ ] wf_contacts_sync implementado
- [ ] Cron job 5min configurado
- [ ] Sync Google Contacts (opcional)

### FASE 6: Labels (2h)
- [ ] wf_labels_apply implementado
- [ ] wf_labels_list implementado
- [ ] UI para aplicar labels

### FASE 7: Leads (3h)
- [ ] wf_leads_score_calculate implementado
- [ ] wf_leads_list_hot implementado
- [ ] Sentiment analysis integrado

### FASE 8: Testes E2E (2h)
- [ ] Teste full flow: send → receive → score
- [ ] Teste API endpoints
- [ ] Teste rate limiting
- [ ] Load test (100 chats simultâneos)

### FASE 9: Deploy (1h)
- [ ] Migrar de free.uazapi.com para tiatendeai.uazapi.com
- [ ] Primeiro número WhatsApp conectado
- [ ] Webhook ativo recebendo eventos

---

## 🚨 PROBLEMAS CONHECIDOS A RESOLVER

### ⚠️ FINANCEIRO
- [ ] **URGENTE**: Verificar problema de pagamento UAZAPI/Bubble
  - Contato: Diego (ruptur.cloud@gmail.com)
  - Status: Bloqueado até resolver

### ⚠️ INSTÂNCIA WHATSAPP
- [ ] Conectar primeiro número (criar instância em tiatendeai.uazapi.com)
- [ ] Geração QR code para scan
- [ ] Validação conexão antes de produção

### ⚠️ WEBHOOK
- [ ] Confirmar app.ruptur.cloud acessível publicamente
- [ ] HMAC signature validation implementado
- [ ] Retry logic para falhas

---

## 📞 CONTATO & SUPORTE

**Proprietário**: Diego  
**Email**: ruptur.cloud@gmail.com  
**Slack**: @thearch  
**GitHub**: /ruptur-cloud/ruptur-main

**Em caso de dúvidas**:
1. Consultar BUBBLE_UAZAPI_RUPTUR_INTEGRAÇÃO.md
2. Consultar UAZAPI_TUDO_QUE_DA_FAZER.md
3. Checar docs.uazapi.com
4. Contatar Diego

---

## 🎯 SUCESSO = QUANDO?

```
✅ Usuário clica /inbox em app.ruptur.cloud
✅ Iframe Bubble carrega transparente
✅ Vê conversas WhatsApp filtradas por tenant_id
✅ Consegue responder mensagens
✅ Lead score calculado automaticamente
✅ 250K WU/mês consumidos com margem de sobra
```

**Status**: 🟢 **READY TO IMPLEMENT NOW**

---

**Versão**: 1.0  
**Data Criação**: 2026-05-08  
**Próxima Revisão**: Após Fase 1 completa
