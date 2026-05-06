#!/bin/bash

# Script para executar testes de segurança
# 1. Inicia servidor seguro
# 2. Aguarda servidor ficar pronto
# 3. Executa testes
# 4. Limpa (mata servidor)

set -e

# Cores
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
HOST="http://localhost:8787"
MAX_RETRIES=30
RETRY_DELAY=1

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 Iniciando testes de segurança${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ========================================================================
# 1. Carrega .env.test
# ========================================================================
echo -e "${YELLOW}📝 Carregando configurações (.env.test)...${NC}"
if [ -f .env.test ]; then
  export $(cat .env.test | grep -v '#' | xargs)
  echo -e "${GREEN}✅ .env.test carregado${NC}"
else
  echo -e "${RED}❌ .env.test não encontrado${NC}"
  exit 1
fi
echo ""

# ========================================================================
# 2. Inicia servidor em background
# ========================================================================
echo -e "${YELLOW}🔧 Iniciando servidor em background...${NC}"

# Mata servidor anterior se estiver rodando
pkill -f "node modules/warmup-core/server-secured.mjs" || true
sleep 1

# Inicia servidor
node modules/warmup-core/server-secured.mjs > /tmp/server.log 2>&1 &
SERVER_PID=$!

echo "   PID: $SERVER_PID"
echo "   Log: /tmp/server.log"
echo ""

# ========================================================================
# 3. Aguarda servidor ficar pronto
# ========================================================================
echo -e "${YELLOW}⏳ Aguardando servidor ficar pronto...${NC}"

ATTEMPT=0
while [ $ATTEMPT -lt $MAX_RETRIES ]; do
  if curl -s "$HOST/api/local/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor pronto em $((ATTEMPT * RETRY_DELAY))s${NC}"
    break
  fi

  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Servidor não respondeu em tempo${NC}"
    echo -e "${RED}Log do servidor:${NC}"
    cat /tmp/server.log
    kill $SERVER_PID || true
    exit 1
  fi

  echo -n "."
  sleep $RETRY_DELAY
done
echo ""
echo ""

# ========================================================================
# 4. Executa testes
# ========================================================================
echo -e "${YELLOW}🧪 Executando testes...${NC}"
echo ""

if node test-security.js; then
  TEST_RESULT=0
  echo -e "${GREEN}✅ Testes executados com sucesso${NC}"
else
  TEST_RESULT=1
  echo -e "${RED}❌ Testes falharam${NC}"
fi

echo ""

# ========================================================================
# 5. Limpa (mata servidor)
# ========================================================================
echo -e "${YELLOW}🧹 Limpando...${NC}"
kill $SERVER_PID || true
sleep 1

if ps -p $SERVER_PID > /dev/null 2>&1; then
  kill -9 $SERVER_PID || true
fi

echo -e "${GREEN}✅ Servidor finalizado${NC}"
echo ""

# ========================================================================
# 6. Resumo
# ========================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ TESTES PASSARAM${NC}"
  echo ""
  echo "Próximas tarefas:"
  echo "1. Implementar endpoints autenticados"
  echo "2. Testar Google OAuth flow manualmente"
  echo "3. Validar tenant isolation com dados reais"
  echo "4. Configurar Getnet credentials"
  echo "5. Testar webhooks"
else
  echo -e "${RED}❌ TESTES FALHARAM${NC}"
  echo ""
  echo "Verifique o log do servidor:"
  echo "  tail -f /tmp/server.log"
  echo ""
  echo "Ou reinicie manualmente:"
  echo "  ENABLE_DEV_MODE=true STANDALONE=true node modules/warmup-core/server-secured.mjs"
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

exit $TEST_RESULT
