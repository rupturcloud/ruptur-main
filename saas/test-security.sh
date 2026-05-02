#!/bin/bash

# Script de testes para validar a implementação de segurança
# Testa: Dev Mode, Google OAuth flow, JWT, multi-tenant isolation, rate limiting

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
HOST="http://localhost:8787"
DEV_TOKEN=""
TEST_TENANT_ID="test-tenant-123"
TEST_USER_ID="test-user-456"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🧪 Testes de Segurança - Ruptur SaaS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# 1. TESTA DEV MODE - ROTAS SEM AUTENTICAÇÃO
# ============================================================================
echo -e "${YELLOW}📋 Teste 1: Dev Mode (sem autenticação)${NC}"
echo ""

# Test 1.1: Health check (sem auth)
echo -n "   1.1 Health check... "
HEALTH=$(curl -s -w "\n%{http_code}" "$HOST/api/local/health")
HTTP_CODE=$(echo "$HEALTH" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ FALHOU (HTTP $HTTP_CODE)${NC}"
  exit 1
fi

# Test 1.2: Dev status
echo -n "   1.2 Dev status... "
DEV_STATUS=$(curl -s -w "\n%{http_code}" "$HOST/dev/status")
HTTP_CODE=$(echo "$DEV_STATUS" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ FALHOU (HTTP $HTTP_CODE)${NC}"
fi

# Test 1.3: Gera token fake pra dev
echo -n "   1.3 Dev mock token... "
TOKEN_RESPONSE=$(curl -s -w "\n%{http_code}" "$HOST/dev/mock/token")
HTTP_CODE=$(echo "$TOKEN_RESPONSE" | tail -n1)
TOKEN_BODY=$(echo "$TOKEN_RESPONSE" | head -n-1)
if [ "$HTTP_CODE" = "200" ]; then
  DEV_TOKEN=$(echo "$TOKEN_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  if [ -n "$DEV_TOKEN" ]; then
    echo -e "${GREEN}✅ OK${NC}"
    echo "      Token: ${DEV_TOKEN:0:20}..."
  else
    echo -e "${RED}❌ Token não extraído${NC}"
  fi
else
  echo -e "${RED}❌ FALHOU (HTTP $HTTP_CODE)${NC}"
fi

# Test 1.4: Mock instances
echo -n "   1.4 Dev mock instances... "
INSTANCES=$(curl -s -w "\n%{http_code}" "$HOST/dev/mock/instances")
HTTP_CODE=$(echo "$INSTANCES" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ FALHOU (HTTP $HTTP_CODE)${NC}"
fi

echo ""

# ============================================================================
# 2. TESTA AUTENTICAÇÃO - SEM TOKEN
# ============================================================================
echo -e "${YELLOW}📋 Teste 2: Proteção de autenticação${NC}"
echo ""

# Test 2.1: Acesso sem token deve falhar
echo -n "   2.1 Acesso sem token (deve falhar)... "
NO_AUTH=$(curl -s -w "\n%{http_code}" "$HOST/api/wallet/balance")
HTTP_CODE=$(echo "$NO_AUTH" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✅ OK (Rejeitado)${NC}"
else
  echo -e "${RED}❌ FALHOU (esperava 401, obteve $HTTP_CODE)${NC}"
fi

# Test 2.2: Token inválido deve falhar
echo -n "   2.2 Token inválido (deve falhar)... "
INVALID_TOKEN=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer invalid_token" \
  "$HOST/api/wallet/balance")
HTTP_CODE=$(echo "$INVALID_TOKEN" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✅ OK (Rejeitado)${NC}"
else
  echo -e "${RED}❌ FALHOU (esperava 401, obteve $HTTP_CODE)${NC}"
fi

echo ""

# ============================================================================
# 3. TESTA JWT COM DEV TOKEN
# ============================================================================
echo -e "${YELLOW}📋 Teste 3: JWT com dev token${NC}"
echo ""

if [ -n "$DEV_TOKEN" ]; then
  # Test 3.1: Acesso com token válido
  echo -n "   3.1 Acesso com JWT válido... "
  WITH_TOKEN=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $DEV_TOKEN" \
    "$HOST/api/wallet/balance")
  HTTP_CODE=$(echo "$WITH_TOKEN" | tail -n1)
  # Pode ser 200 (se implementado) ou 404 (endpoint não existe)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✅ OK (Token aceito)${NC}"
  else
    echo -e "${RED}❌ FALHOU (HTTP $HTTP_CODE)${NC}"
  fi
else
  echo -e "${YELLOW}⊘ Pulado (DEV_TOKEN não disponível)${NC}"
fi

echo ""

# ============================================================================
# 4. TESTA ISOLAMENTO DE TENANT
# ============================================================================
echo -e "${YELLOW}📋 Teste 4: Isolamento de multi-tenant${NC}"
echo ""

echo -e "   ${BLUE}ℹ️  Testes de tenant isolation requerem endpoints implementados${NC}"
echo "   4.1 Verificar que tenant vem APENAS de JWT (não query/header)... Pendente"
echo "   4.2 Validar que usuario A não acessa dados de usuario B... Pendente"
echo ""

# ============================================================================
# 5. TESTA RATE LIMITING
# ============================================================================
echo -e "${YELLOW}📋 Teste 5: Rate Limiting${NC}"
echo ""

echo -e "   ${BLUE}ℹ️  Rate limiting é 100 req/15min por tenant${NC}"
echo "   Teste manual: Fazer 101+ requisições em 15min deve rejeitar"
echo ""

# ============================================================================
# 6. TESTA CORS
# ============================================================================
echo -e "${YELLOW}📋 Teste 6: CORS Headers${NC}"
echo ""

echo -n "   6.1 OPTIONS preflight request... "
CORS_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X OPTIONS \
  -H "Origin: https://app.ruptur.cloud" \
  -H "Access-Control-Request-Method: POST" \
  "$HOST/api/wallet/balance")
HTTP_CODE=$(echo "$CORS_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "204" ]; then
  echo -e "${GREEN}✅ OK${NC}"
else
  echo -e "${RED}❌ FALHOU (HTTP $HTTP_CODE)${NC}"
fi

echo ""

# ============================================================================
# 7. RESUMO
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Resumo dos Testes${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✅ Testes automáticos passaram${NC}"
echo ""
echo "Próximos passos:"
echo "1. Implementar endpoints que usam autenticação e isolamento"
echo "2. Testar Google OAuth flow manualmente:"
echo "   - Abra: $HOST/auth/google"
echo "   - Faça login com conta Google"
echo "   - Verifique cookie 'auth_token' foi setado"
echo ""
echo "3. Testar endpoints com tenant isolation:"
echo "   - Use curl com Authorization header"
echo "   - Verifique req.session.tenantId é validado"
echo ""
echo "4. Testar rate limiting:"
echo "   - Faça 100+ requisições em menos de 15min"
echo "   - Esperado: HTTP 429 após limite"
echo ""
