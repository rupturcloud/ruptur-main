# Deployment do Sistema de Notificações

Guia completo para deploy do sistema de notificações incluindo Cloud Function, Pub/Sub e integração com SaaS.

## 📋 Checklist Pré-Deploy

### 1. Variáveis de Ambiente

Verificar se `.env` contém:

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyxxxxx...
VITE_SUPABASE_PUBLISHABLE_KEY=eyxxxxx...
SENDGRID_API_KEY=SG.xxxxx...
```

### 2. Status do Repositório

```bash
git status --short --branch
# Garantir que master está sincronizado com origin/master
```

### 3. Build Local

```bash
npm run build
npm test -- --runInBand
npm run lint
```

## 🚀 Fluxo de Deploy

### Fase 1: Cloud Function + Pub/Sub

```bash
# Deploy da Cloud Function com trigger Pub/Sub
./infra/scripts/deploy-cloud-function.sh
```

**O que acontece:**
- ✅ Valida pré-requisitos (gcloud)
- ✅ Cria Pub/Sub topic `notification-events` (se não existir)
- ✅ Cria subscription `notification-events-sub`
- ✅ Deploy/atualiza Cloud Function com novo trigger
- ✅ Seta variáveis de ambiente (Supabase, SendGrid)

**Saída esperada:**
```
[SUCCESS] Cloud Function deployada com sucesso!
notification-dispatcher  ACTIVE  Pub/Sub  us-central1
```

### Fase 2: Aplicar Migrations

```bash
# Opção 1: Via script (preferido)
./infra/scripts/apply-migrations.sh migrations/016_notifications_system.sql

# Opção 2: Manualmente via Supabase Dashboard
# 1. Acesse: https://app.supabase.com
# 2. SQL Editor → New Query
# 3. Cole conteúdo de migrations/016_notifications_system.sql
# 4. Execute (Ctrl+Enter)
```

**Tabelas criadas:**
- `notification_preferences` — preferências por usuário/evento
- `notification_logs` — histórico de notificações enviadas

**Policies aplicadas:**
- RLS ativado para isolamento por tenant/user
- Trigger automático de preferências padrão ao adicionar user

### Fase 3: Deploy do SaaS

```bash
# Build local
npm run build

# Validar
npm run lint
npm test -- --runInBand

# Commit
git add -A
git commit -m "feat: aplicar migrations de notificações"
git push origin master

# Deploy em produção
make deploy-prod
```

**Validações automáticas:**
```bash
# make deploy-prod executa:
1. docker build
2. Deploy via rsync + docker compose
3. Testes de saúde
```

## ✅ Validações Pós-Deploy

### 1. Health Check

```bash
curl https://app.ruptur.cloud/api/local/health | jq .
# Esperado: ok: true
```

### 2. Endpoints de Notificação

```bash
# Com token de autenticação (Bearer token)
BEARER=<seu-jwt-token>

# GET preferências
curl -H "Authorization: Bearer $BEARER" \
  'https://app.ruptur.cloud/api/notifications/preferences?tenantId=<id>'

# PUT preferências
curl -X PUT -H "Authorization: Bearer $BEARER" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"<id>","eventType":"campaign_launched","emailEnabled":true}' \
  https://app.ruptur.cloud/api/notifications/preferences

# GET logs
curl -H "Authorization: Bearer $BEARER" \
  'https://app.ruptur.cloud/api/notifications/logs?tenantId=<id>&limit=10'

# GET stats
curl -H "Authorization: Bearer $BEARER" \
  'https://app.ruptur.cloud/api/notifications/stats?tenantId=<id>'
```

### 3. Pub/Sub Topic

```bash
# Listar mensagens publicadas
gcloud pubsub subscriptions pull notification-events-sub \
  --project=ruptur-jarvis-v1-68358 \
  --auto-ack \
  --limit=10
```

### 4. Cloud Function Logs

```bash
# Ver logs da Cloud Function
gcloud functions logs read notification-dispatcher \
  --region=us-central1 \
  --project=ruptur-jarvis-v1-68358 \
  --limit=50
```

## 🧪 Teste End-to-End

### 1. Preparar Ambiente

```bash
# Confirmar que estamos conectados ao Supabase
psql $DATABASE_URL -c "SELECT count(*) FROM notification_preferences;"
# Esperado: (1 row) count: 0
```

### 2. Publicar Evento de Teste

```bash
gcloud pubsub topics publish notification-events \
  --project=ruptur-jarvis-v1-68358 \
  --message='{
    "type": "campaign_launched",
    "payload": {
      "userId": "test-user-id",
      "tenantId": "test-tenant-id",
      "campaignName": "Test Campaign",
      "count": 100,
      "campaignId": "test-campaign-123"
    }
  }'
