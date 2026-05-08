# Testes de Regressão — Phase 2

**Total**: 19 casos de teste  
**Duração estimada**: 20 minutos  
**Pré-requisito**: Todos os 23 testes iniciais devem ter PASSADO

## Objetivo
Validar que as features antigas (criadas antes de Phase 2) continuam funcionando corretamente após a implementação de auto-provisioning.

⚠️ **Regra Crítica**: Se qualquer teste de regressão falhar, implica **ROLLBACK** para versão anterior.

---

## Seção 1: Message Library (5 testes)

### Teste R1.1 - Listar Mensagens em Message Library
**Objetivo**: Verificar que usuário consegue recuperar lista de mensagens salvas

```javascript
// Fazer login (usar token do teste inicial)
const messageResponse = await fetch(
  'https://app.ruptur.cloud/api/message-library',
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const messageData = await messageResponse.json();
console.log('Message library:', messageData);

// ✅ PASSAR se:
// - Status 200
// - Response é array de mensagens ou { messages: [...] }
// - Cada mensagem tem { id, title, content, createdAt, updatedAt }
```

---

### Teste R1.2 - Criar Nova Mensagem
**Objetivo**: Verificar que usuário consegue salvar nova mensagem

```javascript
const newMessageResponse = await fetch(
  'https://app.ruptur.cloud/api/message-library',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Test Message',
      content: 'This is a test message for regression testing'
    })
  }
);
const newMessageData = await newMessageResponse.json();
console.log('Created message:', newMessageData);

// ✅ PASSAR se:
// - Status 201 ou 200
// - Response contém { id, title, content, createdAt, tenantId }
// - ID é um UUID válido
```

---

### Teste R1.3 - Atualizar Mensagem Existente
**Objetivo**: Verificar que usuário consegue editar mensagem

