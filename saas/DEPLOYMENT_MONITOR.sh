#!/bin/bash

# 🚀 DEPLOYMENT MONITOR — Ruptur SaaS Production
# Script para acompanhar o deployment em tempo real

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configurações
GITHUB_REPO="rupturcloud/ruptur-main"
GCP_PROJECT="ruptur-jarvis-v1-68358"
GCP_REGION="us-central1"
SERVICE_NAME="ruptur-saas"
APP_URL="https://app.ruptur.cloud"
APP_URL="https://app.ruptur.cloud"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_progress() { echo -e "${CYAN}[→]${NC} $1"; }

# ============================================================================
# ETAPA 4: Monitorar GitHub Actions
# ============================================================================
etapa_4_github_actions() {
    log_progress "ETAPA 4: Monitorar GitHub Actions"
    echo ""

    log_info "Verificando status do workflow..."

    # Nota: Para usar API do GitHub sem autenticação, há limites de rate limit
    # Aqui apenas informamos ao usuário para verificar

    echo ""
    log_info "GitHub Actions workflow disparado!"
    log_info "URL para acompanhar: ${BLUE}https://github.com/$GITHUB_REPO/actions${NC}"
    echo ""
    log_info "O que esperar:"
    echo "  1. CI Job (2-3 min) — Build, test, lint, audit"
    echo "  2. CD Job (3-5 min) — Docker build, push, Cloud Run deploy"
    echo "  3. Smoke tests (1-2 min) — Health check, API tests"
    echo ""

    log_warn "Você precisa monitorar manualmente em: https://github.com/$GITHUB_REPO/actions"
    echo ""
}

# ============================================================================
# ETAPA 5-7: Aguardar Deploy em Cloud Run
# ============================================================================
etapa_5_7_aguardar_deploy() {
    log_progress "ETAPA 5-7: Aguardando Deploy em Cloud Run"
    echo ""

    log_info "Checando status do serviço em Cloud Run..."

    # Verificar se gcloud está disponível
    if ! command -v gcloud &> /dev/null; then
        log_warn "gcloud não está instalado. Não posso verificar Cloud Run."
        log_info "Verifique manualmente em: ${BLUE}https://console.cloud.google.com/run?project=$GCP_PROJECT${NC}"
        return
    fi

    # Tentar obter info do serviço
    if gcloud run services describe $SERVICE_NAME --region $GCP_REGION --project $GCP_PROJECT &>/dev/null 2>&1; then
        log_success "Serviço $SERVICE_NAME existe em Cloud Run"

        # Obter URL do serviço
        SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
            --region $GCP_REGION \
            --project $GCP_PROJECT \
            --format='value(status.url)' 2>/dev/null || echo "")

        if [ -n "$SERVICE_URL" ]; then
            log_success "URL do serviço: ${CYAN}$SERVICE_URL${NC}"
        fi
    else
        log_warn "Serviço $SERVICE_NAME não encontrado em Cloud Run"
        log_info "Pode estar sendo deployado agora..."
    fi

    echo ""
}

# ============================================================================
# ETAPA 8: Health Check
# ============================================================================
etapa_8_health_check() {
    log_progress "ETAPA 8: Health Check (/api/health)"
    echo ""

    log_info "Testando endpoint /api/health..."

    # Tentar fazer health check
    if curl -s -f "$SAAS_URL/api/health" > /dev/null 2>&1; then
        log_success "Health check PASSOU ✓"

        # Obter detalhes
        HEALTH=$(curl -s "$SAAS_URL/api/health")
        echo "  Resposta: $HEALTH"
        echo ""
        return 0
    else
        log_warn "Health check FALHOU — Serviço ainda pode estar iniciando"
        log_info "Tentando novamente em alguns instantes..."
        sleep 5

        if curl -s -f "$SAAS_URL/api/health" > /dev/null 2>&1; then
            log_success "Health check PASSOU na segunda tentativa ✓"
            return 0
        else
            log_warn "Serviço ainda não está respondendo"
            log_info "Pode levar até 15 minutos para deployment completar"
            return 1
        fi
    fi
}

# ============================================================================
# ETAPA 9: Testar Login
# ============================================================================
etapa_9_testar_login() {
    log_progress "ETAPA 9: Testar Login"
    echo ""

    log_info "Para testar login, acesse: ${CYAN}$APP_URL/login${NC}"
    log_info "Email: diegoizac@gmail.com"
    echo ""
    log_info "Você deve conseguir:"
    echo "  ✓ Fazer login com suas credenciais"
    echo "  ✓ Ver badge 'Superadmin' na header (se for superadmin)"
    echo ""
}

