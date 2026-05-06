
Ruptur SaaS
/
Claude terminou a resposta
Você disse: eu tenho um saas, dentro dele vou ter operacoes de venda de creditos para uso das suas funcionalidades.
eu tenho um saas,  dentro dele vou ter operacoes de venda de creditos para uso das suas funcionalidades. 
cobranca de assinaturas, etc. alem dos dados , e informacoes nossas  e de nossos clientes

eu gostaria de saber o que devo ponderar, para seguranca da aplicacao e tambem para matrizes de responsabilidades e de autonomia dentro do sistema. 

algum modulo de idetidade e um modulo de seguranca, e la tenho um modulo de wallet/billing, mas totalmente rascunhado e sem avaco, preciso de algo confiavel , seguro, dinamico, com atomicidade, nos niveis de um controle de billing maduro e comm compliance , logs, externos, devolucos, canclamentos, etc. eu. uso getnet.
tendo 

revise. o. que estou. dizendo. e veja o que esqueci

o que nao sei que nao sei

onde. estou erranndo,

o que 90% erram

e oque. temosoportunidades agora

quero o mais simmples e confiavel possivel. , e. funcional seguro

atualmente estou usando autnticacao. do supabase, e.  se. der gostaria de pelo supabase mesmo adicionar google social auth.

Mostrar mais
18:49
Claude respondeu: Vou analisar sua arquitetura de SaaS com foco em segurança, billing e responsabilidades.
Vou analisar sua arquitetura de SaaS com foco em segurança, billing e responsabilidades. Vou organizar por áreas críticas:

🔴 O QUE VOCÊ ESTÁ ESQUECENDO (Pontos Cegos Comuns)
1. Idempotência nas Transações Financeiras
Você mencionou atomicidade, mas idempotência é crítica
Cenário: usuário clica 2x em "comprar créditos" → deve processar apenas 1 vez
Solução: IDs de idempotência em todas chamadas à Getnet
2. Reconciliação Financeira
90% dos SaaS esquecem: seus registros vs registros da Getnet
Precisa de job diário comparando:
Transações no seu DB
Transações no painel Getnet
Alertas automáticos de divergências
3. Webhook Security
Getnet vai enviar webhooks de confirmação de pagamento
Risco: alguém pode falsificar webhooks
Obrigatório: validar assinatura HMAC dos webhooks
4. Grace Period e Soft Delete
Assinatura expira → não delete dados imediatamente
Período de graça (7-30 dias) antes de hard delete
Logs de quando usuário perdeu acesso vs quando dados foram deletados
5. Auditoria Completa de Transações Financeiras
Não é só log técnico, é trilha imutável
Quem autorizou, quando, IP, valor antes/depois
Para compliance e disputas
🔴 ERROS QUE 90% COMETEM
1. Misturar Lógica de Negócio com Provider de Pagamento
javascript
// ❌ ERRADO - código acoplado à Getnet
async function comprarCreditos(userId, valor) {
  const pagamento = await getnet.processar(valor)
  await db.creditos.adicionar(userId, valor)
}

// ✅ CORRETO - camada de abstração
async function comprarCreditos(userId, valor, paymentProvider) {
  const pagamento = await paymentProvider.processar(valor)
  if (pagamento.status === 'approved') {
    await transacao.executar(userId, valor, pagamento.id)
  }
}
2. Não Separar "Tentativa" de "Confirmação"
Criar registro da compra ANTES do pagamento ser confirmado
Estados: pending → processing → completed / failed
Webhook da Getnet atualiza de processing → completed
3. Esquecer Testes de Falha de Pagamento
Testar: cartão recusado, timeout, webhook nunca chega
Ter estratégia de retry com backoff exponencial
4. Controle de Concorrência
sql
-- ❌ ERRADO - race condition
UPDATE wallets SET creditos = creditos + 100 WHERE user_id = 123

-- ✅ CORRETO - lock otimista ou pessimista
UPDATE wallets 
SET creditos = creditos + 100, version = version + 1
WHERE user_id = 123 AND version = @current_version
5. Logs Sem Contexto de Negócio
javascript
// ❌ ERRADO
console.log('Payment failed')

// ✅ CORRETO
logger.error('payment_failed', {
  user_id: userId,
  transaction_id: txId,
  amount: valor,
  gateway_error: getnetResponse.error,
  retry_count: 2,
  context: 'subscription_renewal'
})
🟢 MATRIZ DE RESPONSABILIDADES (RBAC)
Estrutura Sugerida:
Roles:
├── super_admin (você/fundadores)
│   ├── Acesso total
│   ├── Mudar preços
│   └── Ver dados financeiros agregados
│
├── admin (equipe interna)
│   ├── Ver transações
│   ├── Emitir reembolsos (com aprovação)
│   └── Ver logs de auditoria
│
├── finance (contador/financeiro)
│   ├── Ver relatórios financeiros
│   ├── Exportar dados para contabilidade
│   └── SEM acesso a dados de clientes
│
├── support (atendimento)
│   ├── Ver dados de clientes (limitado)
│   ├── Ver histórico de compras
│   └── SEM poder alterar valores
│
└── customer (cliente final)
    ├── Ver próprio saldo
    ├── Comprar créditos
    └── Ver próprias faturas
No Supabase (RLS - Row Level Security):
sql
-- Exemplo: clientes só veem próprios dados
CREATE POLICY "users_select_own" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Admins veem tudo
CREATE POLICY "admins_select_all" ON wallets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );
🟡 ARQUITETURA RECOMENDADA (Simples + Confiável)
┌─────────────────────────────────────────┐
│         SUPABASE AUTH                   │
│  (autenticação + Google OAuth)          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│    CAMADA DE APLICAÇÃO (Next.js/etc)    │
│                                          │
│  ┌────────────────────────────────┐    │
│  │  Billing Service (isolado)     │    │
│  │  - Compra de créditos          │    │
│  │  - Assinaturas                 │    │
│  │  - Reembolsos                  │    │
│  └────────────┬───────────────────┘    │
└───────────────┼────────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼────┐  ┌──▼─────┐  ┌─▼──────┐
│ GETNET │  │SUPABASE│  │ LOGS   │
│   API  │  │   DB   │  │(externo│
│        │  │        │  │Better- │
└────────┘  └────────┘  │stack)  │
                        └────────┘
🔵 STACK MÍNIMA RECOMENDADA
1. Autenticação (já tem ✅)
Supabase Auth + Google OAuth
Adicionar: MFA para admins e transações financeiras
2. Database Schema Essencial
sql
-- Tabela de transações (imutável)
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type VARCHAR(50) NOT NULL, -- 'credit_purchase', 'subscription', 'refund'
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
  gateway_transaction_id VARCHAR(255), -- ID da Getnet
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  metadata JSONB, -- detalhes flexíveis
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) -- quem iniciou
);

