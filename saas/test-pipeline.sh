#!/bin/bash

# Script para testar o pipeline de CI/CD localmente
# Simula o que GitHub Actions fará

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[TEST]${NC} $1"; }
log_success() { echo -e "${GREEN}[TEST]${NC} $1"; }
log_error() { echo -e "${RED}[TEST]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[TEST]${NC} $1"; }

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Ruptur SaaS - Local Pipeline Test                    ║${NC}"
echo -e "${BLUE}║   Simula exatamente o que GitHub Actions fará          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Install
log_info "Step 1/8: Instalando dependências..."
if npm ci > /dev/null 2>&1; then
    log_success "npm ci OK"
else
    log_error "npm ci FALHOU"
    exit 1
fi

# Step 2: Client area
log_info "Step 2/8: Instalando web/client-area..."
if npm --prefix web/client-area ci > /dev/null 2>&1; then
    log_success "Client area OK"
else
    log_warning "Client area falhou (ignorando)"
fi

# Step 3: Lint
log_info "Step 3/8: Lint..."
if npm run lint > /dev/null 2>&1; then
    log_success "Lint OK"
else
    log_error "Lint FALHOU"
    log_info "Execute: npm run lint"
    exit 1
fi

# Step 4: Tests
log_info "Step 4/8: Testes unitários..."
if npm test -- --runInBand > /dev/null 2>&1; then
    log_success "Testes OK"
else
    log_error "Testes FALHARAM"
    log_info "Execute: npm test -- --runInBand"
    exit 1
fi

# Step 5: Coverage
log_info "Step 5/8: Coverage report..."
if npm run test:coverage > /dev/null 2>&1; then
    log_success "Coverage OK"
    log_info "Relatório em: coverage/lcov-report/index.html"
else
    log_warning "Coverage falhou (não crítico)"
fi

# Step 6: Review
log_info "Step 6/8: Review checklist..."
if npm run review > /dev/null 2>&1; then
    log_success "Review OK"
else
    log_warning "Review falhou (não crítico)"
fi

# Step 7: Quality
log_info "Step 7/8: Quality gate..."
if npm run quality > /dev/null 2>&1; then
    log_success "Quality gate OK"
else
    log_error "Quality gate FALHOU"
    log_info "Execute: npm run quality"
    exit 1
fi

# Step 8: Security
log_info "Step 8/8: Security audit..."
if npm audit --audit-level moderate > /dev/null 2>&1; then
    log_success "Security audit OK"
else
    log_error "Security vulnerabilities encontradas!"
    log_info "Execute: npm audit"
    exit 1
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ TODOS OS TESTES PASSARAM!                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Próximos passos:"
echo "  1. Fazer commit: git commit -m '...'"
echo "  2. Fazer push: git push origin seu-branch"
echo "  3. GitHub Actions rodará os mesmos testes"
echo "  4. Se OK, deploy automático em produção"
echo ""
echo "Tempo estimado:"
echo "  - Local: ${YELLOW}~10 minutos${NC}"
echo "  - GitHub Actions: ${YELLOW}~15-20 minutos${NC}"
echo "  - Deploy: ${YELLOW}~5-10 minutos${NC}"
echo ""
