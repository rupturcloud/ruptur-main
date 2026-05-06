# 🔄 Rodar Migrations em Supabase Production

**Data**: 2 de maio de 2026  
**Status**: Pronto para execução

---

## 📋 Migrations a Rodar

Existem 2 migrations que precisam ser executadas **em ordem**:

### 1️⃣ Migration 002: Wallets e Payments

**Arquivo**: `migrations/002_wallets_and_payments.sql`

**O que cria**:
- Tabela `wallets` (saldo de créditos por tenant)
- Tabela `wallet_transactions` (histórico de movimentações)
- Tabela `payments` (histórico de pagamentos Getnet)
- Tabela `subscriptions` (assinaturas recorrentes)
- Tabela `plans` (4 planos padrão)
- Tabela `referral_links` (programa de afiliados)
- Tabela `referral_commissions` (comissões geradas)
- Funções: `add_wallet_credits()`, `debit_wallet_credits()`
- RLS (Row Level Security) para isolamento por tenant

**Status**: ✅ Pronto

---

### 2️⃣ Migration 003: Grace Period e Reconciliação

**Arquivo**: `migrations/003_grace_period_cancellation.sql`

**O que cria**:
- Colunas em `subscriptions`: `pending_cancellation`, `grace_period_until`, `cancellation_reason`
- Tabela `subscription_cancellation_logs` (auditoria de cancelamentos)
- Tabela `reconciliation_logs` (log de reconciliações)
- Funções:
  * `cancel_subscription_with_grace_period()`
  * `resume_subscription()`
  * `process_expired_grace_periods()`

**Status**: ✅ Pronto

---

## 🚀 Como Rodar

### Passo 1: Acessar Supabase Dashboard

1. Vá para: https://app.supabase.com
2. Selecione seu projeto (ex: `ruptur-saas-production`)
3. Vá para: **SQL Editor** (menu esquerdo)
4. Clique em: **New Query**

### Passo 2: Copiar e Executar Migration 002

```bash
# 1. Copiar todo o conteúdo de migration 002
cat migrations/002_wallets_and_payments.sql

# 2. Cole no Supabase SQL Editor
# 3. Clique em "Run" (botão azul)
```

**Resultado esperado**: ✅ Success  
**Tempo estimado**: ~10 segundos

**Validação**:
```sql
-- Verificar que tabelas foram criadas
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('wallets', 'payments', 'subscriptions', 'plans');

-- Resultado esperado: 4 linhas
```

---

### Passo 3: Copiar e Executar Migration 003

```bash
# 1. Copiar todo o conteúdo de migration 003
cat migrations/003_grace_period_cancellation.sql

# 2. Cole no Supabase SQL Editor (nova query)
# 3. Clique em "Run"
```

**Resultado esperado**: ✅ Success  
**Tempo estimado**: ~5 segundos

**Validação**:
```sql
-- Verificar que novas colunas foram adicionadas
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
AND column_name IN ('pending_cancellation', 'grace_period_until');

-- Resultado esperado: 2 linhas

-- Verificar que tabelas de log foram criadas
SELECT * FROM information_schema.tables 
WHERE table_name IN ('subscription_cancellation_logs', 'reconciliation_logs');

-- Resultado esperado: 2 linhas
```

---

## 📋 Checklist de Execução

- [ ] Fazer backup do banco antes (Supabase > Backups)
- [ ] Executar Migration 002
- [ ] Validar que `wallets`, `payments`, `subscriptions` existem
- [ ] Executar Migration 003
- [ ] Validar que `pending_cancellation`, `grace_period_until` existem
- [ ] Validar que `subscription_cancellation_logs` existe
- [ ] Validar que `reconciliation_logs` existe
- [ ] Verificar que RLS está habilitado em todas as tabelas

---

## ⚠️ Precauções

### ANTES de rodar em PRODUÇÃO:

1. **Backup automático**: Supabase > Settings > Backups > Ativar backup automático
2. **Testar em staging primeiro**: Execute as mesmas migrations em staging antes de produção
3. **Horário de baixo uso**: Execute em horário com menos usuários
4. **Monitorar logs**: Acompanhar se há erros após migração

### SE algo der errado:

```sql
-- Rollback de migration 003 (delete tabelas)
DROP TABLE IF EXISTS subscription_cancellation_logs CASCADE;
DROP TABLE IF EXISTS reconciliation_logs CASCADE;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS pending_cancellation;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS grace_period_until;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS cancellation_reason;

-- Rollback de migration 002 (delete tudo)
DROP TABLE IF EXISTS referral_commissions CASCADE;
DROP TABLE IF EXISTS referral_links CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
```

---

## 🔍 Validação Pós-Migração

```bash
# 1. Conectar via psql (se tiver acesso)
psql postgresql://user:password@host/database

# 2. Verificar todas as tabelas
\dt public.*

# 3. Verificar funções criadas
\df

# 4. Contar registros
SELECT 'wallets' as table_name, COUNT(*) FROM wallets
UNION ALL
SELECT 'wallet_transactions', COUNT(*) FROM wallet_transactions
UNION ALL
SELECT 'payments', COUNT(*) FROM payments;
```

---

## 📊 Ordem de Execução (IMPORTANTE)

⚠️ **Migration 002 DEVE rodar ANTES de Migration 003**

Porque:
- Migration 003 referencia tabelas criadas em 002
- Se rodar 003 antes de 002, terá erro de referência

Ordem correta:
```
002_wallets_and_payments.sql ✅ (PRIMEIRO)
   ↓
003_grace_period_cancellation.sql ✅ (SEGUNDO)
```

---

## 🎯 SQL completo para copiar/colar

### Migration 002:
```bash
cat migrations/002_wallets_and_payments.sql | pbcopy # Mac
cat migrations/002_wallets_and_payments.sql | xclip  # Linux
```

Depois cole no Supabase SQL Editor

### Migration 003:
```bash
cat migrations/003_grace_period_cancellation.sql | pbcopy # Mac
cat migrations/003_grace_period_cancellation.sql | xclip  # Linux
```

---

## 📞 Se der erro

### Erro: "Column já existe"
→ Significa que migration 003 já foi rodada. Não execute novamente.

### Erro: "Referência a tabela inexistente"
→ Significa que migration 002 não foi rodada. Execute primeiro.

### Erro: "Permission denied"
→ Seu usuário Supabase não tem permissão. Use conta com mais privilégios.

---

## ✅ Confirmação de Sucesso

Após ambas as migrations:

```sql
-- Deve retornar 13 tabelas
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';
```

**Esperado**: 13 tabelas (existentes + novas de 002 + novas de 003)

---

**Tempo total estimado**: 30 minutos (incluindo validações)

**Próximo passo**: Configurar Getnet webhook secret em `.env`