-- Tabela de carteira (mutável)
CREATE TABLE wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  balance DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'BRL',
  version INT DEFAULT 1, -- para lock otimista
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de auditoria (imutável, append-only)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices importantes
CREATE INDEX idx_transactions_user ON financial_transactions(user_id);
CREATE INDEX idx_transactions_status ON financial_transactions(status);
CREATE INDEX idx_transactions_created ON financial_transactions(created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
3. Logs Externos (CRÍTICO)
Não confie apenas no seu DB para logs financeiros
Opções simples:
Betterstack (mencionado)
Axiom
Logtail
Por quê?: se hackear seu DB, logs externos permanecem intactos
4. Monitoramento de Transações
javascript
// Exemplo de middleware para transações críticas
async function executeFinancialTransaction(fn, context) {
  const startTime = Date.now()
  const transactionId = generateUUID()
  
  logger.info('transaction_started', {
    transaction_id: transactionId,
    ...context
  })
  
  try {
    const result = await fn()
    
    logger.info('transaction_completed', {
      transaction_id: transactionId,
      duration_ms: Date.now() - startTime,
      ...context
    })
    
    return result
  } catch (error) {
    logger.error('transaction_failed', {
      transaction_id: transactionId,
      error: error.message,
      stack: error.stack,
      ...context
    })
    
    // Alerta para Slack/Discord se transação > R$ 1000
    if (context.amount > 1000) {
      await alertCriticalFailure(error, context)
    }
    
    throw error
  }
}
🟣 COMPLIANCE E REGULAMENTAÇÕES
1. LGPD (Lei Geral de Proteção de Dados)
Dados sensíveis: CPF, dados de cartão (nunca salve CVV!)
Usar tokenização da Getnet para dados de cartão
Ter processo de exclusão de dados (direito ao esquecimento)
2. Nota Fiscal Eletrônica
Se vende créditos, precisa emitir NF
Integrar com: Focus NFe, Tiny ERP, ou Enotas
Automatizar emissão pós-confirmação de pagamento
3. Termos de Uso e Política de Reembolso
Definir claramente:
Créditos expiram?
Reembolso em quanto tempo?
O que acontece se cancelar assinatura?
🟢 CHECKLIST PRÁTICO - PRÓXIMOS PASSOS
Semana 1 - Fundação
 Implementar schema de DB com transações imutáveis
 Configurar RLS (Row Level Security) no Supabase
 Adicionar Google OAuth ao Supabase Auth
 Configurar logs externos (Betterstack/Axiom)
Semana 2 - Billing Core
 Criar abstração para provider de pagamento
 Implementar idempotência (tabela de idempotency_keys)
 Webhook handler da Getnet com validação HMAC
 Testes de compra de créditos (sucesso + falha)
Semana 3 - Segurança
 Implementar auditoria automática em operações sensíveis
 MFA para admins
 Rate limiting em endpoints de pagamento
 Testes de concorrência (2 compras simultâneas)
Semana 4 - Compliance
 Integração com emissão de NF
 Job de reconciliação diária (seu DB vs Getnet)
 Dashboard de métricas financeiras
 Documentação de política de reembolso
🔴 O QUE VOCÊ NÃO SABE QUE NÃO SABE
Chargeback: cliente pode contestar compra no banco
Getnet notifica via webhook
Você precisa reverter créditos + pagar taxa
Fraude: cartões clonados comprando créditos
Implementar análise de risco básica:
Múltiplas compras em curto período
IPs suspeitos (usar serviço de geo-IP)
Padrões anormais
Taxas da Getnet: não é só %
Taxa por transação
Taxa de antecipação (se usar)
Taxa de chargeback
Impacto: precisa calcular margem real
PCI Compliance: se processar dados de cartão
Solução: usar tokenização da Getnet
Nunca salvar: número completo, CVV, data expiração
Reserva de Emergência:
Se Getnet falhar, ter fallback (Stripe/Mercado Pago)
Ou pelo menos mensagem clara ao usuário
🎯 OPORTUNIDADES AGORA
Automação de Dunning (cobranças que falham)
40% das assinaturas falham por cartão expirado
Retry automático + email pro cliente atualizar
Pricing Dinâmico
Tabela de preços no DB (não hardcoded)
Permite: testes A/B, promoções, descontos
Métricas desde o Dia 1
MRR (Monthly Recurring Revenue)
Churn rate
CAC (Customer Acquisition Cost) vs LTV
Self-Service para Reembolsos
Cliente pode pedir reembolso via painel
Admin aprova com 1 clique
Menos fricção = melhor experiência
📋 RESUMO EXECUTIVO
Prioridades por ordem:

✅ Schema de DB seguro (transações imutáveis + auditoria)
✅ Logs externos configurados
✅ Webhook da Getnet com validação
✅ Idempotência em transações
✅ RLS no Supabase
⚠️ Reconciliação financeira
⚠️ Emissão de NF
⚠️ MFA para admins
Mantenha simples:

Supabase Auth (já usa) ✅
Getnet (já usa) ✅
Logs externos (adicionar) 🆕
Emissão NF (integração API) 🆕
Quer que eu detalhe alguma dessas áreas ou crie exemplos de código específicos?

Você disse: la ja temos tenancy,e.
la ja temos tenancy,e. sessao de usuario

18:56
Claude respondeu: Ótimo!
Ótimo! Com tenancy e sessão de usuário já implementados, isso muda bastante o cenário. Vou ajustar a análise focando no que falta e nos riscos específicos de multi-tenancy com billing.

🔴 RISCOS CRÍTICOS EM MULTI-TENANCY + BILLING
1. Isolamento de Dados Financeiros entre Tenants
sql
-- ❌ PERIGO MORTAL - vazamento entre tenants
SELECT * FROM transactions WHERE user_id = @user_id
-- Se user_id vier manipulado, vê transações de outros tenants!

-- ✅ OBRIGATÓRIO - sempre filtrar por tenant
SELECT * FROM transactions 
WHERE user_id = @user_id 
  AND tenant_id = @session_tenant_id  -- do contexto da sessão
  
-- ✅ MELHOR AINDA - RLS do Supabase
CREATE POLICY "tenant_isolation" ON transactions
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM user_sessions WHERE user_id = auth.uid())
  );
2. Billing por Tenant vs por Usuário
Você precisa definir:

Modelo A: Billing por Tenant (comum em B2B SaaS)

1 empresa = 1 tenant = 1 wallet/assinatura
Usuários compartilham créditos do tenant
Admin do tenant gerencia pagamentos
Modelo B: Billing por Usuário (comum em B2C)

Cada usuário tem sua própria wallet
Mesmo tenant, wallets separadas
Modelo C: Híbrido (mais complexo)

Tenant tem créditos compartilhados
Usuários podem ter créditos individuais
Precedência: créditos do usuário → créditos do tenant
Qual é o seu caso? Isso muda TUDO na arquitetura.

🟡 ARQUITETURA AJUSTADA COM TENANCY
Assumindo Modelo A (billing por tenant) que é mais comum:

sql
-- Schema ajustado para multi-tenancy
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet por TENANT (não por usuário)
CREATE TABLE tenant_wallets (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  balance DECIMAL(10,2) DEFAULT 0.00,
  reserved_balance DECIMAL(10,2) DEFAULT 0.00, -- créditos em uso
  currency VARCHAR(3) DEFAULT 'BRL',
  version INT DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transações SEMPRE amarradas ao tenant
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id), -- ⚠️ CRÍTICO
  initiated_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  gateway_transaction_id VARCHAR(255),
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissões de billing por tenant
CREATE TABLE tenant_billing_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  can_purchase BOOLEAN DEFAULT FALSE, -- pode comprar créditos
  can_view_billing BOOLEAN DEFAULT TRUE, -- pode ver faturas
  can_manage_subscription BOOLEAN DEFAULT FALSE, -- pode alterar plano
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- RLS para isolamento
CREATE POLICY "tenant_wallet_isolation" ON tenant_wallets
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "tenant_transactions_isolation" ON financial_transactions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants 
      WHERE user_id = auth.uid()
    )
  );
🔴 ERROS MORTAIS EM MULTI-TENANCY + BILLING
1. Context Switching Attack
javascript
// ❌ VULNERABILIDADE
// Cliente envia tenantId no body da request
app.post('/api/purchase-credits', async (req, res) => {
  const { tenantId, amount } = req.body // ⚠️ NUNCA confiar nisso!
  await purchaseCredits(tenantId, amount)
})

// ✅ CORRETO - pegar tenantId da SESSÃO autenticada
app.post('/api/purchase-credits', async (req, res) => {
  const { amount } = req.body
  const tenantId = req.session.tenantId // da sessão autenticada
  
  // Validar que usuário tem permissão de compra neste tenant
  const canPurchase = await checkBillingPermission(req.session.userId, tenantId)
  if (!canPurchase) throw new ForbiddenError()
  
  await purchaseCredits(tenantId, amount)
})
2. Vazamento de Dados em Webhooks
javascript
// ❌ PERIGO - webhook da Getnet não sabe de tenants
app.post('/webhooks/getnet', async (req, res) => {
  const { transaction_id, status } = req.body
  
  // Se buscar só por transaction_id, pode atualizar tenant errado!
  await db.transactions.update({ gateway_transaction_id: transaction_id }, { status })
})

// ✅ CORRETO - sempre validar tenant
app.post('/webhooks/getnet', async (req, res) => {
  const { transaction_id, status } = req.body
  
  // Buscar transação COM tenant_id
  const transaction = await db.transactions.findOne({ 
    gateway_transaction_id: transaction_id 
  })
  
  if (!transaction) throw new Error('Transaction not found')
  
  // Atualizar garantindo tenant correto
  await db.transactions.update({
    id: transaction.id,
    tenant_id: transaction.tenant_id // ⚠️ validação explícita
  }, { status })
  
  // Atualizar wallet do tenant correto
  await updateTenantWallet(transaction.tenant_id, transaction.amount)
})
3. Rate Limiting Por Tenant
javascript
// ❌ ERRADO - rate limit global
rateLimit({ windowMs: 60000, max: 100 })

// ✅ CORRETO - rate limit por tenant
const rateLimitByTenant = rateLimit({
  windowMs: 60000,
  max: 100,
  keyGenerator: (req) => `tenant:${req.session.tenantId}:purchase`
})

// Evita que 1 tenant abuse e bloqueie outros
4. Uso de Créditos Sem Lock de Tenant
javascript
// ❌ RACE CONDITION
// 2 usuários do mesmo tenant usam créditos ao mesmo tempo
async function useCredits(tenantId, amount) {
  const wallet = await getWallet(tenantId)
  if (wallet.balance < amount) throw new InsufficientFundsError()
  
  // ⚠️ Outro usuário pode usar aqui antes de decrementar!
  await updateWallet(tenantId, wallet.balance - amount)
}

// ✅ CORRETO - lock pessimista ou otimista
async function useCredits(tenantId, amount) {
  const result = await db.query(`
    UPDATE tenant_wallets 
    SET 
      balance = balance - $1,
      reserved_balance = reserved_balance + $1,
      version = version + 1
    WHERE tenant_id = $2 
      AND balance >= $1
      AND version = $3
    RETURNING *
  `, [amount, tenantId, currentVersion])
  
  if (result.rowCount === 0) {
    throw new InsufficientFundsError()
  }
  
  return result.rows[0]
}
🟢 MATRIZ DE PERMISSÕES COM TENANCY
Estrutura Recomendada:
Roles POR TENANT:
├── tenant_owner (criador do tenant)
│   ├── Gerenciar billing
│   ├── Adicionar/remover usuários
│   ├── Ver todas transações do tenant
│   └── Cancelar assinatura
│
├── tenant_admin
│   ├── Ver billing
│   ├── Comprar créditos (se owner permitir)
│   └── Ver relatórios de uso
│
├── tenant_member (usuário comum)
│   ├── Usar funcionalidades (gasta créditos do tenant)
│   ├── Ver saldo do tenant (se permitido)
│   └── SEM acesso a billing
│
Roles GLOBAIS (seus):
├── platform_super_admin
│   ├── Ver todos tenants
│   ├── Suspender tenants
│   └── Acesso total a billing de todos
│
└── platform_support
    ├── Ver transações (read-only)
    └── Emitir reembolsos (com aprovação)
Implementação no Supabase:
sql
-- Tabela de roles por tenant
CREATE TABLE user_tenant_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  role VARCHAR(50) NOT NULL, -- 'owner', 'admin', 'member'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- RLS: só pode comprar créditos se for owner/admin
CREATE POLICY "can_purchase_credits" ON financial_transactions
  FOR INSERT USING (
    EXISTS (
      SELECT 1 FROM user_tenant_roles
      WHERE user_id = auth.uid()
        AND tenant_id = financial_transactions.tenant_id
        AND role IN ('owner', 'admin')
    )
  );

