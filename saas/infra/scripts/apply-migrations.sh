#!/bin/bash

# Aplica migrations do projeto ao Supabase
# Uso: ./apply-migrations.sh [migration-file]

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

main() {
    local migration_file="${1:-migrations/016_notifications_system.sql}"

    # Validar variáveis de ambiente
    if [ -z "$SUPABASE_URL" ]; then
        log_error "SUPABASE_URL não configurada"
        exit 1
    fi

    if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        log_error "SUPABASE_SERVICE_ROLE_KEY não configurada"
        exit 1
    fi

    # Validar arquivo de migration
    if [ ! -f "$migration_file" ]; then
        log_error "Arquivo de migration não encontrado: $migration_file"
        exit 1
    fi

    log_info "Aplicando migration: $migration_file"
    log_info "Supabase URL: $SUPABASE_URL"

    # Extrair URL de conexão do Supabase
    # SUPABASE_URL é algo como: https://xxxxx.supabase.co
    # Precisamos de: postgresql://postgres:password@xxxxx.supabase.co:5432/postgres

    if command -v psql &> /dev/null; then
        log_info "psql disponível, aplicando via psql..."

        # Para usar psql, precisaríamos da password do postgres
        # Vamos usar a abordagem via API Supabase em vez disso

        log_warning "psql detectado mas não configurado"
        log_info "Use a dashboard do Supabase para aplicar manualmente:"
        log_info "1. Acesse: $SUPABASE_URL/project/sql"
        log_info "2. Copie o conteúdo de $migration_file"
        log_info "3. Cole na aba SQL e execute"
        exit 0
    fi

    # Alternativa: usar curl para fazer a requisição via API
    log_info "Aplicando migration via Supabase API..."

    # Ler arquivo de migration
    migration_sql=$(cat "$migration_file")

    # Criar payload
    payload=$(cat <<EOF
{
  "query": "$(echo "$migration_sql" | sed 's/"/\\"/g' | tr '\n' ' ')"
}
EOF
    )

    # Fazer requisição
    response=$(curl -s -X POST \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$SUPABASE_URL/rest/v1/rpc/exec_sql" 2>&1 || true)

    if echo "$response" | grep -q "error\|Error"; then
        log_error "Erro ao aplicar migration:"
        echo "$response" | jq . 2>/dev/null || echo "$response"

        log_info ""
        log_warning "Para aplicar manualmente via Supabase Dashboard:"
        log_info "1. Acesse: $SUPABASE_URL/project/sql"
        log_info "2. Copie todo o conteúdo de: $migration_file"
        log_info "3. Cole na aba SQL Editor"
        log_info "4. Execute (Ctrl+Enter)"
        exit 1
    else
        log_success "Migration aplicada com sucesso!"
        echo "$response" | jq . 2>/dev/null || echo "$response"
    fi
}

# Verificar se estamos na pasta certa
if [ ! -d "migrations" ]; then
    log_error "Pasta 'migrations' não encontrada"
    echo "Execute o script da raiz da pasta saas/"
    exit 1
fi

main "$@"
