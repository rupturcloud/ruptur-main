#!/bin/bash
# 🧪 Ruptur Cloud - Smoke Test Suite
# Valida todas as rotas e temas antes/depois do deploy

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuração
BASE_URL="${1:-http://localhost:4173}"
FAILED=0
PASSED=0

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}🚀 Ruptur Cloud - Smoke Test Suite${NC}"
echo -e "${BLUE}URL: $BASE_URL${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# Função para testar endpoint
test_endpoint() {
    local path=$1
    local expected_code=${2:-200}
    local description=$3
    
    local url="${BASE_URL}${path}"
    local response_code
    
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>&1 || echo "000")
    
    if [ "$response_code" = "$expected_code" ]; then
        echo -e "${GREEN}✅${NC} $description (${response_code})"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} $description (esperado: ${expected_code}, recebido: ${response_code})"
        ((FAILED++))
    fi
}

# Função para testar conteúdo
test_content() {
    local path=$1
    local expected_content=$2
    local description=$3
    
    local url="${BASE_URL}${path}"
    
    if curl -s "$url" 2>/dev/null | grep -q "$expected_content"; then
        echo -e "${GREEN}✅${NC} $description"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} $description (conteúdo não encontrado)"
        ((FAILED++))
    fi
}

echo -e "${YELLOW}🔍 Testando Health Checks...${NC}"
test_endpoint "/api/local/health" 200 "API Health Check"

echo ""
echo -e "${YELLOW}🔍 Testando Warmup Manager...${NC}"
test_endpoint "/warmup/" 200 "Warmup Manager (Light)"
test_endpoint "/warmup/dark/" 200 "Warmup Manager (Dark)"
test_content "/warmup/dark/" "client-area-dark.css" "Dark theme CSS carregado"

echo ""
echo -e "${YELLOW}🔍 Testando APIs de Módulos...${NC}"
test_endpoint "/api/inbox/" 200 "Inbox API"
test_endpoint "/api/campaigns/" 200 "Campaigns API"

echo ""
echo -e "${YELLOW}🔍 Testando Assets...${NC}"
test_endpoint "/warmup/assets/client-area-dark.css" 200 "Dark Theme CSS"
test_endpoint "/warmup/assets/index-CPyaI1ei.css" 200 "Base CSS"

echo ""
echo -e "${YELLOW}🔍 Testando Integração (se houver auth)...${NC}"
test_endpoint "/api/local/app/config" 200 "App Config"

echo ""
echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}📊 RESULTADOS${NC}"
echo -e "${BLUE}=======================================${NC}"
echo -e "${GREEN}✅ Passaram: $PASSED${NC}"
echo -e "${RED}❌ Falharam: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Todos os smoke tests passaram!${NC}"
    echo -e "${GREEN}Pronto para deploy em produção.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Alguns smoke tests falharam.${NC}"
    echo -e "${RED}Corrija antes de fazer deploy.${NC}"
    exit 1
fi