-- RLS: membros podem VER billing se tenant permitir
CREATE POLICY "can_view_billing" ON financial_transactions
  FOR SELECT USING (
    tenant_id IN (
      SELECT t.id FROM tenants t
      JOIN user_tenant_roles utr ON utr.tenant_id = t.id
      WHERE utr.user_id = auth.uid()
        AND (
          utr.role IN ('owner', 'admin') 
          OR t.billing_visibility = 'all_members'
        )
    )
  );
🔵 AUDITORIA COM CONTEXTO DE TENANCY
sql
-- Audit log ajustado
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id), -- ⚠️ pode ser NULL para ações globais
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  
  -- Contexto de segurança
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  
  -- Contexto de tenant
  acting_as_role VARCHAR(50), -- qual role estava usando
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exemplo de uso
INSERT INTO audit_logs (
  tenant_id, user_id, action, resource_type, resource_id,
  old_value, new_value, ip_address, acting_as_role
) VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  auth.uid(),
  'purchase_credits',
  'tenant_wallet',
  '123e4567-e89b-12d3-a456-426614174000',
  jsonb_build_object('balance', 100.00),
  jsonb_build_object('balance', 200.00),
  '192.168.1.1',
  'tenant_owner'
);
🟡 CENÁRIOS ESPECÍFICOS DE MULTI-TENANCY
Cenário 1: Usuário em Múltiplos Tenants
javascript
// Usuário pode estar em Tenant A (como owner) e Tenant B (como member)
// Precisa de seletor de tenant no frontend

// Middleware para garantir tenant ativo na sessão
async function ensureTenantContext(req, res, next) {
  const activeTenantId = req.headers['x-active-tenant'] // do frontend
  
  // Validar que usuário tem acesso a este tenant
  const hasAccess = await db.user_tenant_roles.findOne({
    user_id: req.session.userId,
    tenant_id: activeTenantId
  })
  
  if (!hasAccess) {
    throw new ForbiddenError('No access to this tenant')
  }
  
  // Injetar no contexto da request
  req.tenantId = activeTenantId
  req.tenantRole = hasAccess.role
  next()
}
Cenário 2: Trial por Tenant
sql
-- Cada tenant tem seu próprio trial
ALTER TABLE tenants ADD COLUMN trial_ends_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN trial_credits DECIMAL(10,2) DEFAULT 100.00;

-- Lógica de trial
CREATE OR REPLACE FUNCTION check_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenants
    WHERE id = p_tenant_id
      AND (
        status = 'active'
        OR (status = 'trial' AND trial_ends_at > NOW())
      )
  );
END;
$$ LANGUAGE plpgsql;
Cenário 3: Downgrade de Plano
javascript
// Quando tenant faz downgrade, o que acontece?
async function downgradePlan(tenantId, newPlan) {
  const currentPlan = await getTenantPlan(tenantId)
  const currentLimits = PLAN_LIMITS[currentPlan]
  const newLimits = PLAN_LIMITS[newPlan]
  
  // Verificar se está dentro dos limites do novo plano
  const currentUsage = await getTenantUsage(tenantId)
  
  if (currentUsage.users > newLimits.maxUsers) {
    throw new Error(
      `Você tem ${currentUsage.users} usuários, mas o plano ${newPlan} permite apenas ${newLimits.maxUsers}`
    )
  }
  
  // Auditar downgrade
  await auditLog({
    tenant_id: tenantId,
    action: 'plan_downgrade',
    old_value: { plan: currentPlan },
    new_value: { plan: newPlan }
  })
  
  // Executar downgrade
  await db.tenants.update({ id: tenantId }, { 
    plan: newPlan,
    downgraded_at: new Date()
  })
  
  // Notificar owner do tenant
  await notifyTenantOwners(tenantId, 'plan_downgraded', { newPlan })
}
🔴 CHECKLIST ESPECÍFICO PARA MULTI-TENANCY + BILLING
Segurança
 RLS em TODAS tabelas financeiras filtrando por tenant_id
 Validar tenant_id vem da SESSÃO, nunca do client
 Rate limiting por tenant (não global)
 Audit logs incluem tenant_id e role
 Testes de tentativa de acesso cross-tenant
Billing
 Decidir: billing por tenant ou por usuário?
 Wallet tem lock otimista/pessimista
 Webhooks validam tenant antes de atualizar
 Idempotência inclui tenant_id na chave
 Reembolsos revertem créditos do tenant correto
Permissões
 Roles por tenant (owner/admin/member)
 Permissões de billing configuráveis
 Owner pode transferir ownership
 Apenas owner pode cancelar assinatura
 Logs de quem fez qual ação em qual tenant
Compliance
 Nota fiscal em nome do tenant (CNPJ)
 Dados financeiros isolados por tenant
 LGPD: exclusão de tenant deleta todos dados
 Exportação de dados por tenant
UX
 Seletor de tenant no frontend
 Indicador visual de qual tenant está ativo
 Limites de plano visíveis por tenant
 Dashboard de uso de créditos por tenant
🎯 PRÓXIMOS PASSOS ESPECÍFICOS
Dado que você já tem tenancy e sessão:

1. Validar Isolamento Atual
sql
-- Teste: consegue ver transações de outro tenant?
-- Logar como user_A do tenant_1
-- Tentar: SELECT * FROM transactions WHERE tenant_id = 'tenant_2'
-- DEVE RETORNAR VAZIO ou ERRO
2. Adicionar tenant_id em Todas Queries Financeiras
javascript
// Buscar/substituir no código
// De: WHERE user_id = ?
// Para: WHERE user_id = ? AND tenant_id = ?
3. Implementar Permissões de Billing
javascript
// Criar helper
async function requireBillingPermission(userId, tenantId, permission) {
  const role = await getUserTenantRole(userId, tenantId)
  
  const permissions = {
    owner: ['purchase', 'view', 'manage_subscription', 'cancel'],
    admin: ['purchase', 'view'],
    member: ['view'] // se tenant permitir
  }
  
  if (!permissions[role].includes(permission)) {
    throw new ForbiddenError(`Role ${role} cannot ${permission}`)
  }
}