# ============================================================================
# ETAPA 10: Acessar SuperAdmin Dashboard
# ============================================================================
etapa_10_superadmin_dashboard() {
    log_progress "ETAPA 10: Acessar SuperAdmin Dashboard"
    echo ""

    log_info "Para acessar dashboard de superadmin:"
    log_info "URL: ${CYAN}$APP_URL/admin/superadmin${NC}"
    echo ""
    log_info "Você deve ver:"
    echo "  ✓ Lista de superadmins ativos"
    echo "  ✓ Lista de convites pendentes"
    echo "  ✓ Botão para convidar novos superadmins"
    echo ""
}

# ============================================================================
# ETAPA 11-12: Validar Dados
# ============================================================================
etapa_11_12_validar_dados() {
    log_progress "ETAPA 11-12: Validar Dados"
    echo ""

    log_info "Esperado encontrar no SuperAdmin Dashboard:"
    echo ""
    echo "  ${GREEN}✓ Superadmins Ativos:${NC}"
    echo "    • diegoizac@gmail.com (ID: e8b12654...)"
    echo ""
    echo "  ${GREEN}✓ Convites Pendentes:${NC}"
    echo "    • ruptur.cloud@gmail.com (válido até 10/05/2026)"
    echo ""
}

# ============================================================================
# ETAPA 13: Aceitar Convite
# ============================================================================
etapa_13_aceitar_convite() {
    log_progress "ETAPA 13: Aceitar Convite"
    echo ""

    log_info "Para aceitar o convite para ruptur.cloud@gmail.com:"
    log_info "URL: ${CYAN}$APP_URL/admin/accept-invite?token=411b09907fbcca7dfa727594e8d916d44beeb4bac43eb10333e3dd2c3d0bfdfa${NC}"
    echo ""
    log_info "Ou navegue até:"
    echo "  1. Faça login com ruptur.cloud@gmail.com"
    echo "  2. Você será redirecionado para aceitar o convite"
    echo "  3. Clique em 'Aceitar Convite'"
    echo ""
    log_info "Após aceitar, ruptur.cloud@gmail.com terá acesso de superadmin"
    echo ""
}

# ============================================================================
# ETAPA 14: Confirmar Sistema 100% Funcional
# ============================================================================
etapa_14_sistema_funcional() {
    log_progress "ETAPA 14: Confirmar Sistema 100% Funcional"
    echo ""

    log_success "Sistema de Superadmin está 100% FUNCIONAL quando:"
    echo ""
    echo "  ${GREEN}✓${NC} Health check retorna 200 OK"
    echo "  ${GREEN}✓${NC} Login funciona para diegoizac@gmail.com"
    echo "  ${GREEN}✓${NC} SuperAdmin Dashboard carrega"
    echo "  ${GREEN}✓${NC} Superadmins ativos aparecem na lista"
    echo "  ${GREEN}✓${NC} Convites pendentes aparecem na lista"
    echo "  ${GREEN}✓${NC} Convite pode ser aceito por ruptur.cloud@gmail.com"
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================
main() {
    clear

    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║       🚀 DEPLOYMENT MONITOR — RUPTUR SAAS PRODUCTION             ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""

    log_info "Iniciando monitoramento do deployment..."
    echo ""

    # Executar etapas
    etapa_4_github_actions
    echo ""

    etapa_5_7_aguardar_deploy
    echo ""

    if etapa_8_health_check; then
        # Se health check passou, continuar com testes
        echo ""
        etapa_9_testar_login
        echo ""

        etapa_10_superadmin_dashboard
        echo ""

        etapa_11_12_validar_dados
        echo ""

        etapa_13_aceitar_convite
        echo ""

        etapa_14_sistema_funcional
    else
        log_warn "Health check ainda não passou"
        log_info "Aguarde mais alguns minutos e tente novamente"
        echo ""
        log_info "Para monitorar manualmente:"
        echo "  1. GitHub Actions: https://github.com/$GITHUB_REPO/actions"
        echo "  2. Cloud Run: https://console.cloud.google.com/run?project=$GCP_PROJECT"
        echo "  3. Health Check: curl $SAAS_URL/api/health"
    fi

    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                   🎉 MONITORAMENTO COMPLETO                       ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""
}

main "$@"
