#!/bin/bash

# Ruptur SaaS - CD Pipeline
# 
# Pipeline completo de Deploy Contínuo
# Executado após merge na branch main

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
ENVIRONMENT=${ENVIRONMENT:-production}
REGISTRY="gcr.io/ruptur-jarvis-v1-68358/saas"
BUILD_NUMBER=${BUILD_NUMBER:-latest}

log_info() { echo -e "${BLUE}[CD]${NC} $1"; }
log_success() { echo -e "${GREEN}[CD]${NC} $1"; }
log_error() { echo -e "${RED}[CD]${NC} $1"; }

# Funções do CD
push_to_registry() {
    log_info "Fazendo push para registry..."
    
    # Tag com build number
    docker tag ruptur-saas:latest $REGISTRY:$BUILD_NUMBER
    docker tag ruptur-saas:latest $REGISTRY:latest
    
    # Push
    docker push $REGISTRY:$BUILD_NUMBER
    docker push $REGISTRY:latest
    
    log_success "Push concluído"
}

deploy_to_infra() {
    log_info "Fazendo deploy para $ENVIRONMENT..."
    
    case $ENVIRONMENT in
        "production")
            # Usa script de deploy
            ./infra/scripts/deploy.sh production
            ;;
        "staging")
            ./infra/scripts/deploy.sh staging
            ;;
        *)
            log_error "Ambiente desconhecido: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

run_smoke_tests() {
    log_info "Executando smoke tests..."
    
    # Health check
    for i in {1..30}; do
        if curl -f https://app.ruptur.cloud/api/local/health &>/dev/null; then
            log_success "Health check OK"
            break
        fi
        
        if [ $i -eq 30 ]; then
            log_error "Health check FAILED após 30 tentativas"
            exit 1
        fi
        
        sleep 10
    done
    
    # Testa APIs principais
    log_info "Testando APIs..."
    
    if curl -s https://app.ruptur.cloud/api/inbox/summary | grep -q "totalInstances"; then
        log_success "Inbox API OK"
    else
        log_error "Inbox API FAILED"
        exit 1
    fi
    
    if curl -s https://app.ruptur.cloud/api/campaigns | grep -q "campaigns\|error"; then
        log_success "Campaigns API OK"
    else
        log_error "Campaigns API FAILED"
        exit 1
    fi
}

notify_deploy() {
    log_info "Notificando deploy..."
    
    # Notificação Slack (se configurado)
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 Ruptur SaaS deployado para $ENVIRONMENT (build #$BUILD_NUMBER)\"}" \
            "$SLACK_WEBHOOK" || log_warning "Falha ao notificar Slack"
    fi
    
    # Email (se configurado)
    if command -v mail &> /dev/null && [ -n "$DEPLOY_EMAIL" ]; then
        echo "Deploy #$BUILD_NUMBER concluído para $ENVIRONMENT" | \
            mail -s "Ruptur SaaS Deploy #$BUILD_NUMBER" "$DEPLOY_EMAIL" || \
            log_warning "Falha ao enviar email"
    fi
}

rollback() {
    log_error "Iniciando rollback..."
    
    # Obtém última imagem estável
    LATEST_STABLE=$(gcloud container images list-tags $REGISTRY \
        --filter="tags=stable" --format="get(tags)" | head -1)
    
    if [ -n "$LATEST_STABLE" ]; then
        log_info "Fazendo rollback para $LATEST_STABLE"
        # Implementar lógica de rollback
    else
        log_error "Nenhuma imagem estável encontrada para rollback"
        exit 1
    fi
}

# Pipeline principal
main() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}  Ruptur SaaS - CD Pipeline${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo -e "Ambiente: ${YELLOW}$ENVIRONMENT${NC}"
    echo -e "Build:    ${YELLOW}#$BUILD_NUMBER${NC}"
    echo ""
    
    # Trap para rollback em caso de erro
    trap 'rollback' ERR
    
    # Executa etapas
    push_to_registry
    deploy_to_infra
    run_smoke_tests
    notify_deploy
    
    log_success "Deploy CD concluído com sucesso!"
    
    # Marca como estável se sucesso
    docker tag $REGISTRY:$BUILD_NUMBER $REGISTRY:stable
    docker push $REGISTRY:stable
}

main "$@"