// Usar antes de operações sensíveis
await requireBillingPermission(userId, tenantId, 'purchase')
await purchaseCredits(tenantId, amount)
4. Webhook com Validação de Tenant
javascript
app.post('/webhooks/getnet', verifyGetnetSignature, async (req, res) => {
  const { transaction_id, status } = req.body
  
  const transaction = await db.query(`
    SELECT t.*, tw.balance as current_balance
    FROM financial_transactions t
    JOIN tenant_wallets tw ON tw.tenant_id = t.tenant_id
    WHERE t.gateway_transaction_id = $1
    FOR UPDATE -- lock pessimista
  `, [transaction_id])
  
  if (!transaction.rows.length) {
    logger.error('webhook_transaction_not_found', { transaction_id })
    return res.status(404).send('Transaction not found')
  }
  
  const { tenant_id, amount, status: current_status } = transaction.rows[0]
  
  // Idempotência: já processado?
  if (current_status === status) {
    return res.status(200).send('Already processed')
  }
  
  await db.transaction(async (trx) => {
    // Atualizar transação
    await trx.query(`
      UPDATE financial_transactions
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [status, transaction.rows[0].id, tenant_id])
    
    // Se aprovado, creditar wallet do tenant
    if (status === 'approved') {
      await trx.query(`
        UPDATE tenant_wallets
        SET balance = balance + $1, updated_at = NOW()
        WHERE tenant_id = $2
      `, [amount, tenant_id])
    }
    
    // Audit log
    await trx.query(`
      INSERT INTO audit_logs (tenant_id, action, metadata)
      VALUES ($1, 'webhook_processed', $2)
    `, [tenant_id, JSON.stringify({ transaction_id, status })])
  })
  
  res.status(200).send('OK')
})
Quer que eu detalhe algum ponto específico? Por exemplo:

Código completo de compra de créditos com multi-tenancy
Sistema de permissões granulares
Migração do billing atual para multi-tenant
Testes de segurança para validar isolamento
Me diz qual é a prioridade!

Você disse: Código completo de compra de créditos com multi-tenancy
Código completo de compra de créditos com multi-tenancy
Sistema de permissões granulares
Migração do billing atual para multi-tenant
Testes de segurança para validar isolamento e preciso que vc pense, se stivesse m meu lugaro qu. voc usaria
me de um prompt para eu seguir agora. la pelo meu claude. code

19:14
Claude respondeu: 🎯 SISTEMA COMPLETO DE BILLING MULTI-TENANT
🎯 SISTEMA COMPLETO DE BILLING MULTI-TENANT
Vou te entregar tudo que você pediu + um prompt completo para o Claude Code implementar.

1️⃣ CÓDIGO COMPLETO DE COMPRA DE CRÉDITOS
Schema Completo do Database
sql
-- ============================================
-- MULTI-TENANT BILLING SCHEMA
-- ============================================

-- Tenants (organizações/empresas)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'free', -- 'free', 'starter', 'pro', 'enterprise'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'trial', 'suspended', 'cancelled'
  
  -- Trial
  trial_ends_at TIMESTAMPTZ,
  trial_credits DECIMAL(10,2) DEFAULT 100.00,
  
  -- Compliance
  tax_id VARCHAR(50), -- CNPJ
  billing_email VARCHAR(255),
  
  -- Metadata
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet por tenant
CREATE TABLE tenant_wallets (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) DEFAULT 0.00 CHECK (balance >= 0),
  reserved_balance DECIMAL(10,2) DEFAULT 0.00 CHECK (reserved_balance >= 0),
  lifetime_spent DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'BRL',
  version INT DEFAULT 1, -- para lock otimista
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transações financeiras (IMUTÁVEL - append only)
CREATE TABLE financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Quem iniciou
  initiated_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Tipo e valores
  type VARCHAR(50) NOT NULL, -- 'credit_purchase', 'subscription', 'refund', 'adjustment', 'usage'
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded'
  
  -- Gateway
  gateway VARCHAR(20) DEFAULT 'getnet', -- 'getnet', 'stripe', 'mercadopago'
  gateway_transaction_id VARCHAR(255),
  gateway_response JSONB,
  
  -- Idempotência
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  
  -- Metadata flexível
  metadata JSONB DEFAULT '{}',
  
  -- Relacionamentos
  parent_transaction_id UUID REFERENCES financial_transactions(id), -- para refunds
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles de usuários por tenant
CREATE TABLE user_tenant_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'billing_admin', 'member'
  permissions JSONB DEFAULT '{}', -- permissões customizadas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Permissões de billing granulares
CREATE TABLE tenant_billing_permissions (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Quem pode comprar
  purchase_allowed_roles TEXT[] DEFAULT ARRAY['owner', 'admin', 'billing_admin'],
  
  -- Quem pode ver billing
  view_billing_allowed_roles TEXT[] DEFAULT ARRAY['owner', 'admin', 'billing_admin'],
  
  -- Quem pode gerenciar assinatura
  manage_subscription_allowed_roles TEXT[] DEFAULT ARRAY['owner'],
  
  -- Quem pode emitir reembolsos
  refund_allowed_roles TEXT[] DEFAULT ARRAY['owner'],
  
  -- Limites de compra
  max_purchase_amount DECIMAL(10,2), -- NULL = sem limite
  require_approval_above DECIMAL(10,2), -- NULL = não requer
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs (IMUTÁVEL)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Ação
  action VARCHAR(100) NOT NULL, -- 'purchase_credits', 'refund_issued', 'plan_changed', etc
  resource_type VARCHAR(50),
  resource_id UUID,
  
  -- Valores
  old_value JSONB,
  new_value JSONB,
  
  -- Contexto de segurança
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  acting_as_role VARCHAR(50),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhooks recebidos (para debugging)
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL, -- 'getnet', 'stripe', etc
  event_type VARCHAR(100),
  payload JSONB NOT NULL,
  signature VARCHAR(500),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX idx_transactions_tenant ON financial_transactions(tenant_id);
CREATE INDEX idx_transactions_status ON financial_transactions(status);
CREATE INDEX idx_transactions_created ON financial_transactions(created_at DESC);
CREATE INDEX idx_transactions_gateway_id ON financial_transactions(gateway_transaction_id);
CREATE INDEX idx_transactions_idempotency ON financial_transactions(idempotency_key);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);

CREATE INDEX idx_webhook_processed ON webhook_events(processed, created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenants: usuário só vê tenants onde é membro
CREATE POLICY "tenant_access" ON tenants
  FOR ALL USING (
    id IN (
      SELECT tenant_id FROM user_tenant_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Wallets: isolamento por tenant
CREATE POLICY "wallet_tenant_isolation" ON tenant_wallets
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Transações: isolamento por tenant + permissões
CREATE POLICY "transactions_select" ON financial_transactions
  FOR SELECT USING (
    tenant_id IN (
      SELECT utr.tenant_id 
      FROM user_tenant_roles utr
      JOIN tenant_billing_permissions tbp ON tbp.tenant_id = utr.tenant_id
      WHERE utr.user_id = auth.uid()
        AND utr.role = ANY(tbp.view_billing_allowed_roles)
    )
  );

CREATE POLICY "transactions_insert" ON financial_transactions
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT utr.tenant_id 
      FROM user_tenant_roles utr
      JOIN tenant_billing_permissions tbp ON tbp.tenant_id = utr.tenant_id
      WHERE utr.user_id = auth.uid()
        AND utr.role = ANY(tbp.purchase_allowed_roles)
    )
  );

-- User roles: usuário vê suas próprias roles
CREATE POLICY "user_roles_access" ON user_tenant_roles
  FOR SELECT USING (user_id = auth.uid());

-- Audit logs: usuários veem logs do tenant
CREATE POLICY "audit_tenant_access" ON audit_logs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles 
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- FUNÇÕES AUXILIARES
-- ============================================

-- Função para criar wallet automaticamente
CREATE OR REPLACE FUNCTION create_tenant_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tenant_wallets (tenant_id)
  VALUES (NEW.id);
  
  INSERT INTO tenant_billing_permissions (tenant_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_tenant_wallet
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_tenant_wallet();

-- Função para validar saldo suficiente
CREATE OR REPLACE FUNCTION check_sufficient_balance(
  p_tenant_id UUID,
  p_amount DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_available_balance DECIMAL;
BEGIN
  SELECT (balance - reserved_balance) INTO v_available_balance
  FROM tenant_wallets
  WHERE tenant_id = p_tenant_id;
  
  RETURN v_available_balance >= p_amount;
END;
$$ LANGUAGE plpgsql;

-- Função para uso de créditos (com lock otimista)
CREATE OR REPLACE FUNCTION use_credits(
  p_tenant_id UUID,
  p_amount DECIMAL,
  p_user_id UUID,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_current_version INT;
  v_rows_affected INT;
BEGIN
  -- Gerar ID da transação
  v_transaction_id := gen_random_uuid();
  
  -- Obter versão atual
  SELECT version INTO v_current_version
  FROM tenant_wallets
  WHERE tenant_id = p_tenant_id;
  
  -- Tentar debitar (com lock otimista)
  UPDATE tenant_wallets
  SET 
    balance = balance - p_amount,
    lifetime_spent = lifetime_spent + p_amount,
    version = version + 1,
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND version = v_current_version
    AND balance >= p_amount;
  
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  IF v_rows_affected = 0 THEN
    RAISE EXCEPTION 'Insufficient balance or concurrent update';
  END IF;
  
  -- Registrar transação
  INSERT INTO financial_transactions (
    id, tenant_id, initiated_by_user_id, type, amount, status,
    idempotency_key, metadata
  ) VALUES (
    v_transaction_id, p_tenant_id, p_user_id, 'usage', p_amount, 'completed',
    'usage_' || v_transaction_id, 
    jsonb_build_object('description', p_description) || p_metadata
  );
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;
Código da API (Node.js/TypeScript)
typescript
// ============================================
// types.ts - Tipos TypeScript
// ============================================

export type TransactionType = 
  | 'credit_purchase' 
  | 'subscription' 
  | 'refund' 
  | 'adjustment' 
  | 'usage';

export type TransactionStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'refunded';

export type TenantRole = 
  | 'owner' 
  | 'admin' 
  | 'billing_admin' 
  | 'member';

export interface PurchaseCreditsRequest {
  tenantId: string;
  amount: number;
  paymentMethod: {
    type: 'credit_card';
    token: string; // token da Getnet
  };
  metadata?: Record<string, any>;
}

export interface Transaction {
  id: string;
  tenantId: string;
  initiatedByUserId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  gateway: string;
  gatewayTransactionId?: string;
  idempotencyKey: string;
  metadata: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
}

// ============================================
// permissions.service.ts - Sistema de Permissões
// ============================================

import { db } from './db';

export class PermissionsService {
  /**
   * Verifica se usuário tem permissão para ação de billing
   */
  async checkBillingPermission(
    userId: string,
    tenantId: string,
    action: 'purchase' | 'view' | 'manage_subscription' | 'refund'
  ): Promise<boolean> {
    const result = await db.query(`
      SELECT 
        utr.role,
        tbp.purchase_allowed_roles,
        tbp.view_billing_allowed_roles,
        tbp.manage_subscription_allowed_roles,
        tbp.refund_allowed_roles
      FROM user_tenant_roles utr
      JOIN tenant_billing_permissions tbp ON tbp.tenant_id = utr.tenant_id
      WHERE utr.user_id = $1 AND utr.tenant_id = $2
    `, [userId, tenantId]);

    if (result.rows.length === 0) {
      return false;
    }

    const { role } = result.rows[0];
    const allowedRoles = result.rows[0][`${action}_allowed_roles`];

    return allowedRoles.includes(role);
  }

  /**
   * Requer permissão (throw se não tiver)
   */
  async requireBillingPermission(
    userId: string,
    tenantId: string,
    action: 'purchase' | 'view' | 'manage_subscription' | 'refund'
  ): Promise<void> {
    const hasPermission = await this.checkBillingPermission(userId, tenantId, action);
    
    if (!hasPermission) {
      throw new ForbiddenError(
        `User does not have permission to ${action} for tenant ${tenantId}`
      );
    }
  }

  /**
   * Obter role do usuário no tenant
   */
  async getUserRole(userId: string, tenantId: string): Promise<TenantRole | null> {
    const result = await db.query(`
      SELECT role FROM user_tenant_roles
      WHERE user_id = $1 AND tenant_id = $2
    `, [userId, tenantId]);

    return result.rows[0]?.role || null;
  }

  /**
   * Validar limites de compra
   */
  async validatePurchaseLimit(
    tenantId: string,
    amount: number
  ): Promise<{ allowed: boolean; requiresApproval: boolean }> {
    const result = await db.query(`
      SELECT max_purchase_amount, require_approval_above
      FROM tenant_billing_permissions
      WHERE tenant_id = $1
    `, [tenantId]);

    if (result.rows.length === 0) {
      return { allowed: true, requiresApproval: false };
    }

    const { max_purchase_amount, require_approval_above } = result.rows[0];

    if (max_purchase_amount && amount > max_purchase_amount) {
      return { allowed: false, requiresApproval: false };
    }

    const requiresApproval = require_approval_above && amount > require_approval_above;

    return { allowed: true, requiresApproval };
  }
}

// ============================================
// audit.service.ts - Sistema de Auditoria
// ============================================

export class AuditService {
  async log(params: {
    tenantId?: string;
    userId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    actingAsRole?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await db.query(`
      INSERT INTO audit_logs (
        tenant_id, user_id, action, resource_type, resource_id,
        old_value, new_value, ip_address, user_agent, session_id,
        acting_as_role, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      params.tenantId,
      params.userId,
      params.action,
      params.resourceType,
      params.resourceId,
      params.oldValue ? JSON.stringify(params.oldValue) : null,
      params.newValue ? JSON.stringify(params.newValue) : null,
      params.ipAddress,
      params.userAgent,
      params.sessionId,
      params.actingAsRole,
      params.metadata ? JSON.stringify(params.metadata) : null
    ]);
  }
}

// ============================================
// billing.service.ts - Serviço de Billing
// ============================================

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class BillingService {
  constructor(
    private permissionsService: PermissionsService,
    private auditService: AuditService,
    private paymentGateway: PaymentGateway
  ) {}

  /**
   * Comprar créditos com idempotência e atomicidade
   */
  async purchaseCredits(
    request: PurchaseCreditsRequest,
    userId: string,
    context: {
      ipAddress: string;
      userAgent: string;
      sessionId: string;
    }
  ): Promise<Transaction> {
    const { tenantId, amount, paymentMethod, metadata = {} } = request;

    // 1. Validar permissões
    await this.permissionsService.requireBillingPermission(
      userId,
      tenantId,
      'purchase'
    );

    // 2. Validar limites
    const { allowed, requiresApproval } = 
      await this.permissionsService.validatePurchaseLimit(tenantId, amount);

    if (!allowed) {
      throw new BadRequestError('Purchase amount exceeds tenant limit');
    }

    if (requiresApproval) {
      // TODO: implementar fluxo de aprovação
      throw new BadRequestError('This purchase requires approval');
    }

    // 3. Gerar chave de idempotência
    const idempotencyKey = this.generateIdempotencyKey(
      tenantId,
      userId,
      amount,
      paymentMethod
    );

    // 4. Verificar se já existe transação com esta chave
    const existing = await this.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      // Retornar transação existente (idempotência)
      return existing;
    }

    // 5. Criar transação em estado pending
    const transactionId = uuidv4();
    const userRole = await this.permissionsService.getUserRole(userId, tenantId);

    await db.query(`
      INSERT INTO financial_transactions (
        id, tenant_id, initiated_by_user_id, type, amount, status,
        gateway, idempotency_key, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      transactionId,
      tenantId,
      userId,
      'credit_purchase',
      amount,
      'pending',
      'getnet',
      idempotencyKey,
      JSON.stringify(metadata)
    ]);

    // 6. Auditar início da transação
    await this.auditService.log({
      tenantId,
      userId,
      action: 'purchase_credits_initiated',
      resourceType: 'transaction',
      resourceId: transactionId,
      newValue: { amount, status: 'pending' },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      actingAsRole: userRole || undefined,
      metadata: { idempotencyKey }
    });

    // 7. Processar pagamento no gateway
    let gatewayResponse;
    try {
      await this.updateTransactionStatus(transactionId, 'processing');

      gatewayResponse = await this.paymentGateway.charge({
        amount,
        currency: 'BRL',
        paymentMethod: paymentMethod.token,
        metadata: {
          tenant_id: tenantId,
          transaction_id: transactionId,
          user_id: userId
        }
      });

      // 8. Atualizar com resposta do gateway
      await db.query(`
        UPDATE financial_transactions
        SET 
          gateway_transaction_id = $1,
          gateway_response = $2,
          status = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [
        gatewayResponse.id,
        JSON.stringify(gatewayResponse),
        gatewayResponse.status === 'approved' ? 'completed' : 'failed',
        transactionId
      ]);

      // 9. Se aprovado, creditar wallet
      if (gatewayResponse.status === 'approved') {
        await this.creditWallet(tenantId, amount, transactionId);

        await this.auditService.log({
          tenantId,
          userId,
          action: 'purchase_credits_completed',
          resourceType: 'transaction',
          resourceId: transactionId,
          newValue: { 
            amount, 
            status: 'completed',
            gateway_transaction_id: gatewayResponse.id
          },
          actingAsRole: userRole || undefined
        });
      } else {
        await this.auditService.log({
          tenantId,
          userId,
          action: 'purchase_credits_failed',
          resourceType: 'transaction',
          resourceId: transactionId,
          newValue: { 
            amount, 
            status: 'failed',
            error: gatewayResponse.error 
          },
          actingAsRole: userRole || undefined
        });
      }

    } catch (error) {
      // 10. Falha no gateway
      await this.updateTransactionStatus(transactionId, 'failed');
      
      await db.query(`
        UPDATE financial_transactions
        SET gateway_response = $1
        WHERE id = $2
      `, [JSON.stringify({ error: error.message }), transactionId]);

      await this.auditService.log({
        tenantId,
        userId,
        action: 'purchase_credits_error',
        resourceType: 'transaction',
        resourceId: transactionId,
        metadata: { error: error.message },
        actingAsRole: userRole || undefined
      });

      throw new PaymentError('Payment processing failed', error);
    }

    // 11. Retornar transação atualizada
    return this.findById(transactionId);
  }

  /**
   * Creditar wallet com lock otimista
   */
  private async creditWallet(
    tenantId: string,
    amount: number,
    transactionId: string,
    maxRetries = 3
  ): Promise<void> {
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Obter versão atual
        const walletResult = await db.query(`
          SELECT version, balance
          FROM tenant_wallets
          WHERE tenant_id = $1
        `, [tenantId]);

        if (walletResult.rows.length === 0) {
          throw new Error(`Wallet not found for tenant ${tenantId}`);
        }

        const { version: currentVersion, balance: oldBalance } = walletResult.rows[0];

        // Tentar atualizar com lock otimista
        const updateResult = await db.query(`
          UPDATE tenant_wallets
          SET 
            balance = balance + $1,
            version = version + 1,
            updated_at = NOW()
          WHERE tenant_id = $2 
            AND version = $3
          RETURNING balance, version
        `, [amount, tenantId, currentVersion]);

        if (updateResult.rows.length === 0) {
          // Conflito de versão - retry
          attempt++;
          await this.sleep(100 * Math.pow(2, attempt)); // exponential backoff
          continue;
        }

        const { balance: newBalance } = updateResult.rows[0];

        // Sucesso - auditar
        await this.auditService.log({
          tenantId,
          userId: 'system',
          action: 'wallet_credited',
          resourceType: 'wallet',
          resourceId: tenantId,
          oldValue: { balance: oldBalance },
          newValue: { balance: newBalance },
          metadata: { transaction_id: transactionId, amount }
        });

        return;

      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
        attempt++;
        await this.sleep(100 * Math.pow(2, attempt));
      }
    }

    throw new Error('Failed to credit wallet after max retries');
  }

  /**
   * Processar webhook da Getnet
   */
  async processWebhook(payload: any, signature: string): Promise<void> {
    // 1. Validar assinatura HMAC
    if (!this.validateWebhookSignature(payload, signature)) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    // 2. Salvar webhook para debugging
    const webhookId = uuidv4();
    await db.query(`
      INSERT INTO webhook_events (id, provider, event_type, payload, signature)
      VALUES ($1, $2, $3, $4, $5)
    `, [webhookId, 'getnet', payload.event_type, JSON.stringify(payload), signature]);

    // 3. Processar evento
    const { transaction_id, status } = payload;

    const transactionResult = await db.query(`
      SELECT id, tenant_id, amount, status as current_status
      FROM financial_transactions
      WHERE gateway_transaction_id = $1
      FOR UPDATE
    `, [transaction_id]);

    if (transactionResult.rows.length === 0) {
      await db.query(`
        UPDATE webhook_events
        SET 
          processed = true,
          error = 'Transaction not found',
          processed_at = NOW()
        WHERE id = $1
      `, [webhookId]);
      return;
    }

    const transaction = transactionResult.rows[0];

    // Idempotência: já processado?
    if (transaction.current_status === status) {
      await db.query(`
        UPDATE webhook_events
        SET processed = true, processed_at = NOW()
        WHERE id = $1
      `, [webhookId]);
      return;
    }

    // 4. Atualizar transação
    await db.query(`
      UPDATE financial_transactions
      SET status = $1, completed_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [status, transaction.id]);

    // 5. Se foi aprovado agora, creditar wallet
    if (status === 'completed' && transaction.current_status !== 'completed') {
      await this.creditWallet(
        transaction.tenant_id,
        transaction.amount,
        transaction.id
      );
    }

    // 6. Se foi reembolsado, debitar wallet
    if (status === 'refunded') {
      await this.debitWallet(
        transaction.tenant_id,
        transaction.amount,
        transaction.id
      );
    }

    // 7. Marcar webhook como processado
    await db.query(`
      UPDATE webhook_events
      SET processed = true, processed_at = NOW()
      WHERE id = $1
    `, [webhookId]);

    // 8. Auditar
    await this.auditService.log({
      tenantId: transaction.tenant_id,
      userId: 'system',
      action: 'webhook_processed',
      resourceType: 'transaction',
      resourceId: transaction.id,
      oldValue: { status: transaction.current_status },
      newValue: { status },
      metadata: { webhook_id: webhookId, transaction_id }
    });
  }

  /**
   * Validar assinatura HMAC do webhook
   */
  private validateWebhookSignature(payload: any, signature: string): boolean {
    const secret = process.env.GETNET_WEBHOOK_SECRET!;
    const computed = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed)
    );
  }

  /**
   * Gerar chave de idempotência determinística
   */
  private generateIdempotencyKey(
    tenantId: string,
    userId: string,
    amount: number,
    paymentMethod: any
  ): string {
    const data = `${tenantId}:${userId}:${amount}:${paymentMethod.token}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    const result = await db.query(`
      SELECT * FROM financial_transactions
      WHERE idempotency_key = $1
    `, [key]);

    return result.rows[0] || null;
  }

  private async findById(id: string): Promise<Transaction> {
    const result = await db.query(`
      SELECT * FROM financial_transactions WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Transaction not found');
    }

    return result.rows[0];
  }

  private async updateTransactionStatus(
    id: string,
    status: TransactionStatus
  ): Promise<void> {
    await db.query(`
      UPDATE financial_transactions
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, id]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async debitWallet(
    tenantId: string,
    amount: number,
    transactionId: string
  ): Promise<void> {
    // Similar ao creditWallet, mas subtrai
    // Implementação omitida para brevidade
  }
}

// ============================================
// routes.ts - Rotas da API
// ============================================

import express from 'express';

const router = express.Router();

// Middleware para garantir tenant ativo
const ensureTenantContext = async (req, res, next) => {
  const tenantId = req.headers['x-active-tenant'];
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing x-active-tenant header' });
  }

  // Validar acesso ao tenant
  const hasAccess = await db.query(`
    SELECT role FROM user_tenant_roles
    WHERE user_id = $1 AND tenant_id = $2
  `, [req.user.id, tenantId]);

  if (hasAccess.rows.length === 0) {
    return res.status(403).json({ error: 'No access to this tenant' });
  }

  req.tenantId = tenantId;
  req.tenantRole = hasAccess.rows[0].role;
  next();
};