```javascript
const updateResponse = await fetch(
  `https://app.ruptur.cloud/api/message-library/${messageId}`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Updated Title',
      content: 'Updated content for testing'
    })
  }
);
const updateData = await updateResponse.json();
console.log('Updated message:', updateData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { title: 'Updated Title', ... }
// - updatedAt é mais recente que antes
```

---

### Teste R1.4 - Deletar Mensagem
**Objetivo**: Verificar que usuário consegue remover mensagem

```javascript
const deleteResponse = await fetch(
  `https://app.ruptur.cloud/api/message-library/${messageId}`,
  {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const deleteData = await deleteResponse.json();
console.log('Delete response:', deleteData);

// ✅ PASSAR se:
// - Status 200 ou 204
// - Response contém { success: true } ou vazio
// - GET /message-library não retorna mais essa mensagem
```

---

### Teste R1.5 - Message Library Isolada por Tenant
**Objetivo**: Verificar que usuário A não consegue ver mensagens de usuário B

```javascript
// User A cria mensagem
// User B tenta acessar lista (deve estar vazia ou sem mensagem de A)

const userBListResponse = await fetch(
  'https://app.ruptur.cloud/api/message-library',
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${userBToken}` }
  }
);
const userBList = await userBListResponse.json();

// Verificar que userBList não contém mensagem criada por userA
const hasUserAMessage = userBList.messages?.some(m => m.id === userAMessageId);
console.log('User B sees User A message?:', hasUserAMessage);

// ✅ PASSAR se:
// - hasUserAMessage = false
// - User B vê apenas suas próprias mensagens
```

---

## Seção 2: Campaigns (5 testes)

### Teste R2.1 - Listar Campanhas
**Objetivo**: Verificar que usuário consegue listar suas campanhas

```javascript
const campaignsResponse = await fetch(
  'https://app.ruptur.cloud/api/campaigns',
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const campaignsData = await campaignsResponse.json();
console.log('Campaigns list:', campaignsData);

// ✅ PASSAR se:
// - Status 200
// - Response é array ou { campaigns: [...] }
// - Cada campanha tem { id, name, status, createdAt, messageCount }
```

---

### Teste R2.2 - Criar Campaign
**Objetivo**: Verificar que usuário consegue criar nova campanha

```javascript
const newCampaignResponse = await fetch(
  'https://app.ruptur.cloud/api/campaigns',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Test Campaign',
      messages: ['Hello world', 'Follow-up message'],
      targetAudience: 'all',
      schedule: new Date(Date.now() + 3600000).toISOString()
    })
  }
);
const newCampaignData = await newCampaignResponse.json();
console.log('Created campaign:', newCampaignData);

// ✅ PASSAR se:
// - Status 201 ou 200
// - Response contém { id, name, status: 'draft', createdAt }
```

---

### Teste R2.3 - Atualizar Campaign
**Objetivo**: Verificar que usuário consegue editar campanha

```javascript
const updateCampaignResponse = await fetch(
  `https://app.ruptur.cloud/api/campaigns/${campaignId}`,
  {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Updated Campaign Name'
    })
  }
);
const updateCampaignData = await updateCampaignResponse.json();

// ✅ PASSAR se:
// - Status 200
// - name foi alterado
```

---

### Teste R2.4 - Deletar Campaign
**Objetivo**: Verificar que usuário consegue deletar campanha

```javascript
const deleteCampaignResponse = await fetch(
  `https://app.ruptur.cloud/api/campaigns/${campaignId}`,
  {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

// ✅ PASSAR se:
// - Status 200 ou 204
// - GET /campaigns não retorna mais essa campanha
```

---

### Teste R2.5 - Campaigns Isoladas por Tenant
**Objetivo**: Verificar que user A não vê campanhas de user B

```javascript
// User A cria campanha
// User B lista campanhas (deve estar vazia ou sem campanha de A)

const userBCampaignsResponse = await fetch(
  'https://app.ruptur.cloud/api/campaigns',
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${userBToken}` }
  }
);
const userBCampaigns = await userBCampaignsResponse.json();
const hasUserACampaign = userBCampaigns.campaigns?.some(c => c.id === userACampaignId);

// ✅ PASSAR se:
// - hasUserACampaign = false
```

---

## Seção 3: Inbox & Messages (4 testes)

### Teste R3.1 - Listar Mensagens do Inbox
**Objetivo**: Verificar que usuário consegue recuperar mensagens recebidas

```javascript
const inboxResponse = await fetch(
  'https://app.ruptur.cloud/api/inbox',
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const inboxData = await inboxResponse.json();
console.log('Inbox:', inboxData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { messages: [...] } ou array
// - Cada mensagem tem { id, from, content, receivedAt, status }
```

---

### Teste R3.2 - Marcar Mensagem como Lida
**Objetivo**: Verificar que usuário consegue marcar inbox message como read

```javascript
const markReadResponse = await fetch(
  `https://app.ruptur.cloud/api/inbox/${messageId}/read`,
  {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

// ✅ PASSAR se:
// - Status 200
// - GET /inbox mostra mensagem com status: 'read'
```

---

### Teste R3.3 - Deletar Mensagem do Inbox
**Objetivo**: Verificar que usuário consegue remover mensagem

```javascript
const deleteInboxResponse = await fetch(
  `https://app.ruptur.cloud/api/inbox/${messageId}`,
  {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

// ✅ PASSAR se:
// - Status 200 ou 204
// - GET /inbox não retorna mais essa mensagem
```

---

### Teste R3.4 - Inbox Isolada por Tenant
**Objetivo**: Verificar que user A não vê inbox de user B

```javascript
// Assumir que há mensagens em diferentes tenants
// User A lista inbox
// Verificar que não contém mensagens de user B

const userAInbox = await (await fetch('https://app.ruptur.cloud/api/inbox', {
  headers: { 'Authorization': `Bearer ${userAToken}` }
})).json();

const userBInbox = await (await fetch('https://app.ruptur.cloud/api/inbox', {
  headers: { 'Authorization': `Bearer ${userBToken}` }
})).json();

const hasOverlap = userAInbox.messages?.some(m => 
  userBInbox.messages?.some(b => b.id === m.id)
);

// ✅ PASSAR se:
// - hasOverlap = false
// - Cada tenant vê apenas suas mensagens
```

---

## Seção 4: Billing & Credits (3 testes)

### Teste R4.1 - Consultar Saldo de Créditos
**Objetivo**: Verificar que usuário consegue ver saldo

```javascript
const billingResponse = await fetch(
  'https://app.ruptur.cloud/api/billing/balance',
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const billingData = await billingResponse.json();
console.log('Billing balance:', billingData);

// ✅ PASSAR se:
// - Status 200
// - Response contém { balance: X, plan: 'trial', creditsRemaining: Y }
// - balance >= 0
```

---

### Teste R4.2 - Consultar Histórico de Transações
**Objetivo**: Verificar que usuário consegue ver histórico de uso de créditos

```javascript
const historyResponse = await fetch(
  'https://app.ruptur.cloud/api/billing/transactions',
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const historyData = await historyResponse.json();

// ✅ PASSAR se:
// - Status 200
// - Response contém { transactions: [ { id, amount, type, date, description } ] }
```

---

### Teste R4.3 - Plano de Trial Válido
**Objetivo**: Verificar que novo usuário recebe trial correto

```javascript
// Fazer login com novo usuário
// Verificar GET /api/admin/tenants/{id}/billing

const billingResponse = await fetch(
  `https://app.ruptur.cloud/api/admin/tenants/${newUserTenantId}/billing`,
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${newUserToken}` }
  }
);
const billing = await billingResponse.json();

// ✅ PASSAR se:
// - plan = 'trial'
// - creditsBalance = 1000
// - trialEndsAt está 30 dias no futuro
// - isExpired = false
```

---

## Seção 5: Warmup (2 testes)

### Teste R5.1 - GET /api/warmup/config (Legacy)
**Objetivo**: Verificar que warmup config continua funcionando (agora com auto-provisioning)

```javascript
const warmupResponse = await fetch(
  'https://app.ruptur.cloud/api/warmup/config',
  {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
const warmupData = await warmupResponse.json();

// ✅ PASSAR se:
// - Status 200
// - Response contém { tenantId, tenantSlug, warmupUrl, instanceToken }
// - warmupUrl é uma URL válida
// - instanceToken é uma string não-vazia
```

---

### Teste R5.2 - Warmup Isolada por Tenant
**Objetivo**: Verificar que cada tenant tem seu próprio warmup config

```javascript
// User A e User B fazem GET /warmup/config
const userAWarmup = await (await fetch('https://app.ruptur.cloud/api/warmup/config', {
  headers: { 'Authorization': `Bearer ${userAToken}` }
})).json();

const userBWarmup = await (await fetch('https://app.ruptur.cloud/api/warmup/config', {
  headers: { 'Authorization': `Bearer ${userBToken}` }
})).json();

console.log('A tenantId:', userAWarmup.tenantId);
console.log('B tenantId:', userBWarmup.tenantId);

// ✅ PASSAR se:
// - userAWarmup.tenantId !== userBWarmup.tenantId
// - warmupUrl de A é diferente de warmup de B
```

---

## Resumo de Execução

| # | Teste | Status | Notas |
|---|-------|--------|-------|
| R1.1 | Listar mensagens | ⏳ | |
| R1.2 | Criar mensagem | ⏳ | |
| R1.3 | Atualizar mensagem | ⏳ | |
| R1.4 | Deletar mensagem | ⏳ | |
| R1.5 | Isolamento tenant | ⏳ | |
| R2.1 | Listar campanhas | ⏳ | |
| R2.2 | Criar campanha | ⏳ | |
| R2.3 | Atualizar campanha | ⏳ | |
| R2.4 | Deletar campanha | ⏳ | |
| R2.5 | Isolamento campanha | ⏳ | |
| R3.1 | Listar inbox | ⏳ | |
| R3.2 | Marcar como lido | ⏳ | |
| R3.3 | Deletar inbox message | ⏳ | |
| R3.4 | Isolamento inbox | ⏳ | |
| R4.1 | Saldo de créditos | ⏳ | |
| R4.2 | Histórico transações | ⏳ | |
| R4.3 | Trial válido | ⏳ | |
| R5.1 | Warmup config | ⏳ | |
| R5.2 | Warmup isolado | ⏳ | |

---

## Critério de Sucesso

✅ Todos os 19 testes devem PASSAR

Se **qualquer teste falhar**:
1. Analisar com DEBUGGING_GUIDE.md
2. Se é regressão de código antigo → ROLLBACK para versão anterior
3. Se é incompatibilidade com Phase 2 → Debug e fix
4. Re-executar até todos passarem
