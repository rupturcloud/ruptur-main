# 🚀 Deploy Checklist — Ruptur SaaS Production

**Status**: Pronto para Deploy  
**Data**: 2 de maio de 2026

---

## 📋 Pré-Deploy (Local)

### ✅ Código

- [x] Implementação de Grace Period ✅
- [x] Implementação de Reconciliação ✅
- [x] Testes unitários (13/13 passando) ✅
- [x] Testes E2E Playwright criados ✅
- [x] Documentação completa ✅
- [ ] Git push para branch `main`

```bash
git status  # Verificar tudo staged
git push origin main
```

### ✅ Variáveis de Ambiente

Verificar que `.env` ou variáveis do servidor têm:

```bash
# Supabase
VITE_SUPABASE_URL=https://axrwlboyowoskdxeogba.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...

# Getnet (obter do painel Getnet)
GETNET_CLIENT_ID=...
GETNET_CLIENT_SECRET=...
GETNET_SELLER_ID=fabcfa72-e65b-48fa-b126-790809a6525e
GETNET_WEBHOOK_SECRET=... # 🔴 CRÍTICO - obter do painel

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://app.ruptur.cloud/auth/google/callback

# JWT
JWT_SECRET=... (minimum 32 chars)

# Segurança
ENABLE_DEV_MODE=false
NODE_ENV=production
CORS_ORIGIN=https://app.ruptur.cloud

# Webhook
WEBHOOK_SECRET=... (random string)
```

---

## 🔄 Staging Deploy

### 1. Rodar Migrations

```bash
# Acessar Supabase Dashboard > SQL Editor
# Executar em ordem:
# 1. migrations/002_wallets_and_payments.sql
# 2. migrations/003_grace_period_cancellation.sql

# Validar:
SELECT COUNT(*) FROM wallets;
SELECT COUNT(*) FROM subscriptions;
```

### 2. Deploy no Staging Server

```bash
# GCP Staging
./deploy.sh staging

# Ou manualmente:
gcloud compute scp \
  --recurse \
  . \
  ruptur-staging:/app/saas

gcloud compute ssh ruptur-staging << 'EOF'
cd /app/saas
npm install
npm start
EOF
```

### 3. Rodar Smoke Tests

```bash
# Terminal 1: Servidor rodando
npm start

# Terminal 2: Smoke tests
npm run test:e2e:headed
```

**Teste manualmente**:
```bash
# 1. Acessar http://localhost:8787
# 2. Clicar "Login com Google" (mock em dev mode)
# 3. Validar que dashboard carrega
# 4. Clicar "Visualizar Saldo" - deve mostrar 0 (ou valor seedado)
# 5. Testar webhook:
curl -X POST http://localhost:8787/api/webhooks/getnet \
  -H "Content-Type: application/json" \
  -H "X-Signature: test-signature" \
  -d '{"event":"PAYMENT_APPROVED","payment_id":"test-123"}'
```

### 4. Validar Segurança

```bash
# Rate limiting
for i in {1..105}; do
  curl -s http://localhost:8787/api/health
done

# Espera: Status 429 após 100 requests em 15 min

# CORS
curl -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  http://localhost:8787/api/health

# Espera: CORS headers apenas para CORS_ORIGIN
```

### 5. Testar Grace Period

```sql
-- Em Supabase staging:

-- 1. Criar subscription de teste
INSERT INTO subscriptions (tenant_id, plan_id, status)
VALUES ('test-tenant-001', 'plan-001', 'active')
RETURNING *;

-- 2. Chamar função de cancelamento
SELECT cancel_subscription_with_grace_period(
  'sub-id-from-above'::uuid,
  'Testing grace period'
);

-- 3. Verificar que foi marcada
SELECT pending_cancellation, grace_period_until FROM subscriptions 
WHERE id = 'sub-id-from-above';

-- Espera: pending_cancellation = true, grace_period_until = NOW() + 24h
```

### 6. Testar Reconciliação

```bash
# Via API (admin only):
curl -X GET http://localhost:8787/api/admin/reconciliation \
  -H "Authorization: Bearer {ADMIN_JWT}" \
  -H "Content-Type: application/json"

# Via Node.js script:
node scripts/reconcile-payments.js
```

---

## 🟢 Production Deploy

### Pré-Flight Checklist

