# 📋 Deploy Readiness Report

**Data**: 2 de maio de 2026, 23:35 UTC  
**Status**: ✅ **PRODUCTION READY**

---

## ✅ Local Testing Summary

### 1. Testes Unitários (13/13 ✓)
```bash
node test/grace-period.test.js
# ✅ 5 passed

node test/reconciliation.test.js
# ✅ 8 passed
```

### 2. Testes E2E Smoke (4/4 ✓)
```bash
npm run test:e2e -- --grep "health check"
# ✅ 4 passed (Firefox, Chromium, WebKit, Mobile)
```

### 3. Webhook Funcional (1/1 ✓)
```bash
curl -X POST http://localhost:3001/api/webhooks/getnet \
  -H "X-Signature: ..." \
  -H "Content-Type: application/json" \
  -d '{...}'
# ✅ HTTP 200 OK
```

### 4. Servidores Rodando (2/2 ✓)
- Warmup Manager (8787): ✓ Health check OK
- API Gateway (3001): ✓ Health check OK

---

## 📝 Pré-Requisitos para Deploy em Produção

### ✅ Código Commitado
```bash
git log --oneline -5
# 4be95f9 docs: adiciona status de implementação
```

### ✅ Migrations SQL Prontas
- `migrations/002_wallets_and_payments.sql` — Criadas e testadas
- `migrations/003_grace_period_cancellation.sql` — Criadas e testadas

### ⚠️ Executar Antes de Deploy

**PASSO 1: Executar Migrations em Produção Supabase**

1. Acesse: https://app.supabase.com
2. Selecione projeto de PRODUÇÃO
3. Vá para SQL Editor > New Query
4. **Cole e execute (PRIMEIRA)**:
   ```bash
   cat migrations/002_wallets_and_payments.sql
   ```
   Aguarde sucesso (⏱️ ~10s)

5. Crie nova query
6. **Cole e execute (SEGUNDA)**:
   ```bash
   cat migrations/003_grace_period_cancellation.sql
   ```
   Aguarde sucesso (⏱️ ~5s)

7. **Valide**:
   ```sql
   SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('wallets', 'payments', 'subscriptions', 'plans');
   -- Esperado: 4
   ```

**PASSO 2: Backup Automático**

Supabase > Settings > Backups > Enable automatic backups
✓ Confirme que está ativo

**PASSO 3: Credenciais e Secrets**

Verify in `.env` or environment variables:
- [ ] SUPABASE_URL
- [ ] SUPABASE_PUBLISHABLE_KEY
- [ ] GETNET_CLIENT_ID
- [ ] GETNET_CLIENT_SECRET
- [ ] GETNET_WEBHOOK_SECRET
- [ ] WEBHOOK_SECRET
- [ ] JWT_SECRET (min 32 chars)

---

## 🚀 Executar Deploy em Produção

### Opção A: Automático (Recomendado)

```bash
cd /Users/diego/dev/ruptur-cloud/ruptur-main/saas

# 1. Tag release
git tag -a v1.2.0 -m "Grace Period + Reconciliation"
git push origin v1.2.0

# 2. Deploy completo (rsync + docker rebuild)
./deploy-complete.sh

# Aguarde: ~2 minutos
# Verifica health check e testa APIs automaticamente
```

### Opção B: Manual

```bash
# SSH para servidor produção
ssh diego@34.176.34.240

# Parar containers
cd /opt/ruptur/saas
docker compose down

# Pull latest code
git pull origin main

# Rebuild
docker compose build --no-cache
docker compose up -d

# Verificar status
curl https://app.ruptur.cloud/api/local/health
```

---

## 🔍 Pós-Deploy Validation (Primeira Hora)

### Health Check

```bash
# Deve retornar 200 com {"ok": true}
curl https://api.ruptur.cloud/api/local/health
```

### Verificar Tabelas

```bash
# Via Supabase SQL Editor:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Deve incluir:
-- subscriptions
-- wallets
-- wallet_transactions
-- payments
-- plans
-- subscription_cancellation_logs
-- reconciliation_logs
```

### Testar Webhook

```bash
# Enviar webhook de teste
curl -X POST https://api.ruptur.cloud/api/webhooks/getnet \
  -H "Content-Type: application/json" \
  -H "X-Signature: $(echo -n '{...}' | openssl dgst -sha256 -mac HMAC -macopt key:WEBHOOK_SECRET)" \
  -d '{"event":"PAYMENT_APPROVED","order_id":"test-123",...}'

# Esperado: HTTP 200
```

### Monitorar Logs

```bash
# SSH para servidor
ssh diego@34.176.34.240

# Tail logs
docker logs saas-web --follow

# Procurar por:
# ✗ Erros 5xx
# ✗ "SyntaxError"
# ✗ "Connection refused"
# ✓ "listening on"
# ✓ "webhook processed"
```

---

## 📊 Monitoramento (24h Após Deploy)

### Métricas Críticas

| Métrica | Target | Alerta |
|---------|--------|--------|
| Response time | < 200ms | > 500ms |
| Error rate (5xx) | 0% | > 0.1% |
| Webhook latency | < 1s | > 5s |
| Database queries | < 100ms | > 500ms |
| Uptime | 100% | < 99% |

### Queries de Monitoramento

```sql
-- Contar pagamentos processados
SELECT COUNT(*) FROM payments WHERE status = 'APPROVED';

-- Contar créditos adicionados
SELECT COUNT(*) FROM wallet_transactions WHERE type = 'credit';

-- Verificar cancelamentos com grace period
SELECT COUNT(*) FROM subscriptions WHERE pending_cancellation = true;

-- Verificar logs de reconciliação
SELECT COUNT(*) FROM reconciliation_logs WHERE reconciled_at > NOW() - INTERVAL '1 hour';
```

---

## 🚨 Rollback (Se Necessário)

```bash
# 1. Reverter código
git revert HEAD
git push origin main

# 2. Redeploy
./deploy-complete.sh

# 3. Rollback banco (opcional)
# Supabase > Settings > Backups > Restore point
```

---

## ✅ Go/No-Go Decision

### Checklist Pré-Deploy

- [x] Todos os testes locais passando (13/13)
- [x] Código commitado
- [x] Migrations testadas localmente
- [x] Documentação completa
- [ ] Migrations executadas em Supabase produção
- [ ] Credenciais de produção verificadas
- [ ] Backup automático ativo
- [ ] Equipe notificada

### Decision

**Status**: ⏳ **AWAITING MANUAL APPROVAL**

Para prosseguir:
1. Execute as migrations em Supabase produção (PASSO 1 acima)
2. Verifique credenciais (PASSO 3 acima)
3. Execute `./deploy-complete.sh`

---

**Próximo passo**: Execute Supabase migrations manualmente via Dashboard SQL Editor.

**Tempo estimado**:
- Migrations: 5-10 minutos
- Deploy: 2-3 minutos
- Validation: 5-10 minutos
- **Total**: ~15-20 minutos
