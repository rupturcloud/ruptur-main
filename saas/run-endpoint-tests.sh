#!/bin/bash

# Script para executar testes dos endpoints
# 1. Inicia servidor seguro
# 2. Aguarda servidor ficar pronto
# 3. Executa testes de endpoints
# 4. Limpa (mata servidor)

set -e

# Cores
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

HOST="http://localhost:8787"
MAX_RETRIES=30

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 Iniciando testes de endpoints${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Carrega .env.test
if [ -f .env.test ]; then
  export $(cat .env.test | grep -v '#' | xargs)
  echo -e "${GREEN}✅ .env.test carregado${NC}"
else
  echo -e "${RED}❌ .env.test não encontrado${NC}"
  exit 1
fi
echo ""

# Mata servidor anterior
pkill -f "node modules/warmup-core/server-secured.mjs" || true
sleep 1

# Inicia servidor
echo -e "${YELLOW}🔧 Iniciando servidor...${NC}"
node modules/warmup-core/server-secured.mjs > /tmp/server.log 2>&1 &
SERVER_PID=$!
echo "PID: $SERVER_PID"
echo ""

# Aguarda servidor
echo -e "${YELLOW}⏳ Aguardando servidor ficar pronto...${NC}"
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_RETRIES ]; do
  if curl -s "$HOST/api/local/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servidor pronto${NC}"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Servidor não respondeu${NC}"
    tail -20 /tmp/server.log
    kill $SERVER_PID || true
    exit 1
  fi
  echo -n "."
  sleep 1
done
echo ""
echo ""

# Executa testes
echo -e "${YELLOW}🧪 Executando testes de endpoints...${NC}"
echo ""

if node test-endpoints.js; then
  TEST_RESULT=0
else
  TEST_RESULT=1
fi

echo ""

# Limpa
echo -e "${YELLOW}🧹 Limpando...${NC}"
kill $SERVER_PID || true
sleep 1
if ps -p $SERVER_PID > /dev/null 2>&1; then
  kill -9 $SERVER_PID || true
fi

echo -e "${GREEN}✅ Servidor finalizado${NC}"
echo ""

# Resumo
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ TESTES PASSARAM${NC}"
else
  echo -e "${RED}❌ TESTES FALHARAM${NC}"
  echo "Log do servidor:"
  tail -30 /tmp/server.log
fi

echo ""

exit $TEST_RESULT
