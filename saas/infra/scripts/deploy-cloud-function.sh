#!/bin/bash

# Deploy e configuração da Cloud Function notification-dispatcher
# Conecta ao Pub/Sub topic para processar eventos de notificação

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
PROJECT_ID="ruptur-jarvis-v1-68358"
REGION="us-central1"
FUNCTION_NAME="notification-dispatcher"
PUBSUB_TOPIC="notification-events"
RUNTIME="nodejs20"
MEMORY="512MB"
TIMEOUT="60"

# Validar variáveis de ambiente
check_env_vars() {
    local missing_vars=()

    [ -z "$SUPABASE_URL" ] && missing_vars+=("SUPABASE_URL")
    [ -z "$SUPABASE_KEY" ] && missing_vars+=("SUPABASE_KEY")
    [ -z "$SENDGRID_API_KEY" ] && missing_vars+=("SENDGRID_API_KEY")

    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo -e "${RED}[ERROR] Variáveis de ambiente faltando:${NC}"
        printf '%s\n' "${missing_vars[@]}"
        echo ""
        echo "Configure as variáveis em .env ou no ambiente"
        exit 1
    fi
}

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

main() {
    log_info "Iniciando deploy da Cloud Function..."

    # Validar pré-requisitos
    log_info "Verificando pré-requisitos..."
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud não está instalado"
        exit 1
    fi
    log_success "gcloud disponível"

    # Verificar se estamos na pasta correta
    if [ ! -d "functions/notification-dispatcher" ]; then
        log_error "Pasta functions/notification-dispatcher não encontrada"
        echo "Execute o script da raiz da pasta saas/"
        exit 1
    fi
    log_success "Estrutura de pastas válida"

    # Verificar topico Pub/Sub existe
    log_info "Verificando Pub/Sub topic..."
    if gcloud pubsub topics describe $PUBSUB_TOPIC --project=$PROJECT_ID &>/dev/null; then
        log_success "Pub/Sub topic '$PUBSUB_TOPIC' existe"
    else
        log_error "Pub/Sub topic '$PUBSUB_TOPIC' não encontrado"
        log_info "Criando topic..."
        gcloud pubsub topics create $PUBSUB_TOPIC --project=$PROJECT_ID
        log_success "Topic criado"
    fi

    # Verificar subscription existe
    log_info "Verificando Pub/Sub subscription..."
    SUBSCRIPTION_NAME="${PUBSUB_TOPIC}-sub"
    if gcloud pubsub subscriptions describe $SUBSCRIPTION_NAME --project=$PROJECT_ID &>/dev/null; then
        log_success "Pub/Sub subscription '$SUBSCRIPTION_NAME' existe"
    else
        log_info "Criando subscription..."
        gcloud pubsub subscriptions create $SUBSCRIPTION_NAME \
            --topic=$PUBSUB_TOPIC \
            --project=$PROJECT_ID
        log_success "Subscription criada"
    fi

    # Deploy da Cloud Function com trigger Pub/Sub
    log_info "Deployando Cloud Function com trigger Pub/Sub..."

    cd functions/notification-dispatcher

    gcloud functions deploy $FUNCTION_NAME \
        --runtime=$RUNTIME \
        --trigger-topic=$PUBSUB_TOPIC \
        --entry-point=notificationDispatcher \
        --memory=$MEMORY \
        --timeout=$TIMEOUT \
        --region=$REGION \
        --project=$PROJECT_ID \
        --set-env-vars=SUPABASE_URL=$SUPABASE_URL,SUPABASE_KEY=$SUPABASE_KEY,SENDGRID_API_KEY=$SENDGRID_API_KEY \
        --quiet 2>&1 | tee /tmp/cf-deploy.log

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log_success "Cloud Function deployada com sucesso!"
    else
        log_error "Falha no deploy da Cloud Function"
        exit 1
    fi

    cd ../..

    # Verificar status
    log_info "Verificando status..."
    gcloud functions describe $FUNCTION_NAME \
        --region=$REGION \
        --project=$PROJECT_ID \
        --format="table(name, status, trigger)" 2>&1 | tail -2

    log_success "Deploy completo!"
    echo ""
    echo "Próximos passos:"
    echo "1. Aplicar migrations no Supabase:"
    echo "   psql \$DATABASE_URL < migrations/016_notifications_system.sql"
    echo ""
    echo "2. Fazer deploy do SaaS:"
    echo "   make deploy-prod"
    echo ""
    echo "3. Testar fluxo end-to-end:"
    echo "   - Criar campanha"
    echo "   - Verificar Pub/Sub topic para eventos"
    echo "   - Confirmar emails no SendGrid"
}

# Executar
check_env_vars
main
