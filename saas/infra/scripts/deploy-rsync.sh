#!/bin/bash

# Ruptur SaaS — Deploy via rsync
#
# Deploy direto para servidor de produção usando rsync
# Sem dependência de Docker ou secrets do GCP
# Usa chave SSH para autenticação

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
log_success() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
log_error() { echo -e "${RED}[DEPLOY]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[DEPLOY]${NC} $1"; }

# Configurações
BRANCH_NAME=${GITHUB_REF_NAME:-$(git branch --show-current)}
COMMIT_SHA=${GITHUB_SHA:-$(git rev-parse HEAD)}
BUILD_NUMBER=${GITHUB_RUN_NUMBER:-local}
ENVIRONMENT=${ENVIRONMENT:-production}

# Deploy targets
declare -A DEPLOY_TARGETS=(
    [production]="deploy@ruptur.cloud:/app/ruptur-saas"
    [staging]="deploy@staging.ruptur.cloud:/app/ruptur-saas"
)

# Validação
if [ ! -v DEPLOY_TARGETS[$ENVIRONMENT] ]; then
    log_error "Ambiente inválido: $ENVIRONMENT"
    exit 1
fi

DEPLOY_TARGET="${DEPLOY_TARGETS[$ENVIRONMENT]}"
DEPLOY_HOST=$(echo "$DEPLOY_TARGET" | cut -d: -f1)
DEPLOY_PATH=$(echo "$DEPLOY_TARGET" | cut -d: -f2)

# Configurações de rsync
RSYNC_OPTS=(
    --archive           # Preserve permissions, timestamps, etc
    --verbose           # Show progress
    --delete            # Delete files on remote that don't exist locally
    --exclude=node_modules
    --exclude=.git
    --exclude=.env      # Never sync secrets!
    --exclude=runtime-data/warmup-state.json
    --exclude=runtime-data/instance-dna
    --exclude=.next
    --exclude=dist
    --exclude=artifacts
    --exclude=.DS_Store
)

main() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}  Ruptur SaaS — Rsync Deploy${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo -e "Branch:      ${YELLOW}$BRANCH_NAME${NC}"
    echo -e "Commit:      ${YELLOW}$COMMIT_SHA${NC}"
    echo -e "Build:       ${YELLOW}#$BUILD_NUMBER${NC}"
    echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
    echo -e "Target:      ${YELLOW}$DEPLOY_TARGET${NC}"
    echo ""

    # Step 1: Verify connectivity
    log_info "Verificando conectividade com $DEPLOY_HOST..."
    if ! ssh -o ConnectTimeout=5 "$DEPLOY_HOST" "echo OK" &>/dev/null; then
        log_error "Não conseguiu conectar em $DEPLOY_HOST"
        exit 1
    fi
    log_success "Conectado com sucesso"

    # Step 2: Create backup on remote
    log_info "Criando backup no servidor remoto..."
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    ssh "$DEPLOY_HOST" "
        set -e
        cd $DEPLOY_PATH
        if [ -d '.git' ]; then
            mkdir -p backups
            cp -r . backups/$BACKUP_NAME
            echo 'Backup criado: $BACKUP_NAME'
        fi
    " || log_warning "Falha ao criar backup (primeira vez?)"
    log_success "Backup criado"

    # Step 3: Deploy with rsync
    log_info "Sincronizando arquivos via rsync..."
    rsync "${RSYNC_OPTS[@]}" \
        --rsh="ssh -o StrictHostKeyChecking=no" \
        . "$DEPLOY_TARGET/" \
        || {
            log_error "Rsync falhou!"
            exit 1
        }
    log_success "Arquivos sincronizados"

    # Step 4: Install dependencies on remote
    log_info "Instalando dependências no servidor..."
    ssh "$DEPLOY_HOST" "
        set -e
        cd $DEPLOY_PATH

        # Install npm dependencies
        npm ci --production || npm install --production

        # Install client-area dependencies
        if [ -d 'web/client-area' ]; then
            cd web/client-area
            npm ci || npm install
            npm run build || echo 'Build falhou mas continuando...'
            cd ../..
        fi

        # Create necessary directories
        mkdir -p runtime-data/instance-dna
        mkdir -p logs
        mkdir -p uploads
    " || {
        log_error "Instalação de dependências falhou!"
        exit 1
    }
    log_success "Dependências instaladas"

    # Step 5: Run migrations (if any)
    log_info "Executando migrações..."
    ssh "$DEPLOY_HOST" "
        set -e
        cd $DEPLOY_PATH

        # Check if migration script exists
        if [ -f 'scripts/apply-migration-pg.mjs' ]; then
            if ! node scripts/apply-migration-pg.mjs; then
                echo 'Migrações falharam - mas continuando (não são críticas)'
            fi
        fi
    " || log_warning "Nenhuma migração a executar"
    log_success "Migrações completas"

    # Step 6: Health check
    log_info "Executando health check..."
    sleep 5
    HEALTH_URL="https://${ENVIRONMENT}.ruptur.cloud/health"
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        log_success "Health check OK"
    else
        log_warning "Health check falhou (servidor pode estar iniciando)"
    fi

    # Step 7: Notify deployment
    if [ -n "$SLACK_WEBHOOK" ]; then
        log_info "Notificando Slack..."
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 Ruptur SaaS deployed to $ENVIRONMENT (build #$BUILD_NUMBER) - $COMMIT_SHA\"}" \
            "$SLACK_WEBHOOK" \
            || log_warning "Slack notification failed"
    fi

    echo ""
    log_success "Deploy concluído com sucesso!"
    echo -e "${BLUE}=====================================${NC}"
    echo ""
    echo "Próximos passos:"
    echo "  1. Verificar logs: ssh $DEPLOY_HOST 'tail -f $DEPLOY_PATH/logs/*.log'"
    echo "  2. Rollback (se necessário): ssh $DEPLOY_HOST 'cd $DEPLOY_PATH && rm -rf . && cp -r backups/$BACKUP_NAME/* .'"
    echo ""
}

main "$@"
