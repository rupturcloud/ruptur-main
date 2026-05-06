# 🎯 Audit de UX/UI — Ruptur SaaS

**Data**: 2026-05-06  
**Escopo**: DashboardHome, Warmup, Campaigns, Wallet, Instances, AdminDashboard  
**Prioridade**: Sustentação e redução de fricção

---

## ✅ Pontos Fortes

### **Dashboard Home**
- ✅ Checklist de início rápido claro (2/4 completo)
- ✅ Motions/animações suaves (framer-motion)
- ✅ Atalhos diretos para próximos passos (botões azuis)
- ✅ Cards de stats com ícones coloridos
- ✅ Atividade recente com timeline visual

### **Wallet**
- ✅ Hierarquia clara: saldo grande, histórico abaixo
- ✅ Filtros por tipo de transação (crédito/débito/campanha)
- ✅ CTA destacado ("Adicionar Créditos")
- ✅ Diferenciação visual de tipos (cores, ícones)
- ✅ Handling de loading state

### **Instances**
- ✅ Form simples: nome + conexão
- ✅ Status visual clara (conectada/conectando/desconectada)
- ✅ QR code + pair code para conectar
- ✅ Refresh automático após ação
- ✅ Totals resumido (x/y online)

### **Warmup**
- ✅ Abas bem organizadas (overview/instâncias/rotinas/etc)
- ✅ Stats com cards visuais
- ✅ Início/pausa/parar com confirmação
- ✅ Histórico de ações
- ✅ Configurações por aba

### **Campaigns**
- ✅ Wizard claro para nova campanha
- ✅ Upload CSV com parsing automático
- ✅ Botões de ação (launch/pause/stop)
- ✅ Confirmação antes de parar
- ✅ Tratamento de erro em upload

### **AdminDashboard**
- ✅ Environment switcher (todos os clientes)
- ✅ Abas principais: overview/clients/instances/providers/gateways/commercial
- ✅ Gateway config com detalhes (Cakto, Getnet, Stripe)
- ✅ Plan/offer/package forms com defaults
- ✅ STATUS_MAP centralizador (cores consistentes)

---

## ⚠️ Problemas Encontrados

### **1. Erros genéricos e pouco úteis**

**Onde**: Campaigns.jsx:88-89, Wallet.jsx:96-97, Instances.jsx:58, 93
```javascript
alert(err.message) // Genérico demais
```

**Impacto**: Usuário não entende o que fazer.  
**Exemplo ruim**: `Error: Request failed: 500`  
**Exemplo bom**: `Não conseguimos criar a campanha. Verifique se possui créditos suficientes ou tente novamente em alguns segundos.`

**Recomendação**: Criar `ErrorHelper` que mapeia códigos HTTP → mensagens amigáveis.

---

### **2. Falta de confirmação antes de ações destrutivas**

**Onde**: Campaigns.jsx:124-135 (pause)
```javascript
const handlePause = async (campaignId) => {
  // Sem confirmação! Só stop tem window.confirm()
```

**Impacto**: Usuário pode pausar acidentalmente.  
**Risco**: Medium.

**Fix**: Adicionar `window.confirm()` ou modal antes de pause/delete.

---

### **3. Empty states não orientam ação**

**Onde**: DashboardHome (se não há campanhas), Warmup (se não há instâncias), Campaigns (se lista vazia)

**Achado**: Não vemos `EmptyState` de exemplo em Campaigns. Se não há campanhas, mostra lista vazia.

**Recomendação**: 
```jsx
{campaigns.length === 0 ? (
  <EmptyState 
    icon={<Send size={48} />}
    title="Sem campanhas"
    text="Crie sua primeira campanha para começar a enviar mensagens."
    action={() => setShowWizard(true)}
    buttonLabel="Nova Campanha"
  />
) : (...)}
```

---

### **4. Estados de loading não transmitem progresso**

**Onde**: Wallet.jsx, Instances.jsx, Campaigns.jsx
```javascript
{loading ? '—' : balance} // Apenas traço, sem contexto
```

**Impacto**: Usuário não sabe se está carregando ou se vazio.

**Fix**: Skeleton loader ou spinner com mensagem.

---

### **5. Falta de feedback após salvar/ação bem-sucedida**

**Onde**: Campaigns.jsx (launch), Instances.jsx (create), AdminDashboard (create plan)

**Achado**: Há `setSuccess()` em alguns lugares, mas não há UI para mostrar. Apenas `alert()` para erro.

**Recomendação**: Toast/snackbar de sucesso:
```jsx
{success && (
  <motion.div className="toast success">
    <CheckCircle2 size={18} /> {success}
  </motion.div>
)}
```