- [ ] Staging tests passaram 100%
- [ ] Getnet webhook secret obtido
- [ ] `.env` produção pronto
- [ ] Backup automático ativado em Supabase
- [ ] Monitoramento/alertas configurado
- [ ] Slack notifications pronto

### Execução

```bash
# 1. Tag release
git tag -a v1.2.0 -m "Grace Period + Reconciliation"
git push origin v1.2.0

# 2. Build (se necessário)
# npm run build (não existe, Node.js direto)

# 3. Deploy em produção
./deploy.sh production

# 4. Rodar migrations em produção Supabase
# (Copiar/colar SQL manualmente via Dashboard)

# 5. Verificar saúde do servidor
curl https://api.ruptur.cloud/api/local/health
# Espera: {"ok": true, ...}

# 6. Smoke test em produção
curl https://app.ruptur.cloud/
# Espera: Status 200, HTML carregando

# 7. Testar webhook real
# Usar painel Getnet para enviar webhook de teste
```

---

## 📊 Monitoramento Pós-Deploy

### Primeiras 24h

```bash
# 1. Verificar logs
tail -f /var/log/ruptur/app.log | grep -i error

# 2. Monitorar tráfego
watch -n 5 'curl https://api.ruptur.cloud/api/health'

# 3. Verificar alertas Slack
# (Configurado no deploy.sh para notificar erros)

# 4. Validar créditos sendo adicionados
# Supabase: SELECT COUNT(*) FROM wallet_transactions;

# 5. Validar webhooks processados
# Supabase: SELECT COUNT(*) FROM payments WHERE status = 'APPROVED';
```

### Métricas a Monitorar

| Métrica | Normal | Alerta 🚨 |
|---------|--------|-----------|
| API response time | < 200ms | > 500ms |
| Error rate | < 0.1% | > 1% |
| Webhook latency | < 1s | > 5s |
| Database queries | < 100ms | > 500ms |
| Rate limit hits | ~0 | > 10/min |

---

## 🔴 Rollback

Se algo der errado:

```bash
# 1. Reverter deploy
git revert HEAD
git push origin main

# 2. Rollback Supabase (via backup automático)
# Supabase > Settings > Backups > Restore

# 3. Notify team
# Slack: "@channel Rollback executado, investigando"

# 4. Debug
tail -f /var/log/ruptur/app.log
# Procurar mensagens de erro
```

---

## ✅ Post-Deploy Validation

```sql
-- 1. Tabelas foram criadas?
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
-- Espera: 13+ tabelas

-- 2. RLS está habilitado?
SELECT * FROM information_schema.tables 
WHERE row_security_active = true;
-- Espera: wallets, payments, subscriptions, etc com true

-- 3. Funções funcionam?
SELECT add_wallet_credits(
  'test-tenant'::uuid, 
  100, 
  'test-ref', 
  'Test credit'
);

-- 4. Reconciliação executa?
-- Via script: node scripts/reconcile-payments.js
```

---

## 📞 Support & Contacts

| Problema | Contato |
|----------|---------|
| Supabase down | https://status.supabase.io |
| Getnet webhook error | Getnet support team |
| GCP instance down | GCP Console / Cloud Support |
| Rate limiting issues | Adjust RATE_LIMIT_MAX_REQUESTS |

---

## 📅 Timeline Estimado

```
Pré-Deploy:           1h
Staging Deploy:       1h
Staging Tests:        1h
Production Deploy:    30min
Monitoring (24h):     Continuous
─────────────────────────
Total:               ~3.5 horas
```

---

**Deploy Date**: TBD  
**Approved by**: (assinatura do PM)  
**Tested by**: (assinatura do QA)

---

## 🎉 Success Criteria

Deploy é considerado ✅ sucesso se:

1. ✅ API responde em < 200ms
2. ✅ Nenhum erro 5xx em 1 hora
3. ✅ Webhooks processam em < 1s
4. ✅ Créditos são adicionados corretamente
5. ✅ Grace period funciona (24h)
6. ✅ Reconciliação roda sem erros
7. ✅ Rate limiting está ativo
8. ✅ JWT tokens são gerados
9. ✅ Google OAuth callback funciona
10. ✅ Nenhum alerta Slack em 24h

Se todos passarem: 🟢 **PRODUCTION READY**
