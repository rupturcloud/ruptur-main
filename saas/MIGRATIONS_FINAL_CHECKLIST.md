# 🎯 MIGRATIONS FINAL CHECKLIST

**Data**: 3 de maio de 2026  
**Status**: ✅ Pronto para execução

---

## 📊 O QUE JÁ FOI EXECUTADO

| Migration | Status | Descritivo |
|-----------|--------|-----------|
| ✅ 002_wallets_and_payments.sql | EXECUTADA | Wallets, payments, plans, subscriptions, referral_links, referral_commissions |
| ✅ 003_grace_period_cancellation.sql | EXECUTADA | Grace period (24h), reconciliation logs, funções de cancellation |

---

## 🚫 O QUE NÃO RODAR (Conflitam com versão nova já executada)

| Migration | Por quê | Ação |
|-----------|---------|------|
| ❌ 003_wallet_transactions | Tabela já criada em 002_wallets_and_payments | **NÃO RODAR** |
| ❌ 004_plans_and_subscriptions | Tabelas já criadas em 002_wallets_and_payments | **NÃO RODAR** |
| ❌ 007_referral_system (parcial) | Links e commissions já em 002_wallets, mas falta referral_clicks | Usar versão consolidada |

---

## ✅ O QUE AINDA PRECISA RODAR

Criar um arquivo consolidado com:

1. **002_tenants_and_users** → tenants, users, user_tenant_memberships
2. **001_instance_registry** → tenant_providers, instance_registry, audit_logs
3. **005_campaigns** → campaigns, campaign_recipients
4. **006_migrate_to_getnet** → RENAME colunas MP → Getnet (CRÍTICO!)
5. **008_audit_logs_and_rbac** → user_tenant_roles, tenant_billing_permissions
6. **007_referral_system** → referral_clicks (nova tabela apenas)

**Arquivo consolidado pronto**: `migrations/FINAL_MIGRATIONS_CONSOLIDATED.sql`

---

## 📋 INSTRUÇÕES DE EXECUÇÃO

### Opção A: Via Supabase Dashboard (Recomendado)

1. Acesse: https://app.supabase.com
2. Selecione o projeto Ruptur
3. Vá em **SQL Editor**
4. Crie uma nova query
5. Cole o conteúdo de: `saas/migrations/FINAL_MIGRATIONS_CONSOLIDATED.sql`
6. Clique **Run** (ou Ctrl+Enter)
7. Aguarde a mensagem "Query executed successfully"

### Opção B: Via supabase-cli (se instalado)

```bash
cd /Users/diego/dev/ruptur-cloud/ruptur-main/saas
cat migrations/FINAL_MIGRATIONS_CONSOLIDATED.sql | supabase db push
```

---

## ✅ VERIFICAÇÃO PÓS-EXECUÇÃO

Após rodar as migrations, executar no **SQL Editor** da Supabase:

```sql
-- 1. Verificar se todas as tabelas foram criadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Esperado: 17+ tabelas (wallets, payments, plans, subscriptions, campaigns, 
-- tenant_providers, instance_registry, audit_logs, user_tenant_roles, etc)

-- 2. Verificar se plans foram seeded
SELECT COUNT(*) as plan_count FROM plans;
-- Esperado: 4 (Trial, Starter, Professional, Enterprise)

-- 3. Verificar RLS está habilitado
SELECT table_name, row_security_active 
FROM information_schema.tables 
WHERE table_schema = 'public' AND row_security_active = true
LIMIT 10;
-- Esperado: Múltiplas tabelas com row_security_active = true
```

---

## 🔄 TABELAS FINAIS (Checklist)

Após execução, você deverá ter:

### Auth & Tenants
- ✅ tenants
- ✅ users
- ✅ user_tenant_memberships
- ✅ user_tenant_roles
- ✅ tenant_billing_permissions

### Providers & Instances
- ✅ tenant_providers
- ✅ instance_registry
- ✅ audit_logs

### Billing (Wallets, Payments, Plans)
- ✅ wallets
- ✅ wallet_transactions
- ✅ payments
- ✅ plans
- ✅ subscriptions
- ✅ subscription_cancellation_logs (de 003_grace)
- ✅ reconciliation_logs (de 003_grace)

### Referrals
- ✅ referral_links
- ✅ referral_commissions
- ✅ referral_clicks

### Campaigns
- ✅ campaigns
- ✅ campaign_recipients

**Total esperado**: 20+ tabelas + Múltiplas funções e triggers

---

## 🛑 ROLLBACK (Em caso de erro)

Se algo der errado:

1. Supabase Dashboard → **Settings** → **Backups**
2. Selecione o backup anterior ao deploy
3. Clique **Restore**
4. Aguarde ~5 minutos

Ou via supabase-cli:
```bash
supabase db reset  # ⚠️ DESTRUTIVO - apaga e rerecria tudo
```

---

## 📞 TROUBLESHOOTING

| Erro | Causa | Solução |
|------|-------|---------|
| "table already exists" | Tabela já foi criada | Ignorar (CREATE TABLE IF NOT EXISTS) |
| "relation does not exist" | Dependência faltando | Verificar ordem das migrations |
| "permission denied" | Falta de permissão | Usar service_role key em vez de anon |
| "column does not exist" | Coluna ainda não existe | Verificar se migration anterior rodou |

---

## ✨ RESUMO FINAL

**Antes deste deploy:**
- ✅ 002_wallets_and_payments ✅ 003_grace_period_cancellation

**Depois deste deploy (completo):**
- ✅ Todos os serviços funcionando (Auth, Billing, Campaigns, Providers, RBAC)
- ✅ Multi-tenant isolado com RLS
- ✅ Grace Period de 24h para cancelamento
- ✅ Reconciliação financeira automática
- ✅ Sistema de referrals completo
- ✅ Getnet integration pronto

---

**Status**: 🟢 **PRONTO PARA PRODUÇÃO**

Arquivo pronto para rodar: `saas/migrations/FINAL_MIGRATIONS_CONSOLIDATED.sql`

Execute e valide! 🚀
