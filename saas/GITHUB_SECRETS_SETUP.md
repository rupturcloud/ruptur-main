# 🔑 GitHub Secrets Setup — Rsync Deploy

**Objetivo:** Configurar GitHub Actions para deploy usando rsync

---

## Pré-requisitos

1. Você tem acesso SSH ao servidor de produção (`deploy@ruptur.cloud`)
2. Você tem uma chave SSH privada para deploy
3. Você pode recuperar a assinatura da chave pública do servidor

---

## Step 1: Gerar Chave SSH

```bash
# Gerar nova chave SSH
ssh-keygen -t rsa -b 4096 -f ~/.ssh/ruptur-deploy -N ""

# Mostrar chave privada
cat ~/.ssh/ruptur-deploy
```

---

## Step 2: Obter Fingerprint do Servidor

```bash
ssh-keyscan -t rsa ruptur.cloud 2>/dev/null
```

Copie a saída (deve parecer: `ruptur.cloud ssh-rsa AAAAB3...`)

---

## Step 3: Adicionar Secrets ao GitHub

Vá para: **Settings → Secrets and variables → Actions**

### Secrets Necessários:

1. **`DEPLOY_SSH_KEY`** (Obrigatório)
   - Valor: Conteúdo de `~/.ssh/ruptur-deploy`
   
2. **`DEPLOY_KNOWN_HOSTS`** (Obrigatório)
   - Valor: Output do Step 2
   
3. **`SLACK_WEBHOOK`** (Opcional)
   - Valor: URL do webhook Slack

---

## Step 4: Testar Deploy

```bash
# Push para main
git add .
git commit -m "test: trigger deploy"
git push origin main

# Acompanhar: https://github.com/rupturcloud/ruptur-main/actions
```

---

## Step 5: Monitorar

```bash
# SSH para produção
ssh deploy@ruptur.cloud

# Ver logs
tail -f /app/ruptur-saas/logs/*.log

# Health check
curl https://app.ruptur.cloud/health
```

---

**Status:** Pronto para deploy via rsync!
