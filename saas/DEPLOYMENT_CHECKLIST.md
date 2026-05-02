# 🚀 Checklist de Deployment — Sistema de Referral

**Data:** 2026-05-01  
**Versão:** 1.0 (MVP - 25% comissão em créditos)  

## ✅ Implementação Completa

### 1. **Database Schema** ✅
- [x] `migrations/007_referral_system.sql` criada
- [x] Tabelas: `referral_links`, `referral_commissions`, `referral_clicks`
- [x] VIEW: `referral_summary` para agregações
- [x] RLS policies para isolamento por tenant
- [x] Índices para performance

**Artefato:** `/migrations/007_referral_system.sql`

### 2. **Backend — Billing Service** ✅
- [x] `processReferralCommission()` em getnet.js
  - Validação de link ativo
  - Cálculo de 25%
  - Inserção em referral_commissions
  - Crédito automático ao referrer

- [x] Integração webhook em `handlePaymentApproved()`
  - Processa comissão após pagamento aprovado

- [x] Integração webhook em `handleSubscriptionPayment()`
  - Processa comissão em renovações mensais

- [x] Cancelamento de assinatura em `handleSubscriptionCancelled()`
  - Pausa link de referral (status='expired')

**Artefatos:**
- `/modules/billing/getnet.js` (estendido)

### 3. **API Gateway** ✅
- [x] `GET /api/referrals/my-link` — Gerar/obter link
- [x] `GET /api/referrals/summary` — Resumo para dashboard
- [x] `POST /api/referrals/claim/:refCode` — Reivindicar referral
- [x] `POST /api/referrals/click/:refCode` — Tracking de cliques

**Artefato:** `/api/gateway.mjs` (estendido)

### 4. **Rotas de Referral (Modular)** ✅
- [x] `/modules/referrals/routes.js` criado (opcional - pode ser integrado ao gateway)
- [x] Geração de ref_code atomática
- [x] Validações e autorização

**Artefato:** `/modules/referrals/routes.js`

### 5. **Testes** ✅
- [x] Teste de integração E2E em `/tests/referral-integration.test.mjs`
  - ✅ Criar tenants
  - ✅ Gerar link
  - ✅ Reivindicar referral
  - ✅ Processar pagamento
  - ✅ Validar comissão creditada
  - ✅ Proteção contra replay

**Artefato:** `/tests/referral-integration.test.mjs`

### 6. **Scripts de Inicialização** ✅
- [x] `/scripts/init-referral-system.mjs` — Verificar e executar migration

**Artefato:** `/scripts/init-referral-system.mjs`

### 7. **Documentação** ✅
- [x] `REFERRAL_SYSTEM.md` — Documentação técnica completa
- [x] `DEPLOYMENT_CHECKLIST.md` — Este arquivo

---

## 📋 Pré-Deployment

### 1. Verificar Variáveis de Ambiente

```bash
# Required para Getnet
GETNET_CLIENT_ID=...
GETNET_CLIENT_SECRET=...
GETNET_SELLER_ID=...
GETNET_WEBHOOK_SECRET=...  # Para validação HMAC

# Required para Supabase
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_PUBLISHABLE_KEY=...

# Optional
FRONTEND_URL=https://app.ruptur.cloud  # Para gerar links de referral
DATABASE_URL=postgresql://...          # Para migration via psql
```

### 2. Backup do Banco de Dados

```bash
# Fazer backup antes de migração
pg_dump $DATABASE_URL > backup-2026-05-01.sql

# Ou via Supabase Console:
# 1. Settings → Backups
# 2. Trigger manual backup
# 3. Aguardar conclusão
```

### 3. Executar Migration

**Opção A: Via Supabase Console (RECOMENDADO)**

```sql
-- Acessar: https://app.supabase.com → SQL Editor
-- Copiar conteúdo de: migrations/007_referral_system.sql
-- Colar e executar
```

**Opção B: Via CLI**

