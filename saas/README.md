# Ruptur SaaS - Plataforma de Automação WhatsApp

[![CI/CD](https://github.com/ruptur-cloud/saas/workflows/Ruptur%20SaaS%20CI/CD%20Pipeline/badge.svg)](https://github.com/ruptur-cloud/saas/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/ruptur-cloud/saas/releases)

Plataforma SaaS completa para automação de WhatsApp com inbox, campanhas em massa, warmup manager e dashboard analítico.

## 🚀 Funcionalidades

### ✅ Core Features
- **Inbox Multi-instância**: Gerencie mensagens de múltiplas instâncias WhatsApp
- **Campanhas em Massa**: Crie e execute campanhas com personalização
- **Warmup Manager**: Sistema completo de aquecimento de contas
- **Dashboard Analítico**: Métricas e insights em tempo real
- **API REST**: Integração completa via APIs

### 🔧 Integrações
- **UAZAPI**: Conexão com API oficial WhatsApp
- **Bubble.io**: Backend no-code e database
- **Stripe**: Processamento de pagamentos
- **Supabase**: Database e autenticação
- **Cloudflare**: DNS e segurança

### 🛠 Deploy & Operação
- **CI/CD Automatizado**: GitHub Actions completo
- **Docker**: Containerização e orquestração
- **Ansible**: Infraestrutura como código
- **Monitoramento**: Logs, métricas e alertas
- **Segurança**: Rate limiting, scans e backups

## 🌐 URLs em Produção

- **Aplicação Principal**: https://app.ruptur.cloud
<<<<<<< HEAD
- **SaaS Dashboard**: https://saas.ruptur.cloud
=======
- **Aplicação/Painel**: https://app.ruptur.cloud
>>>>>>> codex/getnet-prod-fix
- **Warmup Manager**: https://app.ruptur.cloud/warmup
- **API Health**: https://app.ruptur.cloud/api/local/health

## 🚀 Deploy Rápido

### Pré-requisitos
- Docker e Docker Compose
- Node.js 20+
- Conta GCP com permissões
- Chave SSH configurada

### Setup Inicial

```bash
# 1. Clone o repositório
git clone https://github.com/ruptur-cloud/saas.git
cd saas

# 2. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# 3. Setup inicial
make setup

# 4. Deploy em produção
make deploy-prod
```

### Comandos Principais

```bash
# Deploy
make deploy-prod          # Produção
make deploy-staging       # Staging
make deploy-local         # Local

# Operação
make status               # Status do sistema
make logs                 # Logs em tempo real
make restart              # Reiniciar serviço
make test-apis            # Testar APIs

# Manutenção
make backup               # Criar backup
make clean                # Limpar ambiente
make security-scan        # Scan de segurança
```

<<<<<<< HEAD
=======

## ✅ Qualidade, testes e code review

Antes de commit, push ou deploy, rode na raiz `saas/`:

```bash
npm run review
npm run quality
npm run test:coverage
```

Documentos principais:

- [Quality Gate](docs/QUALITY_GATE.md) — comandos oficiais, cobertura, critérios de bloqueio e validação pós-deploy.
- [Code Review](docs/CODE_REVIEW.md) — checklist funcional, segurança, migrations, billing, frontend e observabilidade.

O projeto possui template de Pull Request em `.github/pull_request_template.md` para padronizar evidências de teste, revisão de segurança e validação de deploy.

>>>>>>> codex/getnet-prod-fix
## 📁 Estrutura do Projeto

```
saas/
├── 📁 modules/                    # Módulos da aplicação
│   ├── inbox/                    # Inbox e mensagens
│   ├── campaigns/                # Campanhas e disparos
│   ├── warmup-core/              # Warmup Manager
│   ├── billing/                  # Faturamento
│   └── integrations/             # APIs externas
├── 📁 web/                       # Frontend
│   ├── dist/                     # App principal
│   ├── dashboard-dist/           # Dashboard SaaS
│   └── manager-dist/             # Warmup Manager
├── 📁 infra/                     # Infraestrutura
│   ├── ansible/                  # Playbooks Ansible
│   ├── terraform/                # Infra como código
│   └── scripts/                  # Scripts de automação
├── 📁 .github/workflows/         # CI/CD
├── 📁 docs/                      # Documentação
├── 📄 Makefile                   # Comandos centralizados
├── 📄 docker-compose.yml         # Orquestração
└── 📄 .env.example              # Variáveis de ambiente
```

## 🔌 APIs Disponíveis

### Inbox API
```bash
# Resumo do inbox
GET /api/inbox/summary

# Mensagens por instância
GET /api/inbox/messages/{instanceId}

# Enviar mensagem
POST /api/inbox/send/{instanceId}
```

### Campaigns API
```bash
# Listar campanhas
GET /api/campaigns

# Criar campanha
POST /api/campaigns

# Lançar campanha
POST /api/campaigns/{id}/launch

# Estatísticas
GET /api/campaigns/{id}/stats
```

### Health & System
```bash
# Saúde do sistema
GET /api/local/health

# Configuração
GET /api/local/app/config

# Estado do warmup
GET /api/local/warmup/state
```

## 🧪 Desenvolvimento Local

### Ambiente Local

```bash
# Iniciar ambiente local
make deploy-local

# Acessar aplicação
open http://localhost:4173
```

### Testes

```bash
# Testes unitários
npm test

# Testes de integração
make test-apis

# Testes E2E
npm run test:e2e
```

### Build

```bash
# Build para produção
npm run build

# Build Docker
make build
```

## 🔧 Configuração

### Variáveis de Ambiente Obrigatórias

```bash
# GCP
GCP_PROJECT_ID=ruptur-jarvis-v1-68358
GCP_ZONE=southamerica-west1-a

# UAZAPI
UAZAPI_TOKEN=seu_token_aqui
WARMUP_ADMIN_TOKEN=seu_token_aqui

# Bubble
BUBBLE_API_KEY=sua_chave_aqui

# Supabase
VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_PUBLISHABLE_KEY=sua_key_aqui
```

Veja [.env.example](.env.example) para todas as variáveis disponíveis.

## 📊 Monitoramento

### Logs

```bash
# Logs em tempo real
make logs

# Logs específicos
docker logs saas-web --tail 100
```

### Métricas

- **Response Time**: Tempo de resposta das APIs
- **Error Rate**: Taxa de erros 4xx/5xx
- **Container Health**: Status dos containers
- **Resource Usage**: CPU, memória, disco

### Alertas

Configurados para:
- **Health checks**: Falhas na aplicação
- **Error rate**: Alta taxa de erros
- **Resource limits**: CPU/memória > 80%
- **Deploy failures**: Falhas no deploy

## 🔒 Segurança

### Implementações

- ✅ **Rate Limiting**: 100 req/15min por IP
- ✅ **CORS**: Configurado para domínios específicos
- ✅ **HTTPS**: Forçado via Cloudflare
- ✅ **Security Headers**: HSTS, CSP, etc.
- ✅ **Input Validation**: Validação em todas as APIs
- ✅ **Secrets Management**: Variáveis de ambiente
- ✅ **Regular Scans**: Trivy, npm audit

### Boas Práticas

1. **Never commit secrets**: Use `.env` ou secrets
2. **Principle of least privilege**: Permissões mínimas
3. **Regular updates**: Dependências e bases
4. **Audit logs**: Log de todas as ações
5. **Backup strategy**: Backups diários automatizados

## 🔄 CI/CD Pipeline

### Triggers

- **Push to main**: Deploy automático produção
- **Push to develop**: Deploy para staging
- **Pull Request**: Testes e validações
- **Release**: Tag e release assets

### Stages

1. **Lint & Test**: Qualidade de código
2. **Security Scan**: Vulnerabilidades
3. **Build**: Imagem Docker
4. **E2E Tests**: Testes ponta a ponta
5. **Deploy**: Instalação na infra
6. **Smoke Tests**: Validação pós-deploy
7. **Notify**: Slack/email

### Rollback

Automático em caso de falha:
- Health check fails → rollback
- API tests fail → rollback
- High error rate → rollback

## 📈 Performance

### Otimizações

- **Docker layers**: Cache inteligente
- **Static assets**: CDN e cache
- **Database**: Índices e queries otimizadas
- **API responses**: Cache Redis
- **Images**: WebP e lazy loading

### Métricas Atuais

- **Response time**: < 200ms (p95)
- **Uptime**: 99.9%
- **Error rate**: < 1%
- **Build time**: < 5 minutos

## 🛠 Troubleshooting

### Problemas Comuns

#### Container não sobe
```bash
# Verificar logs
make logs

# Verificar status
docker ps | grep saas-web

# Reiniciar
make restart
```

#### APIs retornando 404
```bash
# Verificar se está rodando
curl http://localhost:4173/api/local/health

# Verificar logs de erros
docker logs saas-web | grep ERROR
```

#### Deploy falhou
```bash
# Deploy com debug
DEBUG=1 make deploy-prod

# Verificar logs completos
./infra/scripts/deploy.sh production --verbose
```

### Debug Mode

```bash
# Ativar debug
export DEBUG=1

# Logs detalhados
docker logs saas-web --tail 200
```

## 📚 Documentação

- [**Deployment Guide**](docs/DEPLOYMENT.md) - Deploy completo e automação
- [**API Reference**](docs/API.md) - Documentação das APIs
- [**Architecture**](docs/ARCHITECTURE.md) - Arquitetura do sistema
- [**Security**](docs/SECURITY.md) - Políticas de segurança

## 🤝 Contribuição

### Como Contribuir

1. **Fork** o repositório
2. **Create branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** suas mudanças (`git commit -m 'Add amazing feature'`)
4. **Push** para branch (`git push origin feature/amazing-feature`)
5. **Open Pull Request**

### Standards

- **Code style**: ESLint + Prettier
- **Commits**: Conventional Commits
- **Tests**: Cobertura > 80%
- **Docs**: Atualizar documentação

## 📞 Suporte

### Canais

- **🚨 Emergências**: Slack #ruptur-saas
- **📧 Email**: admin@ruptur.cloud
- **📖 Docs**: [Wiki](https://github.com/ruptur-cloud/saas/wiki)
- **🐛 Issues**: [GitHub Issues](https://github.com/ruptur-cloud/saas/issues)

### SLA

- **Crítico**: 1 hora
- **Alto**: 4 horas
- **Médio**: 24 horas
- **Baixo**: 72 horas

## 📜 Licença

Este projeto está licenciado sob a Licença MIT - veja [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- **UAZAPI**: API WhatsApp oficial
- **Bubble.io**: Plataforma no-code
- **Cloudflare**: CDN e segurança
- **Google Cloud**: Infraestrutura cloud

---

## 🚀 Quick Start

```bash
# 1. Clone e configure
git clone https://github.com/ruptur-cloud/saas.git
cd saas
cp .env.example .env

# 2. Deploy produção
make deploy-prod

# 3. Acesse a aplicação
open https://app.ruptur.cloud

# 4. Verifique status
make status
```

🎉 **Pronto!** Sua instância SaaS está rodando em produção.

---

**Ruptur SaaS** - Automação WhatsApp em escala 🚀
<<<<<<< HEAD
=======
# 🚀 Deploy Automático Test - Fri May  1 10:06:12 -03 2026
>>>>>>> codex/getnet-prod-fix
