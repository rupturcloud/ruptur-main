# 🔐 GITHUB SECRETS — SETUP PARA DEPLOYMENT

**Data:** 2026-05-03  
**Status:** ⚠️ CRÍTICO — Verificar se secrets estão configurados

---

## 🚨 Importance

Para que o GitHub Actions consiga fazer deploy em produção, são necessários secrets configurados no repositório. **SEM ESTES SECRETS, O DEPLOYMENT NÃO VAI FUNCIONAR.**

---

## 📋 Secrets Necessários

### 1️⃣ `GCP_SA_KEY` (CRÍTICO ⚠️)

**O que é:** Credenciais JSON da Service Account do Google Cloud  
**Necessário para:** Autenticar com GCP e fazer deploy em Cloud Run  
**Status:** ❓ VERIFICAR (pode estar configurado)

**Como obter:**

1. Acesse Google Cloud Console:
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=ruptur-jarvis-v1-68358
   ```

2. Selecione service account com permissão de deploy (ex: `ruptur-deploy@ruptur-jarvis-v1-68358.iam.gserviceaccount.com`)

3. Aba "Keys" > "Add Key" > "Create new key"

4. Selecione "JSON" como formato

5. Download automático do arquivo JSON

6. Copie INTEIRO conteúdo do arquivo JSON

**Formato esperado:**
```json
{
  "type": "service_account",
  "project_id": "ruptur-jarvis-v1-68358",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "ruptur-deploy@ruptur-jarvis-v1-68358.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

**Onde configurar:**
```
https://github.com/rupturcloud/ruptur-main/settings/secrets/actions
```

**Passos:**
1. Clique "New repository secret"
2. Name: `GCP_SA_KEY`
3. Value: Cole inteiro JSON obtido acima
4. Clique "Add secret"

---

### 2️⃣ `SLACK_WEBHOOK` (Opcional)

**O que é:** URL webhook para notificações no Slack  
**Necessário para:** Notificar quando deployment completa  
**Status:** ❓ OPCIONAL (mas recomendado)

**Como obter:**

1. Acesse Slack Workspace

2. Apps > Incoming Webhooks

3. "Create New Webhook"

4. Selecione canal (ex: #deployments)

5. Copie webhook URL

**Formato esperado:**
```
https://hooks.slack.com/services/[WORKSPACE_ID]/[CHANNEL_ID]/[SECRET_TOKEN]
```

**Nota:** O webhook é sensível — NUNCA exponha no código ou documentação pública.

**Onde configurar:**
```
https://github.com/rupturcloud/ruptur-main/settings/secrets/actions
```

---

### 3️⃣ `DEPLOY_EMAIL` (Opcional)

**O que é:** Email para notificação de deploy  
**Necessário para:** Receber email quando deployment completa  
**Status:** ❓ OPCIONAL

**Exemplo:**
```
diego@ruptur.cloud
```

---

## ✅ Verificar Se Secrets Estão Configurados

### Via GitHub UI

1. Acesse: https://github.com/rupturcloud/ruptur-main/settings/secrets/actions

2. Veja se aparecem:
   - ✅ `GCP_SA_KEY` (se aparecer, está configurado)
   - ✅ `SLACK_WEBHOOK` (se aparecer, está configurado)
   - ✅ `DEPLOY_EMAIL` (se aparecer, está configurado)

**Nota:** Valores secretos não são visíveis por segurança, mas o nome aparece

### Via GitHub CLI

```bash
# Listar todos os secrets
gh secret list --repo rupturcloud/ruptur-main

# Deve retornar algo como:
# GCP_SA_KEY             Updated 2026-05-01
# SLACK_WEBHOOK          Updated 2026-05-02
# DEPLOY_EMAIL           Updated 2026-05-03
```

---

## 🔍 Verificar Permissões da Service Account

Se `GCP_SA_KEY` está configurado, verifique se tem as permissões corretas:

1. Google Cloud Console:
   ```
   https://console.cloud.google.com/iam-admin/iam?project=ruptur-jarvis-v1-68358
   ```

2. Procure service account: `ruptur-deploy@...`

3. Verifique se tem roles:
   - ✅ `Cloud Run Admin`
   - ✅ `Service Account User`
   - ✅ `Container Registry Service Agent` (ou similar)
   - ✅ `Artifact Registry Writer` (para push de imagens)

4. Se faltar alguma role:
   - Clique em "Edit principal"
   - "Add another role"
   - Adicione roles faltantes

---

## 📡 O Que Acontece Quando Secrets Estão Configurados

Quando você faz push para `main`:

1. **GitHub Actions dispara**
   ```
   .github/workflows/ci-cd.yml
   ```

2. **CI Job roda** (2-3 min)
   - Build, test, lint, audit

3. **CD Job roda** (3-5 min)
   - `Setup gcloud` usa `GCP_SA_KEY` para autenticar
   - Build Docker image
   - Push para Google Container Registry
   - Deploy em Cloud Run

4. **Smoke tests rodam** (1-2 min)
   - Health check
   - API tests

5. **Notificação** (instantâneo)
   - Slack webhook notifica se sucesso/falha
   - Email enviado (se configurado)

---

## 🚨 O Que Acontece Sem Secrets

Se secrets **não estão configurados**:

```
❌ "Setup gcloud" step falha
❌ Não consegue autenticar com GCP
❌ Docker push falha
❌ Cloud Run deploy não acontece
❌ Teste sem produção ❌
```

**Job status:** ❌ FAILED

**Ação necessária:** Configurar secrets conforme acima

---

## ⚡ Quick Setup (Se Não Tiver Secrets)

### Passo 1: Obter GCP_SA_KEY

```bash
# No terminal local com acesso ao GCP:
gcloud iam service-accounts keys create ~/Desktop/gcp-key.json \
  --iam-account=ruptur-deploy@ruptur-jarvis-v1-68358.iam.gserviceaccount.com

cat ~/Desktop/gcp-key.json
```

### Passo 2: Adicionar ao GitHub

```bash
# Se tiver GitHub CLI:
gh secret set GCP_SA_KEY \
  --repo rupturcloud/ruptur-main \
  < ~/Desktop/gcp-key.json

# Ou manualmente:
# 1. Acesse https://github.com/rupturcloud/ruptur-main/settings/secrets/actions
# 2. New repository secret
# 3. Name: GCP_SA_KEY
# 4. Value: (cole inteiro conteúdo do gcp-key.json)
# 5. Add secret
```

### Passo 3: Fazer Novo Push para Disparar

```bash
git commit --allow-empty -m "trigger: forçar novo deploy após configurar secrets"
git push origin main
```

---

## 🧪 Testar Se Secrets Estão OK

Depois de configurar:

1. Acesse: https://github.com/rupturcloud/ruptur-main/actions

2. Procure pelo workflow mais recente

3. Verifique:
   - ✅ "Setup gcloud" step tem sucesso
   - ✅ "Docker push" step tem sucesso
   - ✅ "Deploy to production" step tem sucesso

4. Se todos passarem: ✅ Secrets estão OK!

---

## 📋 Checklist de Configuração

```
┌─ Antes de Fazer Deploy ────────────────┐
│                                        │
│ ☐ Verificar GCP_SA_KEY configurado    │
│ ☐ Verificar permissões da SA          │
│ ☐ (Opcional) Configurar SLACK_WEBHOOK │
│ ☐ (Opcional) Configurar DEPLOY_EMAIL  │
│                                        │
│ ☐ Fazer push para main                 │
│ ☐ Monitorar GitHub Actions             │
│ ☐ Verificar Cloud Run status           │
│ ☐ Testar /api/health em produção       │
│                                        │
└────────────────────────────────────────┘
```

---

## 🆘 Troubleshooting

### "Setup gcloud" falha com erro de autenticação

**Causa:** GCP_SA_KEY inválido ou não existe  
**Solução:**
1. Regenerar chave no GCP Console
2. Atualizar secret no GitHub
3. Fazer novo push

### "Docker push" falha

**Causa:** Permissões insuficientes da Service Account  
**Solução:**
1. Adicionar role "Artifact Registry Writer" à SA
2. Ou "Container Registry Service Agent"
3. Fazer novo push

### "Deploy to production" não roda

**Causa:** Workflow está configurado só para main branch  
**Solução:** Fazer push para `main` (não develop)

### Workflow não dispara automaticamente

**Causa:** GitHub Actions desabilitado  
**Solução:**
1. Acesse: https://github.com/rupturcloud/ruptur-main/settings/actions
2. Aba "General" > "Actions permissions"
3. Selecione "Allow all actions and reusable workflows"
4. Save

---

## 📞 Suporte

Se tiver dúvida sobre como obter GCP_SA_KEY:
1. Google Cloud Console: https://console.cloud.google.com
2. Documentação: https://cloud.google.com/iam/docs/creating-managing-service-accounts

Se tiver dúvida sobre GitHub secrets:
1. GitHub Docs: https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions

---

**Guia de Secrets**  
Criado em: 2026-05-03  
Status: ⚠️ IMPORTANTE — Verificar antes de assumir que deployment vai funcionar
