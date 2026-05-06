#!/bin/bash

# Script para configurar deploy automático via GitHub
# Uso: ./setup-github-deploy.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[SETUP]${NC} $1"; }
log_success() { echo -e "${GREEN}[SETUP]${NC} $1"; }
log_error() { echo -e "${RED}[SETUP]${NC} $1"; }

# Configurações
GITHUB_ORG="rupturcloud"
REPO_NAME="ruptur-saas"
SERVICE_ACCOUNT_KEY="/tmp/sa-key.json"

log_info "Configurando deploy automático via GitHub..."

# 1. Verificar se estamos no diretório correto
if [ ! -f "Makefile" ] || [ ! -d "modules" ]; then
    log_error "Execute este script do diretório raiz do SaaS"
    exit 1
fi

# 2. Verificar se a service account key existe
if [ ! -f "$SERVICE_ACCOUNT_KEY" ]; then
    log_error "Service account key não encontrada em $SERVICE_ACCOUNT_KEY"
    log_info "Execute: gcloud iam service-accounts keys create /tmp/sa-key.json --iam-account=saas-deploy@ruptur-jarvis-v1-68358.iam.gserviceaccount.com"
    exit 1
fi

# 3. Criar repositório no GitHub (se não existir)
log_info "Verificando repositório GitHub..."

# Usar GitHub CLI se disponível
if command -v gh &> /dev/null; then
    if ! gh repo view $GITHUB_ORG/$REPO_NAME &>/dev/null; then
        log_info "Criando repositório $REPO_NAME..."
        gh repo create $GITHUB_ORG/$REPO_NAME --public --description="Ruptur SaaS - Plataforma de Automação WhatsApp" --clone=false
        log_success "Repositório criado!"
    else
        log_info "Repositório já existe"
    fi
    
    # Configurar remote
    git remote remove saas 2>/dev/null || true
    git remote add saas https://github.com/$GITHUB_ORG/$REPO_NAME.git
    log_success "Remote 'saas' configurado"
else
    log_warning "GitHub CLI não encontrado. Configure manualmente:"
    echo "1. Vá para https://github.com/new"
    echo "2. Nome: $REPO_NAME"
    echo "3. Owner: $GITHUB_ORG"
    echo "4. Execute: git remote add saas https://github.com/$GITHUB_ORG/$REPO_NAME.git"
fi

# 4. Configurar secrets do GitHub Actions
log_info "Configurando secrets do GitHub Actions..."

if command -v gh &> /dev/null; then
    # GCP_SA_KEY
    log_info "Configurando GCP_SA_KEY..."
    gh secret set GCP_SA_KEY --repo $GITHUB_ORG/$REPO_NAME < $SERVICE_ACCOUNT_KEY
    
    # SLACK_WEBHOOK (opcional - placeholder)
    log_info "Configurando SLACK_WEBHOOK (placeholder)..."
    gh secret set SLACK_WEBHOOK --repo $GITHUB_ORG/$REPO_NAME --body "https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"
    
    # DEPLOY_EMAIL
    log_info "Configurando DEPLOY_EMAIL..."
    gh secret set DEPLOY_EMAIL --repo $GITHUB_ORG/$REPO_NAME --body "admin@ruptur.cloud"
    
    log_success "Secrets configuradas!"
else
    log_warning "Configure manualmente em GitHub > Settings > Secrets:"
    echo "1. GCP_SA_KEY: conteúdo de $SERVICE_ACCOUNT_KEY"
    echo "2. SLACK_WEBHOOK: https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"
    echo "3. DEPLOY_EMAIL: admin@ruptur.cloud"
fi

# 5. Fazer push inicial
log_info "Fazendo push inicial para o repositório SaaS..."

# Garantir que estamos na branch main
git checkout main 2>/dev/null || git checkout -b main

# Adicionar todos os arquivos
git add .

# Commit se houver mudanças
if git diff --staged --quiet; then
    log_info "Nenhuma mudança para commit"
else
    git commit -m "feat: complete automation infrastructure

- Add comprehensive Makefile with 25+ commands
- Add CI/CD pipelines with GitHub Actions
- Add automated deployment scripts
- Add inbox and campaigns modules
- Add complete documentation
- Setup infrastructure as code

🚀 Ready for automated deployment!"
fi

# Push para o repositório SaaS
git push saas main -f

log_success "Push inicial concluído!"

# 6. Instruções finais
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deploy Automático Configurado!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Repositório:${NC} https://github.com/$GITHUB_ORG/$REPO_NAME"
echo -e "${BLUE}Actions:${NC}   https://github.com/$GITHUB_ORG/$REPO_NAME/actions"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "1. Configure as secrets manualmente se necessário"
echo "2. Monitore o primeiro deploy em GitHub Actions"
echo "3. Teste: git push saas main"
echo ""
echo -e "${BLUE}Comandos úteis:${NC}"
echo "- make deploy-prod     # Deploy manual"
echo "- make test-apis       # Testar APIs"
echo "- make status          # Ver status"
echo ""
echo -e "${GREEN}Deploy automático está pronto! 🚀${NC}"
