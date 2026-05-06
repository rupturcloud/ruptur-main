# 📡 GUIA DE MONITORAMENTO — DEPLOYMENT EM PRODUÇÃO

**Data:** 2026-05-03  
**Objetivo:** Monitorar o status do deployment automático no GitHub Actions

---

## 🔗 Links Importantes

### GitHub Actions (Monitoramento em Tempo Real)
```
https://github.com/rupturcloud/ruptur-main/actions
```

**O que ver:**
- Aba "Actions" do repositório
- Branch: main
- Workflow: "Ruptur SaaS CI/CD Pipeline"
- Procure pelo commit mais recente com hash d02cd99...

### Cloud Run Dashboard (Depois do Deploy)
```
https://console.cloud.google.com/run?project=ruptur-jarvis-v1-68358
```

**O que ver:**
- Service: "ruptur-saas"
- Região: us-central1
- Status deve mudar para "Ready"

### Logs de Produção (Após Deploy)
```bash
gcloud run logs read ruptur-saas --region us-central1 --follow
```

---

## 📋 Etapas Esperadas do GitHub Actions

### 1️⃣ CI Job (Build, Test, Lint)
**Tempo esperado:** 2-3 minutos

```
✓ Checkout code
✓ Setup Node.js 20
✓ Install dependencies
✓ Run lint (may have warnings)
✓ Run tests
✓ Security audit
✓ Build Docker image
✓ Run E2E tests
```

**Status esperado:** ✅ Success

---

### 2️⃣ CD to Staging Job
**Tempo esperado:** 3-5 minutos

```
✓ Checkout code
✓ Setup gcloud (requer GCP_SA_KEY secret)
✓ Configure Docker
✓ Push para Google Container Registry
✓ Deploy em saas-staging.ruptur.cloud
✓ Run smoke tests
```

**Status esperado:** ✅ Success (ou ⏭️ Skipped se em branch develop)

---

### 3️⃣ CD to Production Job
**Tempo esperado:** 3-5 minutos  
**Só executa em:** main branch

```
✓ Checkout code
✓ Setup gcloud (requer GCP_SA_KEY secret)
✓ Configure Docker
✓ Download build artifacts
✓ Deploy em saas.ruptur.cloud via Cloud Run
✓ Run smoke tests
✓ Notify Slack
```

**Status esperado:** ✅ Success

---

### 4️⃣ Security Scan Job
**Tempo esperado:** 1-2 minutos

```
✓ Checkout code
✓ Run Trivy vulnerability scanner
✓ Upload SARIF results
```

**Status esperado:** ✅ Success (warnings ok)

---

## ⚠️ Possíveis Problemas

### ❌ "Setup gcloud" falha
**Causa:** Secret `GCP_SA_KEY` não configurado  
**Solução:** Ver seção "Configurar Secrets" abaixo

### ❌ "Docker push" falha
**Causa:** Credenciais GCP inválidas  
**Solução:** Regenerar chave de serviço do GCP

### ❌ "Deploy to production" skipped
**Causa:** Workflow configurado apenas para main branch  
**Solução:** Fazer push para main (já feito ✓)

### ❌ Workflow não inicia
**Causa:** GitHub Actions desabilitado no repo  
**Solução:** Habilitar em Settings > Actions > Allow actions

---

## 🔧 Configurar Secrets (Se Necessário)

### 1. Acesse GitHub
```
https://github.com/rupturcloud/ruptur-main/settings/secrets/actions
```

### 2. Crie/Verifique os Secrets Necessários

#### `GCP_SA_KEY` (CRÍTICO)
```
Type: Repository secret
Value: Conteúdo JSON da chave de serviço do GCP
      (arquivo .json baixado do GCP Console)
```

**Como obter:**
1. Google Cloud Console: https://console.cloud.google.com
2. IAM & Admin > Service Accounts
3. Selecione service account para deploy
4. Keys > Add Key > Create new key > JSON
5. Copie conteúdo completo do JSON

#### `SLACK_WEBHOOK` (Opcional)
```
Type: Repository secret
Value: URL do webhook do Slack
       https://hooks.slack.com/services/...
```

