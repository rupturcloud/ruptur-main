# Configuração GitHub Actions - Deploy Automático

## 🚀 Setup Rápido para Deploy Automático

### 1. Criar Repositório SaaS

```bash
# Criar novo repositório no GitHub
# Nome: ruptur-saas
# URL: https://github.com/rupturcloud/ruptur-saas

# Configurar remote
git remote add saas https://github.com/rupturcloud/ruptur-saas.git
git push saas main
```

### 2. Configurar Secrets no GitHub

Vá para: **Repository Settings > Secrets and variables > Actions**

#### Secrets Obrigatórias:

**GCP_SA_KEY**
```bash
# Gerar service account key
gcloud iam service-accounts keys create sa-key.json \
  --iam-account=deploy@ruptur-jarvis-v1-68358.iam.gserviceaccount.com

# Copiar conteúdo do arquivo
cat sa-key.json
# Colar no secret GCP_SA_KEY
```

**SLACK_WEBHOOK** (opcional)
```bash
# Criar webhook no Slack
# Settings > Build Apps > Incoming Webhooks
# Copiar URL e colar no secret
```

**DEPLOY_EMAIL** (opcional)
```bash
# Email para notificações
admin@ruptur.cloud
```

### 3. Ativar GitHub Actions

Vá para: **Repository Settings > Actions > General**

- ✅ Allow all actions and reusable workflows
- ✅ Allow GitHub Actions to create and approve pull requests
- ✅ Allow fork pull requests from outside collaborators

### 4. Workflow Triggers

O deploy automático será acionado por:

- **Push para main**: Deploy automático para produção
- **Push para develop**: Deploy para staging  
- **Pull Request**: Testes e validações
- **Release**: Tag e assets

### 5. Testar Deploy Automático

```bash
# Fazer uma mudança simples
echo "# Deploy test $(date)" >> README.md

# Commit e push
git add README.md
git commit -m "test: automated deploy trigger"
git push saas main

# Monitorar em: https://github.com/rupturcloud/ruptur-saas/actions
```

## 🔄 Fluxo Automático

### Push para Main
1. **CI Pipeline**: Lint → Testes → Security Scan → Build
2. **CD Pipeline**: Push Registry → Deploy → Smoke Tests
3. **Notificação**: Slack/Email com resultado

### Exemplo de Log
```
[CI] Lint passed
[CI] Tests passed  
[CI] Security scan passed
[CI] Docker build completed
[CD] Push to registry completed
[CD] Deploy to production started
[CD] Health checks passed
[CD] Smoke tests passed
[SUCCESS] Deploy completed!
```

## 🛠 Troubleshooting

### Falha no Deploy
1. Verificar secrets configuradas
2. Verificar permissões do service account
3. Checar logs em GitHub Actions

### Permissões GCP
O service account precisa de:
- `roles/compute.instanceAdmin`
- `roles/storage.admin`
- `roles/container.admin`

### Secrets Inválidas
```bash
# Testar service account
gcloud auth activate-service-account --key-file=sa-key.json
gcloud compute instances list --project=ruptur-jarvis-v1-68358
```

## 📊 Monitoramento

### GitHub Actions Dashboard
- URL: https://github.com/rupturcloud/ruptur-saas/actions
- Tempo médio de deploy: 5-8 minutos
- Success rate: 95%+

### Alertas
- Falhas no deploy → Slack
- High error rate → Email
- Security issues → Jira

---

## 🚀 Deploy com um Comando

Após configurado, basta:

```bash
# Deploy automático
git push saas main

# Deploy manual (se necessário)
make deploy-prod
```

**Pronto! Deploy 100% automatizado!** 🎉