```bash
# Se tem DATABASE_URL configurado
node scripts/init-referral-system.mjs

# Ou com psql diretamente
psql "$DATABASE_URL" < migrations/007_referral_system.sql
```

**Opção C: Via Supabase JS SDK (manual)**

```javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, serviceKey);

const { error } = await supabase.sql`
  -- Cole aqui o SQL de 007_referral_system.sql
`;

if (error) console.error(error);
else console.log('Migration executada!');
```

### 4. Validar Schema

```bash
# Verificar tabelas criadas
psql "$DATABASE_URL" -c "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema='public' AND table_name LIKE 'referral%';"

# Esperado output:
#  table_name
# ----------------------------
#  referral_clicks
#  referral_commissions
#  referral_links
# (3 rows)

# Verificar VIEW
psql "$DATABASE_URL" -c "
  SELECT table_name FROM information_schema.views 
  WHERE table_schema='public' AND table_name='referral_summary';"

# Esperado output:
#  table_name
# ----------------------------
#  referral_summary
# (1 row)
```

---

## 🧪 Testes Antes de Go-Live

### 1. Teste Unitário (Local)

```bash
# Rodar com dados reais do Supabase (se preferir não usar staging)
# ⚠️ CUIDADO: Vai criar/deletar dados de teste

SUPABASE_SERVICE_ROLE_KEY=... node tests/referral-integration.test.mjs
```

**Esperado:** Todos os testes passando (✅ 10/10)

### 2. Teste Manual (UI)

```
1. Criar conta como Referrer
   - Ir para: /dashboard/referral
   - Gerar link
   - Copiar código
   
2. Abrir incógnito, clicar no link
   - Verificar que registra em referral_clicks
   
3. Criar conta com ref_code como Referee
   - POST /api/referrals/claim/{refCode}
   - Verificar que referee_tenant_id foi atualizado
   
4. Referee faz pagamento (mock)
   - Simular webhook PAYMENT_APPROVED
   - Verificar comissão em referral_commissions
   - Verificar wallet_transactions (source='referral')
   - Verificar credits_balance do referrer aumentou
   
5. Ver dashboard de referral
   - GET /api/referrals/summary
   - Verificar totalizadores
```

### 3. Teste de Webhook

```bash
# Simular pagamento
curl -X POST http://localhost:3001/api/webhooks/getnet \
  -H "Content-Type: application/json" \
  -H "x-getnet-signature: <HMAC-SHA256>" \
  -d '{
    "event": "PAYMENT_APPROVED",
    "payment_id": "test-payment-123",
    "amount": 4900,
    "data": {
      "payment_id": "test-payment-123"
    }
  }'

# Verificar logs para "Comissão creditada"
```

### 4. Teste de Replay (Segurança)

```bash
# Enviar webhook 2 vezes com mesmo payment_id
# Esperado: 
#   1ª vez → commission_credited
#   2ª vez → commission_duplicate (UNIQUE constraint)
```

---

## 🚀 Go-Live Steps

### Fase 1: Staging (24h antes)

- [ ] Executar migration em staging
- [ ] Rodar testes em staging
- [ ] Validar endpoints com dados reais
- [ ] Verificar RLS policies funcionam
- [ ] Monitorar logs para erros

### Fase 2: Produção (Go-Live)

```bash
# 1. Backup final
pg_dump $DATABASE_URL_PROD > backup-pre-migration-$(date +%s).sql

# 2. Executar migration
node scripts/init-referral-system.mjs

# 3. Validar schema
# (Ver seção "Validar Schema" acima)

# 4. Verificar backend compilado
npm run build  # ou seu comando de build

# 5. Deploy
git commit -m "feat(referral): implement 25% commission system"
git push origin main

# 6. Monitorar em produção
# - Verificar logs de webhooks
# - Monitorar /api/health
# - Alertar se commission_processing_failed ocorrer
```

### Fase 3: Pós-Deploy (Primeiras 24h)

