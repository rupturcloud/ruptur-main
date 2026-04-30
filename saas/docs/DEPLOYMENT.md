# Ruptur SaaS - Guia de Deploy e Automação

## Visão Geral

Este documento descreve a estrutura completa de automação do Ruptur SaaS, incluindo CI/CD, deploy e operação.

## 🚀 Deploy Rápido

### Via Makefile (Recomendado)

```bash
# Deploy em produção
make deploy-prod

# Deploy local
make deploy-local

# Testar APIs
make test-apis

# Ver status
make status
```

### Via Scripts

```bash
# Deploy automatizado
./infra/scripts/deploy.sh production

# Pipeline CI
./infra/scripts/ci-pipeline.sh

# Pipeline CD
./infra/scripts/cd-pipeline.sh
```

## 📁 Estrutura de Automação

```
saas/
├── Makefile                    # Comandos centralizados
├── .env.example               # Variáveis de ambiente
├── .github/workflows/         # GitHub Actions CI/CD
│   └── ci-cd.yml
├── infra/                     # Infraestrutura e deploy
│   ├── ansible/              # Playbooks Ansible
│   ├── terraform/            # Infraestrutura como código
│   └── scripts/              # Scripts de automação
│       ├── deploy.sh         # Script principal de deploy
│       ├── ci-pipeline.sh    # Pipeline de CI
│       └── cd-pipeline.sh    # Pipeline de CD
└── docs/                     # Documentação
    └── DEPLOYMENT.md
```

## 🔧 Configuração Inicial

### 1. Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar com suas credenciais
nano .env
```

Variáveis obrigatórias:
- `GCP_PROJECT_ID`: ID do projeto GCP
- `UAZAPI_TOKEN`: Token da API UAZAPI
- `BUBBLE_API_KEY`: Chave da API Bubble

### 2. Pré-requisitos

```bash
# Instalar ferramentas necessárias
brew install docker gcloud

# Configurar GCP
gcloud auth login
gcloud config set project ruptur-jarvis-v1-68358

# Configurar chave SSH
chmod 400 ~/.ssh/google_compute_engine
```

### 3. Setup Inicial

```bash
# Criar estrutura de diretórios
make setup

# Testar conexão
make ssh
```

## 🔄 Processos de Deploy

### Deploy em Produção

1. **Build Local**: Build da imagem Docker
2. **Transferência**: SCP dos arquivos para instância
3. **Instalação**: Docker Compose na instância
4. **Testes**: Health checks e APIs
5. **Notificação**: Slack/email

```bash
make deploy-prod
```

### Deploy Local

```bash
make deploy-local
# Acessar: http://localhost:4173
```

### Deploy Staging

```bash
make deploy-staging
```

## 🧪 Testes e Validação

### Testes Automáticos

```bash
# Testar todas as APIs
make test-apis

# Health check
make test-health

# Testes completos
make ci
```

### APIs Disponíveis

- **Health**: `GET /api/local/health`
- **Inbox**: `GET /api/inbox/summary`
- **Campaigns**: `GET /api/campaigns`
- **Warmup**: `GET /api/local/warmup/state`

### Exemplos de Testes

```bash
# Teste de saúde
curl https://app.ruptur.cloud/api/local/health

# Teste de inbox
curl https://app.ruptur.cloud/api/inbox/summary | jq .