---

### **6. Formulários longos sem validação inline**

**Onde**: AdminDashboard.jsx (plan form, gateway form, tracking form)

**Achado**: Muitos campos sem validação em tempo real. Usuário só descobre erro ao submeter.

**Recomendação**: 
- Validação inline com ícone verde/vermelho
- Mostrar erro embaixo do campo (não em alert)
- Desabilitar botão de submit se há erros

---

### **7. Inconsistência em nomenclatura de estado**

**Onde**: Instances.jsx vs AdminDashboard.jsx
- Instances: `connected/connecting/disconnected`
- AdminDashboard: `active/pending/suspended/cancelled/connected/disconnected/connecting/capacity_full/draining/disabled/expired/testing/draft/paused/archived/open/in_progress/resolved/closed`

**Impacto**: Confusão ao reutilizar componentes. AdminDashboard tem STATUS_MAP centralizado, mas Instances duplica lógica.

**Recomendação**: Extrair `StatusMap` para `utils/status.js`, compartilhar em todas as páginas.

---

### **8. CSV upload sem validação prévia**

**Onde**: Campaigns.jsx:64-78

**Achado**: Parsing genérico, aceita linhas malformadas, apenas filtra linhas sem phone.

**Risco**: Usuário pode enviar CSV errado e não saber até ver o resultado.

**Recomendação**:
```javascript
const result = validateCsvContacts(contacts);
if (result.errors.length > 0) {
  setError(`${result.errors.length} linhas inválidas:\n${result.errors.slice(0, 3).join('\n')}`);
}
```

---

### **9. Sem indicador visual do ambiente ativo**

**Onde**: DashboardHome, Campaigns, Wallet (sem EnvironmentSwitcher)

**Achado**: EnvironmentSwitcher está em AdminDashboard, mas não em cliente. Se usuário tem múltiplos tenants, fica confuso qual está vendo.

**Recomendação**: Adicionar badge `Tenant: Acme Corp` no header de cada página.

---

### **10. Botões com label vago**

**Onde**: DashboardHome:138 `<button>Gerar Relatório</button>` (sem ícone, sem ação)

**Achado**: Botão não tem `onClick`, não vai fazer nada.

**Recomendação**: Remover ou implementar.

---

## 📋 Plano de Ação

### **P0 — Crítico (afeta segurança/funcionalidade)**
1. ✅ Confirmação antes de pause/delete (Campaigns, Warmup)
2. ✅ Traduzir erros genéricos em mensagens úteis
3. ✅ Centralizar STATUS_MAP em `utils/status.js`

### **P1 — Alto (afeta experiência)**
4. ✅ Adicionar toast de sucesso
5. ✅ Empty states com CTA
6. ✅ Validação inline em formulários
7. ✅ Indicador de tenant ativo em todas as páginas

### **P2 — Médio (nice-to-have)**
8. Skeleton loaders no lugar de `...` ou `—`
9. Validação de CSV antes de upload
10. Extrair ErrorHelper para tratamento de erros

---

## 🎨 Padrões Reutilizáveis

```jsx
// EmptyState
<EmptyState 
  icon={<IconComponent size={48} />}
  title="Sem dados"
  text="Explique o que fazer a seguir"
  action={() => navigate(...)}
  buttonLabel="Ação primária"
/>

// Toast de sucesso/erro
<Toast 
  type="success|error|warning|info"
  message="..."
  duration={3000}
/>

// ConfirmDialog antes de ação destrutiva
<ConfirmDialog
  title="Parar campanha?"
  message="A fila pendente será cancelada."
  confirmLabel="Parar"
  cancelLabel="Não, manter"
  onConfirm={() => handleStop(id)}
/>

// Validação inline
<Input
  label="Email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={email && !isValidEmail(email) ? 'Email inválido' : ''}
  status={email && isValidEmail(email) ? 'valid' : 'error'}
/>
```

---

## ✨ Cronograma Proposto

| Sprint | Tarefas |
|--------|---------|
| **Semana 1** | P0: Confirmações, erros, STATUS_MAP |
| **Semana 2** | P1: Toast, empty states, validação inline |
| **Semana 3** | P2: Skeleton loaders, CSV validation |
| **Semana 4** | Testes E2E, polimento final |

---

## 📌 Notas

- Todas as mudanças devem manter a paleta de cores existente (cyan, purple, orange, green).
- Reutilizar `motion` e `framer-motion` para animações.
- Testar em mobile (responsividade já parece boa).
- Validar a11y (labels, aria-labels, tab order).

---

**Próximo passo**: Iniciar P0. Quer começar com qual item?