#### `DEPLOY_EMAIL` (Opcional)
```
Type: Repository secret
Value: Email para notificação de deploy
```

---

## 🚀 Status Esperado Pós-Deploy

### Health Check (deve retornar 200)
```bash
curl -v https://api.ruptur.cloud/api/health
```

**Resposta esperada:**
```json
{
  "ok": true,
  "service": "ruptur-saas-gateway",
  "version": "1.0.0",
  "environment": "production"
}
```

### Acesso ao Dashboard
```
URL: https://app.ruptur.cloud/login
Email: diegoizac@gmail.com
Status esperado: ✅ Login bem-sucedido
```

### Verificar Superadmin
```
URL: https://app.ruptur.cloud/admin/superadmin
Status esperado: ✅ Dashboard visível com lista de superadmins
```

---

## 📊 Checklist de Monitoramento

```
┌─ GitHub Actions ───────────────────────┐
│                                         │
│ ☐ Actions tab acessível                │
│ ☐ Workflow disparou em main             │
│ ☐ CI job passou                         │
│ ☐ CD to Staging passou (se applicable) │
│ ☐ CD to Production passou               │
│ ☐ Smoke tests passaram                  │
│ ☐ Slack notificou (se configurado)      │
│                                         │
└─────────────────────────────────────────┘

┌─ Cloud Run ────────────────────────────┐
│                                         │
│ ☐ Service "ruptur-saas" criado         │
│ ☐ Status = "Ready"                     │
│ ☐ Revision tem tráfego = 100%           │
│ ☐ Memória = 512Mi                       │
│ ☐ CPU = 1                               │
│ ☐ Health check OK                       │
│                                         │
└─────────────────────────────────────────┘

┌─ Produção ─────────────────────────────┐
│                                         │
│ ☐ https://app.ruptur.cloud respondendo│
│ ☐ /api/health retorna 200 OK            │
│ ☐ https://app.ruptur.cloud carrega      │
│ ☐ Login funcionando                     │
│ ☐ Superadmin dashboard acessível        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📝 Comandos Úteis

### Monitorar Deploy em Tempo Real
```bash
# Ver logs do Cloud Run
gcloud run logs read ruptur-saas --region us-central1 --follow

# Ver status do service
gcloud run services describe ruptur-saas --region us-central1
```

### Testar Endpoints
```bash
# Health
curl https://api.ruptur.cloud/api/health

# Inbox API
curl https://api.ruptur.cloud/api/inbox/summary

# Campaigns API  
curl https://api.ruptur.cloud/api/campaigns
```

### Ver Revisions do Cloud Run
```bash
gcloud run revisions list --service=ruptur-saas --region=us-central1
```

---

## 🚨 Em Caso de Falha

### 1. Verifique GitHub Actions
- Acesse https://github.com/rupturcloud/ruptur-main/actions
- Clique na run mais recente
- Veja qual step falhou
- Clique em "Re-run failed jobs" se aplicável

### 2. Verifique Secrets
```bash
# Desde o terminal local (se tiver gh CLI)
gh secret list
```

### 3. Verifique GCP Permissions
- Google Cloud Console
- IAM & Admin
- Verifique service account tem roles:
  - Cloud Run Admin
  - Service Account User
  - Container Registry Service Agent

### 4. Verifique Logs Locais
```bash
# Se tiver acesso SSH à instância
ssh -i ~/.ssh/google_compute_engine diego@INSTANCE_IP

# Ver docker logs
docker compose -f docker-compose-fixed.yml logs -f
```

---

## ✅ Sucesso!

Se todos os checks passarem:

```
✅ GitHub Actions concluiu com sucesso
✅ Cloud Run service está "Ready"
✅ Health check retorna 200
✅ App carrega em produção
✅ Login e Superadmin Dashboard funcionando

🎉 DEPLOYMENT CONCLUÍDO COM SUCESSO!
```

---

**Guia de Monitoramento**  
Criado em: 2026-05-03  
Última atualização: 2026-05-03 17:00  
Status: 📡 Aguardando deployment