// Rate limiting por tenant
const rateLimitByTenant = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `tenant:${req.tenantId}:purchase`,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many purchase attempts. Please try again later.'
    });
  }
});

// POST /api/billing/purchase-credits
router.post(
  '/purchase-credits',
  authenticate,
  ensureTenantContext,
  rateLimitByTenant,
  async (req, res, next) => {
    try {
      const { amount, paymentMethod, metadata } = req.body;

      // Validações básicas
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      if (!paymentMethod || !paymentMethod.token) {
        return res.status(400).json({ error: 'Invalid payment method' });
      }

      const billingService = new BillingService(
        new PermissionsService(),
        new AuditService(),
        new GetnetGateway()
      );

      const transaction = await billingService.purchaseCredits(
        {
          tenantId: req.tenantId,
          amount,
          paymentMethod,
          metadata
        },
        req.user.id,
        {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          sessionId: req.session.id
        }
      );

      res.status(200).json({ transaction });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/webhooks/getnet
router.post('/webhooks/getnet', async (req, res, next) => {
  try {
    const signature = req.headers['x-getnet-signature'];
    
    if (!signature) {
      return res.status(400).json({ error: 'Missing signature' });
    }

    const billingService = new BillingService(
      new PermissionsService(),
      new AuditService(),
      new GetnetGateway()
    );

    await billingService.processWebhook(req.body, signature);

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/billing/balance
router.get(
  '/balance',
  authenticate,
  ensureTenantContext,
  async (req, res, next) => {
    try {
      const result = await db.query(`
        SELECT balance, reserved_balance, currency, updated_at
        FROM tenant_wallets
        WHERE tenant_id = $1
      `, [req.tenantId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      res.status(200).json({ wallet: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/billing/transactions
router.get(
  '/transactions',
  authenticate,
  ensureTenantContext,
  async (req, res, next) => {
    try {
      const permissionsService = new PermissionsService();
      
      await permissionsService.requireBillingPermission(
        req.user.id,
        req.tenantId,
        'view'
      );

      const { limit = 50, offset = 0 } = req.query;

      const result = await db.query(`
        SELECT 
          id, type, amount, status, gateway_transaction_id,
          metadata, created_at, completed_at
        FROM financial_transactions
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [req.tenantId, limit, offset]);

      res.status(200).json({ transactions: result.rows });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
2️⃣ TESTES DE SEGURANÇA
typescript
// ============================================
// security.test.ts - Testes de Isolamento
// ============================================

import { describe, test, expect, beforeEach } from '@jest/globals';

describe('Multi-Tenant Security Tests', () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string; // owner do tenant1
  let user2Id: string; // owner do tenant2
  let user3Id: string; // member do tenant1

  beforeEach(async () => {
    // Setup inicial
    tenant1Id = await createTestTenant('Tenant 1');
    tenant2Id = await createTestTenant('Tenant 2');
    
    user1Id = await createTestUser('user1@test.com');
    user2Id = await createTestUser('user2@test.com');
    user3Id = await createTestUser('user3@test.com');

    await addUserToTenant(user1Id, tenant1Id, 'owner');
    await addUserToTenant(user2Id, tenant2Id, 'owner');
    await addUserToTenant(user3Id, tenant1Id, 'member');
  });

  // ========== TESTE 1: Isolamento de Wallets ==========
  test('User cannot see wallet from other tenant', async () => {
    const session = await createSession(user1Id, tenant1Id);

    // Tentar acessar wallet do tenant2
    const result = await db.query(`
      SELECT * FROM tenant_wallets
      WHERE tenant_id = $1
    `, [tenant2Id]);

    // RLS deve bloquear
    expect(result.rows.length).toBe(0);
  });

  // ========== TESTE 2: Isolamento de Transações ==========
  test('User cannot see transactions from other tenant', async () => {
    // Criar transação no tenant2
    await createTestTransaction(tenant2Id, user2Id, 100);

    // User1 (do tenant1) tenta ver
    const session = await createSession(user1Id, tenant1Id);
    
    const result = await db.query(`
      SELECT * FROM financial_transactions
      WHERE tenant_id = $1
    `, [tenant2Id]);

    expect(result.rows.length).toBe(0);
  });

  // ========== TESTE 3: Context Switching Attack ==========
  test('Cannot switch tenant context via request body', async () => {
    const session = await createSession(user1Id, tenant1Id);

    // Tentar comprar créditos para outro tenant via body
    const response = await request(app)
      .post('/api/billing/purchase-credits')
      .set('Authorization', `Bearer ${session.token}`)
      .set('x-active-tenant', tenant1Id)
      .send({
        tenantId: tenant2Id, // ⚠️ tentando trocar tenant
        amount: 100,
        paymentMethod: { token: 'test_token' }
      });

    // Deve falhar porque tenantId vem da sessão, não do body
    expect(response.status).toBe(403);
  });

  // ========== TESTE 4: Permissões de Billing ==========
  test('Member cannot purchase credits without permission', async () => {
    const session = await createSession(user3Id, tenant1Id);

    const response = await request(app)
      .post('/api/billing/purchase-credits')
      .set('Authorization', `Bearer ${session.token}`)
      .set('x-active-tenant', tenant1Id)
      .send({
        amount: 100,
        paymentMethod: { token: 'test_token' }
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('permission');
  });

  // ========== TESTE 5: Race Condition em Wallet ==========
  test('Concurrent credit usage handles race conditions', async () => {
    // Creditar 100 reais
    await creditWallet(tenant1Id, 100);

    // 2 usuários tentam usar 60 reais ao mesmo tempo
    const promises = [
      useCredits(tenant1Id, user1Id, 60),
      useCredits(tenant1Id, user3Id, 60)
    ];

    const results = await Promise.allSettled(promises);

    // Uma deve falhar (saldo insuficiente)
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Saldo final deve ser 40
    const wallet = await getWallet(tenant1Id);
    expect(wallet.balance).toBe(40);
  });

  // ========== TESTE 6: Idempotência ==========
  test('Duplicate purchase requests return same transaction', async () => {
    const session = await createSession(user1Id, tenant1Id);

    const requestData = {
      amount: 100,
      paymentMethod: { token: 'test_token_unique_123' }
    };

    // Primeira request
    const response1 = await request(app)
      .post('/api/billing/purchase-credits')
      .set('Authorization', `Bearer ${session.token}`)
      .set('x-active-tenant', tenant1Id)
      .send(requestData);

    expect(response1.status).toBe(200);
    const transaction1Id = response1.body.transaction.id;

    // Segunda request (duplicada)
    const response2 = await request(app)
      .post('/api/billing/purchase-credits')
      .set('Authorization', `Bearer ${session.token}`)
      .set('x-active-tenant', tenant1Id)
      .send(requestData);

    expect(response2.status).toBe(200);
    const transaction2Id = response2.body.transaction.id;

    // Deve retornar a MESMA transação
    expect(transaction1Id).toBe(transaction2Id);

    // Deve haver apenas 1 transação no DB
    const count = await db.query(`
      SELECT COUNT(*) FROM financial_transactions
      WHERE tenant_id = $1 AND amount = 100
    `, [tenant1Id]);

    expect(parseInt(count.rows[0].count)).toBe(1);
  });

  // ========== TESTE 7: Webhook Security ==========
  test('Webhook with invalid signature is rejected', async () => {
    const payload = {
      transaction_id: 'gtn_123',
      status: 'completed'
    };

    const invalidSignature = 'invalid_signature';

    const response = await request(app)
      .post('/api/webhooks/getnet')
      .set('x-getnet-signature', invalidSignature)
      .send(payload);

    expect(response.status).toBe(401);
  });

  // ========== TESTE 8: Audit Trail ==========
  test('All financial operations are audited', async () => {
    const session = await createSession(user1Id, tenant1Id);

    // Comprar créditos
    await request(app)
      .post('/api/billing/purchase-credits')
      .set('Authorization', `Bearer ${session.token}`)
      .set('x-active-tenant', tenant1Id)
      .send({
        amount: 100,
        paymentMethod: { token: 'test_token' }
      });

    // Verificar audit logs
    const logs = await db.query(`
      SELECT * FROM audit_logs
      WHERE tenant_id = $1 AND action LIKE 'purchase_credits%'
      ORDER BY created_at DESC
    `, [tenant1Id]);

    // Deve ter pelo menos 2 logs (initiated + completed/failed)
    expect(logs.rows.length).toBeGreaterThanOrEqual(2);

    const initiatedLog = logs.rows.find(l => l.action === 'purchase_credits_initiated');
    expect(initiatedLog).toBeDefined();
    expect(initiatedLog.user_id).toBe(user1Id);
    expect(initiatedLog.acting_as_role).toBe('owner');
  });

  // ========== TESTE 9: SQL Injection Protection ==========
  test('SQL injection in tenant ID is prevented', async () => {
    const maliciousTenantId = "'; DROP TABLE tenants; --";

    const result = await db.query(`
      SELECT * FROM tenant_wallets WHERE tenant_id = $1
    `, [maliciousTenantId]);

    // Não deve causar erro, apenas retornar vazio
    expect(result.rows.length).toBe(0);

    // Verificar que tabela ainda existe
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tenants'
      )
    `);

    expect(tableCheck.rows[0].exists).toBe(true);
  });

  // ========== TESTE 10: Rate Limiting ==========
  test('Rate limiting prevents abuse', async () => {
    const session = await createSession(user1Id, tenant1Id);

    const requests = [];
    for (let i = 0; i < 15; i++) {
      requests.push(
        request(app)
          .post('/api/billing/purchase-credits')
          .set('Authorization', `Bearer ${session.token}`)
          .set('x-active-tenant', tenant1Id)
          .send({
            amount: 100,
            paymentMethod: { token: `test_token_${i}` }
          })
      );
    }

    const responses = await Promise.all(requests);

    // Algumas devem ser bloqueadas (429)
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
3️⃣ MIGRAÇÃO DO BILLING ATUAL
sql
-- ============================================
-- migration.sql - Migração para Multi-Tenant
-- ============================================

-- PASSO 1: Backup das tabelas atuais
CREATE TABLE _backup_transactions AS SELECT * FROM transactions;
CREATE TABLE _backup_wallets AS SELECT * FROM wallets;

-- PASSO 2: Criar tabelas novas (já mostradas acima)
-- ... (copiar schema completo)

-- PASSO 3: Migrar dados existentes

-- 3.1: Se já tem tenants
INSERT INTO tenant_wallets (tenant_id, balance, lifetime_spent, updated_at)
SELECT 
  user_id, -- assumindo que user_id era o "tenant"
  balance,
  0 as lifetime_spent,
  updated_at
FROM _backup_wallets;

-- 3.2: Migrar transações
INSERT INTO financial_transactions (
  id, tenant_id, initiated_by_user_id, type, amount, status,
  gateway, gateway_transaction_id, idempotency_key, metadata, created_at
)
SELECT 
  id,
  user_id as tenant_id, -- ajustar conforme seu modelo
  user_id as initiated_by_user_id,
  'credit_purchase' as type,
  amount,
  CASE 
    WHEN status = 'success' THEN 'completed'
    WHEN status = 'pending' THEN 'processing'
    ELSE 'failed'
  END as status,
  'getnet' as gateway,
  payment_id as gateway_transaction_id,
  COALESCE(idempotency_key, 'migrated_' || id) as idempotency_key,
  '{}' as metadata,
  created_at
FROM _backup_transactions;

-- PASSO 4: Validar integridade
DO $$
DECLARE
  old_count INT;
  new_count INT;
  old_total DECIMAL;
  new_total DECIMAL;
BEGIN
  SELECT COUNT(*), SUM(amount) INTO old_count, old_total
  FROM _backup_transactions WHERE status = 'success';
  
  SELECT COUNT(*), SUM(amount) INTO new_count, new_total
  FROM financial_transactions WHERE status = 'completed';
  
  IF old_count != new_count OR old_total != new_total THEN
    RAISE EXCEPTION 'Migration validation failed: counts or totals do not match';
  END IF;
  
  RAISE NOTICE 'Migration validated successfully: % transactions, total %', new_count, new_total;
END $$;

-- PASSO 5: Criar permissões padrão
INSERT INTO tenant_billing_permissions (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- PASSO 6: Após validação, dropar backups
-- DROP TABLE _backup_transactions;
-- DROP TABLE _backup_wallets;
4️⃣ SE EU ESTIVESSE NO SEU LUGAR, USARIA:
Stack Tecnológica
yaml
Backend:
  Framework: Next.js 14+ (App Router) ou NestJS
  Database: PostgreSQL (Supabase)
  ORM: Prisma ou Drizzle
  Auth: Supabase Auth
  
Gateway de Pagamento:
  Principal: Getnet
  Backup: Stripe (para internacionalização futura)
  
Logs & Monitoring:
  Logs: Betterstack ou Axiom
  APM: Sentry
  Uptime: Better Uptime
  
Nota Fiscal:
  Emissão: Focus NFe
  
Compliance:
  LGPD: TrueVault ou Skyflow (para tokenização de dados sensíveis)
Arquitetura Simplificada
┌─────────────────────────────────────┐
│     Next.js App (Frontend)          │
│  - React Query para cache           │
│  - Zustand para state global        │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│   Next.js API Routes (Backend)      │
│  /api/billing/*                     │
└───────────────┬─────────────────────┘
                │
        ┌───────┴────────┐
        │                │
┌───────▼─────┐   ┌─────▼────────┐
│  Supabase   │   │   Getnet     │
│  - Auth     │   │   - Payments │
│  - DB       │   │   - Webhooks │
│  - RLS      │   └──────────────┘
└─────────────┘
Decisões Chave
Supabase Auth + RLS = menos código de segurança manual
Prisma = type-safety + migrations confiáveis
Betterstack = logs + alertas em 1 ferramenta
Focus NFe = emissão de NF sem dor de cabeça
🚀 PROMPT PARA CLAUDE CODE
markdown
# PROMPT PARA IMPLEMENTAÇÃO DE BILLING MULTI-TENANT

Você é um engenheiro sênior especializado em sistemas de billing seguros. Preciso que implemente um sistema completo de billing multi-tenant com as seguintes características:

## CONTEXTO
- SaaS com múltiplos tenants (organizações)
- Venda de créditos prepagos
- Assinaturas recorrentes
- Gateway: Getnet
- Stack: Next.js 14, PostgreSQL (Supabase), TypeScript

## REQUISITOS FUNCIONAIS

### 1. Database Schema
- Criar schema PostgreSQL completo conforme o modelo fornecido
- Incluir RLS (Row Level Security) para isolamento de tenants
- Índices para performance
- Triggers para auditoria automática
- Funções para operações atômicas (use_credits com lock otimista)

### 2. Sistema de Permissões
- Roles por tenant: owner, admin, billing_admin, member
- Permissões granulares para billing
- Validação de limites de compra
- Middleware para garantir contexto de tenant

### 3. Compra de Créditos
Implementar endpoint POST /api/billing/purchase-credits com:
- Validação de permissões
- Idempotência (chave baseada em hash de params)
- Lock otimista em wallet com retry
- Integração com Getnet
- Auditoria completa (quem, quando, IP, role)
- Rate limiting por tenant (10 req/min)

### 4. Webhook da Getnet
Implementar POST /api/webhooks/getnet com:
- Validação de assinatura HMAC
- Processamento idempotente
- Atualização de transação + wallet
- Salvamento de eventos para debugging
- Tratamento de: approved, failed, refunded

### 5. Auditoria
- Toda operação financeira deve gerar audit log
- Incluir: tenant_id, user_id, action, old_value, new_value, IP, role
- Logs imutáveis (append-only)

### 6. Testes de Segurança
Criar testes para:
- Isolamento de tenants (RLS)
- Context switching attack
- Race conditions em wallet
- Idempotência
- Permissões de billing
- SQL injection
- Webhook signature validation

## REQUISITOS NÃO-FUNCIONAIS

### Segurança
- NUNCA confiar em tenant_id do client
- Sempre pegar tenant_id da sessão autenticada
- Validar assinatura de webhooks
- SQL parametrizado (proteção contra injection)
- Rate limiting por tenant

### Atomicidade
- Transações de DB para operações críticas
- Lock otimista com retry para wallet
- Rollback em caso de falha no gateway

### Observabilidade
- Logs estruturados (JSON)
- Métricas: latência, taxa de erro, volume
- Alertas para: falhas de pagamento > R$ 1000, race conditions, webhooks não processados

## ARQUIVOS A CRIAR
src/ ├── lib/ │ ├── db/ │ │ ├── schema.sql # Schema completo │ │ ├── migrations/ # Migrações Prisma │ │ └── seed.ts # Dados de teste │ │ │ ├── services/ │ │ ├── billing.service.ts # Lógica de billing │ │ ├── permissions.service.ts │ │ ├── audit.service.ts │ │ └── payment-gateway.ts # Abstração para Getnet │ │ │ ├── middleware/ │ │ ├── auth.ts │ │ ├── tenant-context.ts │ │ └── rate-limit.ts │ │ │ └── utils/ │ ├── idempotency.ts │ └── crypto.ts │ ├── app/ │ └── api/ │ ├── billing/ │ │ ├── purchase-credits/route.ts │ │ ├── balance/route.ts │ │ └── transactions/route.ts │ │ │ └── webhooks/ │ └── getnet/route.ts │ └── tests/ ├── security.test.ts ├── billing.test.ts └── permissions.test.ts


## PRIORIDADES
1. ✅ Schema + RLS (fundação)
2. ✅ Sistema de permissões
3. ✅ Compra de créditos (end-to-end)
4. ✅ Webhook handler
5. ✅ Testes de segurança
6. ⚠️ Monitoramento e alertas

## CONSTRAINTS
- Código TypeScript strict mode
- Todos endpoints com validação Zod
- Error handling com classes customizadas
- Logs estruturados (não console.log)
- 100% coverage em testes de segurança

## EXEMPLOS DE USO

### Frontend
```typescript
// Comprar créditos
const response = await fetch('/api/billing/purchase-credits', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-active-tenant': tenantId,
  },
  body: JSON.stringify({
    amount: 100,
    paymentMethod: {
      type: 'credit_card',
      token: getnetToken
    }
  })
});
```

### Getnet Webhook
```bash
curl -X POST https://yourapp.com/api/webhooks/getnet \
  -H "x-getnet-signature: sha256=..." \
  -d '{"transaction_id": "gtn_123", "status": "approved"}'
```

## OUTPUTS ESPERADOS
1. Schema SQL completo e aplicado
2. Código TypeScript implementado
3. Testes passando (mínimo 10 casos)
4. README com instruções de setup
5. Exemplo de .env com variáveis necessárias

## DÚVIDAS?
- Como está estruturado o Supabase atual?
- Já tem integração com Getnet ou precisa criar do zero?
- Qual formato de token a Getnet retorna?
- Tem preferência entre Prisma vs Drizzle?

---

IMPLEMENTE seguindo as melhores práticas de segurança e me mostre o progresso a cada etapa.
📋 CHECKLIST DE VALIDAÇÃO
Antes de ir para produção, validar:

markdown
### Segurança
- [ ] RLS habilitado em TODAS tabelas financeiras
- [ ] Testes de isolamento entre tenants passando
- [ ] Webhook signature validation implementada
- [ ] Rate limiting por tenant ativo
- [ ] SQL injection tests passando
- [ ] Audit logs sendo criados em toda operação

### Funcionalidades
- [ ] Compra de créditos end-to-end funcionando
- [ ] Idempotência testada (request duplicada = mesma transação)
- [ ] Webhook da Getnet processando corretamente
- [ ] Lock otimista em wallet (race condition resolvida)
- [ ] Permissões granulares validadas

### Compliance
- [ ] LGPD: dados sensíveis tokenizados
- [ ] Integração com emissão de NF configurada
- [ ] Política de reembolso documentada
- [ ] Termos de uso atualizados

### Monitoramento
- [ ] Logs externos (Betterstack) configurados
- [ ] Alertas para falhas de pagamento > R$ 1000
- [ ] Dashboard de métricas (MRR, churn, etc)
- [ ] Job de reconciliação diária (seu DB vs Getnet)

### Testes
- [ ] 10+ testes de segurança passando
- [ ] Testes de carga (100 compras simultâneas)
- [ ] Teste de falha do gateway
- [ ] Teste de webhook nunca chegando
Está TUDO que você precisa aqui. Agora é executar!

Quer que eu refine alguma parte específica antes de você começar? 🚀

Você disse: como eu faco para conseguir pegar este contexto de cchat la o claude code?
como eu faco para conseguir pegar este contexto de cchat la o claude code?

19:25
Claude respondeu: 🎯 COMO PASSAR ESTE CONTEXTO PARA O CLAUDE CODE
🎯 COMO PASSAR ESTE CONTEXTO PARA O CLAUDE CODE
Existem 3 formas de fazer isso. Vou te mostrar a melhor para cada situação:

✅ MÉTODO 1: COPIAR PARA UM ARQUIVO MARKDOWN (RECOMENDADO)
Este é o método mais confiável e organizado.

Passo a Passo:
Copie TODO o conteúdo relevante desta conversa
Cole em um arquivo .md no seu projeto
bash
# No seu projeto
mkdir -p docs
touch docs/BILLING_IMPLEMENTATION_GUIDE.md
Estruture o arquivo assim:
markdown
<!-- docs/BILLING_IMPLEMENTATION_GUIDE.md -->

# GUIA COMPLETO DE IMPLEMENTAÇÃO - BILLING MULTI-TENANT

## CONTEXTO DO PROJETO
- SaaS com multi-tenancy
- Supabase (Auth + PostgreSQL)
- Getnet para pagamentos
- Next.js 14

## 1. DATABASE SCHEMA

[Cole aqui todo o SQL que te passei]

## 2. CÓDIGO TYPESCRIPT

[Cole aqui todo o código TypeScript]

## 3. TESTES DE SEGURANÇA

[Cole aqui os testes]

## 4. PROMPT PARA IMPLEMENTAÇÃO

[Cole o prompt final]
Abra o Claude Code e referencie o arquivo:
bash
# No terminal do Claude Code
claude-code

# Ou se já estiver aberto, envie:
@BILLING_IMPLEMENTATION_GUIDE.md Implemente o sistema de billing conforme este guia
✅ MÉTODO 2: USAR O RECURSO "ADD CONTEXT" DO CLAUDE CODE
O Claude Code tem um recurso para adicionar contexto de arquivos.

Passo a Passo:
Crie o arquivo markdown (igual método 1)
No Claude Code CLI, use o comando:
bash
# Adicionar arquivo ao contexto
/add docs/BILLING_IMPLEMENTATION_GUIDE.md

# Ou adicionar múltiplos arquivos
/add docs/*.md
Confirme que foi adicionado:
bash
/context
# Deve listar: BILLING_IMPLEMENTATION_GUIDE.md
Agora faça a pergunta:
Implemente o sistema de billing multi-tenant seguindo o guia BILLING_IMPLEMENTATION_GUIDE.md
✅ MÉTODO 3: PASSAR COMO PROMPT DIRETO (FUNCIONA, MAS MENOS IDEAL)
Se você não quiser criar arquivo, pode colar direto no prompt. Mas tem limites de tamanho.

Como fazer:
bash
claude-code
Depois cole o prompt gigante:

Você é um engenheiro sênior especializado em sistemas de billing seguros.

[COLA TUDO AQUI - mas pode atingir limite de caracteres]
⚠️ PROBLEMA: Se passar de ~8000 caracteres, o terminal pode cortar.

🎯 RECOMENDAÇÃO FINAL: MÉTODO 1 + ESTRUTURA MODULAR
Ao invés de 1 arquivo gigante, divida em arquivos temáticos:

docs/
├── billing/
│   ├── 01-overview.md           # Visão geral do sistema
│   ├── 02-database-schema.sql   # Schema completo
│   ├── 03-api-implementation.md # Código TypeScript
│   ├── 04-security-tests.md     # Testes de segurança
│   ├── 05-migration-guide.md    # Como migrar dados atuais
│   └── 06-prompt.md             # Prompt final para Claude Code
Por que é melhor?
✅ Claude Code consegue referenciar arquivos específicos
✅ Você pode atualizar partes sem mexer em tudo
✅ Versionamento Git fica mais claro
✅ Time consegue colaborar melhor
📝 EXEMPLO PRÁTICO COMPLETO
Vou te dar os arquivos prontos para você copiar:

Arquivo 1: docs/billing/01-overview.md
markdown
# Sistema de Billing Multi-Tenant - Visão Geral

## Contexto
- SaaS com múltiplos tenants
- Venda de créditos prepagos
- Assinaturas recorrentes
- Gateway: Getnet
- Stack: Next.js 14, Supabase, TypeScript

## Objetivos
1. Isolamento total entre tenants (RLS)
2. Atomicidade em transações financeiras
3. Idempotência em compras
4. Auditoria completa
5. Segurança máxima

## Arquitetura
Frontend (Next.js)
↓
API Routes (/api/billing/*)
↓
Services Layer (billing.service.ts)
↓
Database (PostgreSQL + RLS)
↓
External (Getnet, Focus NFe, Betterstack)


## Próximos Passos
Seguir implementação em ordem:
1. Database Schema (02-database-schema.sql)
2. Services (03-api-implementation.md)
3. Tests (04-security-tests.md)
Arquivo 2: docs/billing/02-database-schema.sql
sql
-- [COLE TODO O SQL QUE TE PASSEI AQUI]
Arquivo 3: docs/billing/06-prompt.md
markdown
# PROMPT PARA CLAUDE CODE

[COLE O PROMPT FINAL AQUI]
🚀 COMANDO FINAL PARA CLAUDE CODE
Depois de criar os arquivos, rode:

bash
# 1. Adicionar todos arquivos ao contexto
claude-code

# 2. No prompt do Claude Code:
/add docs/billing/*.md
/add docs/billing/*.sql

# 3. Confirmar contexto
/context

# 4. Executar implementação
Implemente o sistema de billing seguindo os arquivos em docs/billing/.
Comece por:
1. Aplicar o schema (02-database-schema.sql)
2. Criar services (billing.service.ts, permissions.service.ts)
3. Implementar API routes
4. Criar testes de segurança

Me mostre o progresso a cada etapa.
💡 DICA EXTRA: USAR .claudeignore
Se tiver arquivos que não quer que o Claude Code leia, crie:

bash
# .claudeignore (igual .gitignore)
node_modules/
.next/
.env.local
*.log
⚡ ATALHO RÁPIDO (SE TIVER PRESSA)
1. Crie um único arquivo:

bash
cat > BILLING_GUIDE.md << 'EOF'
[COLA TUDO DESTA CONVERSA AQUI]
EOF
2. Abra Claude Code:

bash
claude-code @BILLING_GUIDE.md "Implemente tudo que está neste guia"
3. Pronto! 🎉

🔍 VERIFICAR SE FUNCIONOU
Depois de adicionar o contexto, pergunte ao Claude Code:

Resuma o que você entendeu sobre o sistema de billing que preciso implementar
Se ele responder com detalhes sobre:

Multi-tenancy
RLS
Getnet
Idempotência
Lock otimista
✅ Funcionou! O contexto foi carregado corretamente.

❓ E SE O CLAUDE CODE ESQUECER?
Às vezes em conversas longas ele perde o contexto. Solução:

bash
# Re-adicionar o arquivo
/add docs/billing/06-prompt.md

# Ou relembrar:
Lembre-se: estamos implementando um sistema de billing multi-tenant.
Revise docs/billing/01-overview.md antes de continuar.
Qual método você quer usar? Te ajudo a montar os arquivos! 🚀







Claude é uma IA e pode cometer erros. Por favor, verifique as respostas.
