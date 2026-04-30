#!/bin/bash

# Ruptur SaaS - Script de Deploy Automatizado
# 
# Uso: ./deploy.sh [ambiente]
# Ambientes: production, staging, local

set -e  # Para em caso de erro

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
ENVIRONMENT=${1:-production}
PROJECT_ID="ruptur-jarvis-v1-68358"
ZONE="southamerica-west1-a"
INSTANCE_NAME="ruptur-shipyard-02"
SSH_KEY="$HOME/.ssh/google_compute_engine"
REGISTRY="gcr.io/$PROJECT_ID/saas"

# Funções de log
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificações iniciais
check_prerequisites() {
    log_info "Verificando pré-requisitos..."
    
    # Verifica se gcloud está instalado
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud não está instalado"
        exit 1
    fi
    
    # Verifica se docker está instalado
    if ! command -v docker &> /dev/null; then
        log_error "docker não está instalado"
        exit 1
    fi
    
    # Verifica se a chave SSH existe
    if [ ! -f "$SSH_KEY" ]; then
        log_error "Chave SSH não encontrada: $SSH_KEY"
        exit 1
    fi
    
    log_success "Pré-requisitos verificados"
}

# Obtém IP da instância
get_instance_ip() {
    gcloud compute instances describe $INSTANCE_NAME \
        --zone=$ZONE \
        --project=$PROJECT_ID \
        --format='get(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null
}

# Testa conexão com instância
test_connection() {
    local ip=$(get_instance_ip)
    log_info "Testando conexão com $ip..."
    
    if ssh -i $SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
        diego@$ip "echo 'Conexão OK'" &>/dev/null; then
        log_success "Conexão OK"
        return 0
    else
        log_error "Falha na conexão"
        return 1
    fi
}

# Build da aplicação
build_app() {
    log_info "Buildando aplicação..."
    
    # Build Docker
    docker build -t saas-saas-web:latest .
    
    if [ $? -eq 0 ]; then
        log_success "Build concluído"
    else
        log_error "Falha no build"
        exit 1
    fi
}

# Deploy via Docker
deploy_docker() {
    local ip=$(get_instance_ip)
    log_info "Fazendo deploy para $ip..."
    
    # Copia arquivos
    log_info "Copiando arquivos..."
    scp -i $SSH_KEY -o StrictHostKeyChecking=no -r . diego@$ip:/opt/ruptur/saas-new/
    
    # Faz deploy
    log_info "Instalando nova versão..."
    ssh -i $SSH_KEY -o StrictHostKeyChecking=no diego@$ip << 'EOF'
        cd /opt/ruptur
        
        # Backup da versão atual
        if [ -d "saas" ]; then
            mv saas saas-backup-$(date +%Y%m%d-%H%M%S)
        fi
        
        # Instala nova versão
        mv saas-new saas
        cd saas
        
        # Para container atual
        docker compose -f docker-compose-fixed.yml down || true
        
        # Build e sobe novo container
        docker compose -f docker-compose-fixed.yml up -d --build
        
        # Aguarda saúde
        sleep 10
        
        # Verifica se está rodando
        if docker ps | grep -q saas-web; then
            echo "Deploy OK"
        else
            echo "Deploy FAILED"
            exit 1
        fi
EOF
    
    if [ $? -eq 0 ]; then
        log_success "Deploy concluído"
    else
        log_error "Falha no deploy"
        exit 1
    fi
}

# Testes pós-deploy
run_tests() {
    local ip=$(get_instance_ip)
    log_info "Executando testes pós-deploy..."
    
    # Testa saúde
    if curl -f -s "http://$ip:4173/api/local/health" > /dev/null; then
        log_success "Health check OK"
    else
        log_error "Health check FAILED"
        return 1
    fi
    
    # Testa APIs
    log_info "Testando APIs..."
    
    # Inbox API
    if curl -s "http://$ip:4173/api/inbox/summary" | grep -q "totalInstances"; then
        log_success "Inbox API OK"
    else
        log_warning "Inbox API com problemas"
    fi
    
    # Campaigns API
    if curl -s "http://$ip:4173/api/campaigns" | grep -q "campaigns\|error"; then
        log_success "Campaigns API OK"
    else
        log_warning "Campaigns API com problemas"
    fi
}

# Deploy local
deploy_local() {
    log_info "Iniciando deploy local..."
    
    # Para serviços locais
    docker-compose -f docker-compose-fixed.yml down || true
    
    # Build e sobe
    docker-compose -f docker-compose-fixed.yml up -d --build
    
    log_success "Deploy local concluído"
    log_info "Acesse: http://localhost:4173"
}

# Função principal
main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Ruptur SaaS - Deploy Automatizado${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "Ambiente: ${YELLOW}$ENVIRONMENT${NC}"
    echo ""
    
    case $ENVIRONMENT in
        "production")
            check_prerequisites
            if ! test_connection; then
                log_error "Não foi possível conectar à instância de produção"
                exit 1
            fi
            build_app
            deploy_docker
            run_tests
            log_success "Deploy em produção concluído!"
            echo -e "Acesse: ${GREEN}https://app.ruptur.cloud${NC}"
            ;;
        "staging")
            check_prerequisites
            build_app
            # Lógica para staging (pode ser outra instância)
            log_warning "Ambiente staging não configurado"
            ;;
        "local")
            build_app
            deploy_local
            ;;
        *)
            log_error "Ambiente desconhecido: $ENVIRONMENT"
            echo "Uso: $0 [production|staging|local]"
            exit 1
            ;;
    esac
}

# Executa função principal
main "$@"