```

### 3. Monitorar Logs

```bash
# Terminal 1: Tail dos logs da Cloud Function
gcloud functions logs read notification-dispatcher \
  --region=us-central1 \
  --project=ruptur-jarvis-v1-68358 \
  --follow

# Terminal 2: Verificar se email foi enviado no SendGrid
# Acesse: https://app.sendgrid.com/email_activity
```

### 4. Confirmar em Banco de Dados

```bash
# Verificar log de notificação
psql $DATABASE_URL -c "SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 1;"
```

## 🔧 Troubleshooting

### Cloud Function com erro de inicialização

```bash
# Verificar logs detalhados
gcloud functions logs read notification-dispatcher \
  --region=us-central1 \
  --project=ruptur-jarvis-v1-68358 \
  --limit=100 | tail -50

# Possíveis causas:
# 1. SUPABASE_URL/KEY não configuradas
# 2. SendGrid API key inválida
# 3. Função não pode se conectar ao Supabase
```

**Solução:**
```bash
gcloud functions deploy notification-dispatcher \
  --region=us-central1 \
  --project=ruptur-jarvis-v1-68358 \
  --update-env-vars SUPABASE_URL=$SUPABASE_URL,SUPABASE_KEY=$SUPABASE_KEY,SENDGRID_API_KEY=$SENDGRID_API_KEY
```

### Mensagens não sendo processadas

```bash
# Verificar se subscription está recebendo mensagens
gcloud pubsub subscriptions describe notification-events-sub \
  --project=ruptur-jarvis-v1-68358 \
  --format="get(pushConfig.pushEndpoint)"

# Esperado: URL da Cloud Function

# Se vazio, recriar subscription:
gcloud pubsub subscriptions delete notification-events-sub --project=ruptur-jarvis-v1-68358
gcloud pubsub subscriptions create notification-events-sub \
  --topic=notification-events \
  --push-endpoint=https://us-central1-<project>.cloudfunctions.net/notification-dispatcher \
  --project=ruptur-jarvis-v1-68358
```

### API retornando 500

```bash
# Verificar logs do gateway
ssh -i ~/.ssh/google_compute_engine diego@<ip-produção> \
  "docker logs saas-web --tail 100 | grep notification"

# Possíveis causas:
# 1. Migrations não aplicadas (tabelas não existem)
# 2. Supabase service role key incorreta
# 3. RLS policy bloqueando acesso
```

## 📊 Monitoramento Contínuo

### Métricas importantes

```bash
# 1. Verificar saúde da Cloud Function
watch -n 10 'gcloud functions describe notification-dispatcher \
  --region=us-central1 \
  --project=ruptur-jarvis-v1-68358 \
  --format="table(status)"'

# 2. Monitorar fila Pub/Sub
watch -n 30 'gcloud pubsub subscriptions describe notification-events-sub \
  --project=ruptur-jarvis-v1-68358 \
  --format="table(state, backlogBytes, oldestUnackedMessageAge)"'

# 3. Verificar taxa de erro
watch -n 30 'gcloud logging read \
  "resource.type=cloud_function AND resource.labels.function_name=notification-dispatcher" \
  --project=ruptur-jarvis-v1-68358 \
  --limit=100 --format=json | jq "[.[] | select(.severity==\"ERROR\")] | length"'
```

## 🔄 Rollback

Se algo der errado:

```bash
# 1. Desativar Cloud Function (manter estado antigo)
gcloud functions deploy notification-dispatcher \
  --region=us-central1 \
  --project=ruptur-jarvis-v1-68358 \
  --trigger-http \
  --allow-unauthenticated
# Isso volta para HTTP trigger (estado anterior)

# 2. Revert no SaaS
git revert HEAD
git push origin master
make deploy-prod

# 3. Se necessário, reverter migrations:
# Conectar ao Supabase e executar:
# DROP TABLE IF EXISTS notification_logs;
# DROP TABLE IF EXISTS notification_preferences;
```

## 📝 Resumo dos Componentes

| Componente | Localização | Status | Trigger |
|-----------|-----------|--------|---------|
| Cloud Function | GCP (us-central1) | ACTIVE | Pub/Sub |
| Pub/Sub Topic | GCP | notification-events | - |
| Subscription | GCP | notification-events-sub | - |
| API Endpoints | API Gateway (3001) | ✅ | HTTP/JWT |
| Migrations | Supabase | ✅ | SQL |
| Tables | Postgres (Supabase) | notification_* | - |
| SendGrid | External | Configured | API |

---

**Última atualização:** 2026-05-07
**Responsável:** Claude Code
**Status:** Deployment ready