- [ ] Monitorar logs para erros de comissão
- [ ] Validar primeira comissão real creditada
- [ ] Testar link de referral com usuários beta
- [ ] Verificar dashboard carrega corretamente
- [ ] Confirmar webhooks sendo processados

---

## 📊 Monitore Estas Métricas

### Logs a Observar

```
[Billing:Referral] Comissão creditada: ... ✅
[Billing:Referral] Nenhum referral ativo ... ℹ️
[Billing:Referral] Comissão já existe ... ℹ️
[Billing:Referral] Erro ao processar ... ❌
```

### Queries de Diagnóstico

```sql
-- Quantas comissões foram creditadas?
SELECT COUNT(*) FROM referral_commissions WHERE status='credited';

-- Quanto em comissões?
SELECT SUM(commission_amount) / 100.0 as total_credits_given
FROM referral_commissions WHERE status='credited';

-- Quem ganhou mais?
SELECT referrer_tenant_id, SUM(commission_amount) as total
FROM referral_commissions WHERE status='credited'
GROUP BY referrer_tenant_id
ORDER BY total DESC
LIMIT 10;

-- Últimas comissões processadas
SELECT * FROM referral_commissions 
ORDER BY credited_at DESC LIMIT 20;

-- Verificar se wallet_transactions foram inseridas
SELECT COUNT(*) FROM wallet_transactions 
WHERE source='referral';
```

---

## ⚠️ Possíveis Problemas & Soluções

### Problema: "Comissão não foi creditada após pagamento"

**Causa:** Referral link não encontrado ou inativo

```sql
-- Verificar
SELECT * FROM referral_links 
WHERE referee_tenant_id='<uuid>'
AND status='active';

-- Se vazio: verificar se ref_code foi reivindicado
SELECT * FROM referral_links 
WHERE ref_code='<código>';
```

### Problema: "Múltiplas comissões para mesmo pagamento"

**Causa:** Webhook processado 2x (UNIQUE constraint deveria ter prevenido)

```sql
-- Verificar duplicatas (não deve haver)
SELECT getnet_payment_id, COUNT(*) 
FROM referral_commissions 
GROUP BY getnet_payment_id 
HAVING COUNT(*) > 1;

-- Se houver: deletar duplicatas (manter a primeira)
DELETE FROM referral_commissions 
WHERE id IN (
  SELECT id FROM referral_commissions 
  WHERE getnet_payment_id = '<payment-id>'
  ORDER BY credited_at ASC
  LIMIT -1 OFFSET 1
);
```

### Problema: "RLS está bloqueando queries"

**Causa:** Usuário não está autenticado ou tem acesso diferente

**Solução:** Usar `service_role_key` no backend (já está configurado)

```javascript
// ✅ Correto
const supabase = createClient(url, SERVICE_ROLE_KEY);

// ❌ Errado (RLS vai bloquear)
const supabase = createClient(url, ANON_KEY);
```

---

## 🔄 Rollback

Se algo der errado em produção:

```bash
# 1. Reverter banco (se não houver dados reais ainda)
psql $DATABASE_URL < backup-pre-migration-<timestamp>.sql

# 2. Ou mascarar RLS temporariamente para debug
ALTER TABLE referral_links DISABLE ROW LEVEL SECURITY;

# 3. Ou deletar tabelas (⚠️ DESTRUTIVO)
DROP TABLE IF EXISTS referral_clicks CASCADE;
DROP TABLE IF EXISTS referral_commissions CASCADE;
DROP TABLE IF EXISTS referral_links CASCADE;
DROP VIEW IF EXISTS referral_summary;
```

---

## 📞 Suporte

**Contato:** Diego / Claude  
**Documentação:** REFERRAL_SYSTEM.md  
**Testes:** tests/referral-integration.test.mjs  

---

## ✅ Sign-Off

- [ ] Schema verificado
- [ ] APIs testadas
- [ ] Webhooks validados
- [ ] RLS funcionando
- [ ] Documentação OK
- [ ] Pronto para produção ✅

**Data de Deploy:** _______________  
**Responsável:** _______________  
**Observações:** _______________