# Teste de campanhas
curl https://app.ruptur.cloud/api/campaigns | jq .
```

## 📊 Monitoramento e Logs

### Logs em Tempo Real

```bash
make logs
# ou
ssh -i ~/.ssh/google_compute_engine diego@$(make get-ip) "docker logs saas-web -f"
```

### Status do Sistema

```bash
make status
# Retorna: container status + API summary
```

### Monitoramento

```bash
make monitor
# Abre dashboards no navegador
```

## 🛠 Operações Comuns

### Reiniciar Serviço

```bash
make restart
```

### Backup

```bash
make backup
# Cria backup completo em /opt/ruptur/
```

### Restore

```bash
make restore-backup BACKUP_FILE=saas-backup-20240430-143000.tar.gz
```

### Limpeza

```bash
make clean
# Remove containers, imagens e cache Docker
```

## 🔄 CI/CD Pipeline

### GitHub Actions

O pipeline é acionado automaticamente por:

1. **Push para main**: Deploy automático para produção
2. **Push para develop**: Deploy para staging
3. **Pull Request**: Executa testes e validações
4. **Release**: Cria release e assets

### Etapas do Pipeline

#### CI (Continuous Integration)
- ✅ Lint de código
- ✅ Testes unitários
- ✅ Security audit
- ✅ Build Docker
- ✅ Testes E2E
- ✅ Geração de artefatos

#### CD (Continuous Deployment)
- ✅ Push para registry
- ✅ Deploy para infraestrutura
- ✅ Smoke tests
- ✅ Notificações
- ✅ Rollback automático em caso de falha

### Variáveis do GitHub Actions

Configurar em Repository Settings > Secrets and variables > Actions:

- `GCP_SA_KEY`: Service account key GCP
- `SLACK_WEBHOOK`: Webhook do Slack
- `DEPLOY_EMAIL`: Email para notificações

## 🔒 Segurança

### Boas Práticas

1. **Variáveis sensíveis**: Sempre em `.env` ou secrets
2. **Chaves SSH**: Permissões 400
3. **Acesso**: Limitado a IPs necessários
4. **Logs**: Sem informações sensíveis
5. **Imagens**: Base atualizadas e security scan

### Security Scan

```bash
make security-scan
# Executa scan de vulnerabilidades
```

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. Falha de Conexão SSH
```bash
# Verificar chave
ls -la ~/.ssh/google_compute_engine

# Testar conexão
make ssh
```

#### 2. Container não sobe
```bash
# Verificar logs
make logs

# Verificar status
docker ps | grep saas-web
```

#### 3. APIs retornando 404
```bash
# Verificar se container está rodando
make status

# Testar health check
curl http://localhost:4173/api/local/health
```

#### 4. Deploy falhou
```bash
# Verificar logs de deploy
./infra/scripts/deploy.sh production --debug

# Rollback manual
make restore-backup BACKUP_FILE=ultimo-backup.tar.gz
```

### Debug Mode

```bash
# Deploy com debug
DEBUG=1 ./infra/scripts/deploy.sh production

# Logs detalhados
docker logs saas-web --tail 100
```

## 📈 Performance e Escalabilidade

### Rate Limiting

Configurado para limitar requisições:
- **Janela**: 15 minutos
- **Máximo**: 100 requisições por IP

### Cache

- **Static assets**: Nginx cache
- **API responses**: Redis (se configurado)
- **Docker layers**: Cache em builds

### Monitoramento

Métricas disponíveis:
- **Response time**: Tempo de resposta das APIs
- **Error rate**: Taxa de erros
- **Container health**: Saúde dos containers
- **Resource usage**: CPU, memória, disco

## 🔄 Manutenção

### Tarefas Semanais

1. **Backup**: `make backup`
2. **Security scan**: `make security-scan`
3. **Logs review**: Verificar logs de erros
4. **Updates**: Atualizar dependências

### Tarefas Mensais

1. **Cleanup**: `make clean`
2. **Capacity planning**: Analisar uso de recursos
3. **Security audit**: Revisar permissões
4. **Documentation update**: Atualizar docs

## 📞 Suporte

### Contatos

- **Emergências**: Slack #ruptur-saas
- **Deploy issues**: Email admin@ruptur.cloud
- **Documentation**: Este documento + Wiki

### Escalonamento

1. **Nível 1**: Verificar documentação e logs
2. **Nível 2**: Contatar time de infraestrutura
3. **Nível 3**: Escalar para arquiteto/tech lead

---

## 📝 Resumo Rápido

```bash
# Setup inicial
make setup

# Deploy produção
make deploy-prod

# Testar
make test-apis

# Monitorar
make logs

# Status
make status
```

Tudo o que você precisa está no `Makefile`! 🚀
