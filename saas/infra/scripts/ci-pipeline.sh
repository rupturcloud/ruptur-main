#!/bin/bash

# Ruptur SaaS - CI Pipeline
# 
# Pipeline completo de Integração Contínua
# Executado em cada push/PR

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
BRANCH_NAME=${GITHUB_REF_NAME:-$(git branch --show-current)}
COMMIT_SHA=${GITHUB_SHA:-$(git rev-parse HEAD)}
BUILD_NUMBER=${GITHUB_RUN_NUMBER:-local}

log_info() { echo -e "${BLUE}[CI]${NC} $1"; }
log_success() { echo -e "${GREEN}[CI]${NC} $1"; }
log_error() { echo -e "${RED}[CI]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[CI]${NC} $1"; }

# Error handler
trap 'handle_error' ERR

handle_error() {
    log_error "PIPELINE FALHOU!"
    log_error "Build #$BUILD_NUMBER falhou na execução"
    exit 1
}

# Etapas do CI
lint_code() {
    log_info "Executando lint..."

    # JavaScript/Node.js
    if [ -f "package.json" ]; then
        if ! npm run lint; then
            log_error "Lint falhou! Pipeline bloqueado."
            exit 1
        fi
    fi

    # Dockerfile
    if command -v hadolint &> /dev/null; then
        if ! hadolint Dockerfile; then
            log_error "Hadolint falhou! Pipeline bloqueado."
            exit 1
        fi
    fi
}

run_tests() {
    log_info "Executando testes..."

    # Testes unitários (OBRIGATÓRIO - bloqueia se falhar)
    if [ -f "package.json" ]; then
        if ! npm test -- --runInBand; then
            log_error "Testes unitários falharam! Pipeline bloqueado."
            exit 1
        fi
        log_success "Testes unitários OK"
    else
        log_error "Arquivo package.json não encontrado!"
        exit 1
    fi

    # Testes de cobertura
    log_info "Gerando relatório de cobertura..."
    if ! npm run test:coverage; then
        log_error "Testes de cobertura falharam! Pipeline bloqueado."
        exit 1
    fi
    log_success "Cobertura verificada"
}

security_scan() {
    log_info "Executando scan de segurança..."

    # npm audit (OBRIGATÓRIO)
    if [ -f "package.json" ]; then
        if ! npm audit --audit-level moderate; then
            log_error "npm audit encontrou vulnerabilidades! Pipeline bloqueado."
            exit 1
        fi
        log_success "npm audit OK"
    fi

    # Snyk (se disponível - warning apenas)
    if command -v snyk &> /dev/null; then
        if ! snyk test; then
            log_warning "Snyk encontrou vulnerabilidades (não bloqueia)"
        fi
    fi
}

build_application() {
    log_info "Build da aplicação..."

    # Build Node.js (OBRIGATÓRIO)
    if [ -f "package.json" ]; then
        if ! npm ci --production; then
            log_error "npm ci falhou! Pipeline bloqueado."
            exit 1
        fi

        if ! npm run build; then
            log_error "Build falhou! Pipeline bloqueado."
            exit 1
        fi
    fi

    # Build Docker (OBRIGATÓRIO)
    if ! docker build -t ruptur-saas:$BUILD_NUMBER .; then
        log_error "Docker build falhou! Pipeline bloqueado."
        exit 1
    fi

    docker tag ruptur-saas:$BUILD_NUMBER ruptur-saas:latest
    log_success "Build concluído com sucesso"
}

run_e2e_tests() {
    log_info "Executando testes E2E..."

    # Inicia container para testes
    if ! docker run -d --name test-container -p 4173:4173 ruptur-saas:latest; then
        log_error "Falha ao iniciar container! Pipeline bloqueado."
        exit 1
    fi

    # Aguarda startup
    log_info "Aguardando inicialização do container (30s)..."
    sleep 30

    # Testa APIs (OBRIGATÓRIO)
    if ! curl -f http://localhost:4173/api/local/health; then
        log_error "Health check FAILED! Pipeline bloqueado."
        docker rm -f test-container || true
        exit 1
    fi

    log_success "Health check OK"

    # Limpa container
    if ! docker rm -f test-container; then
        log_warning "Falha ao remover container (continuando)"
    fi
}

generate_artifacts() {
    log_info "Gerando artefatos..."
    
    # Cria diretório de artefatos
    mkdir -p artifacts
    
    # Salva informações do build
    cat > artifacts/build-info.json << EOF
{
    "branch": "$BRANCH_NAME",
    "commit": "$COMMIT_SHA",
    "build_number": "$BUILD_NUMBER",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "docker_image": "ruptur-saas:$BUILD_NUMBER"
}
EOF
    
    log_success "Artefatos gerados"
}

# Pipeline principal
main() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}  Ruptur SaaS - CI Pipeline${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo -e "Branch: ${YELLOW}$BRANCH_NAME${NC}"
    echo -e "Commit: ${YELLOW}$COMMIT_SHA${NC}"
    echo -e "Build:  ${YELLOW}#$BUILD_NUMBER${NC}"
    echo ""
    
    # Executa etapas
    lint_code
    run_tests
    security_scan
    build_application
    run_e2e_tests
    generate_artifacts
    
    log_success "Pipeline CI concluído com sucesso!"
}

main "$@"
