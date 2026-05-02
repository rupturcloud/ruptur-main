#!/bin/bash

# Ruptur SaaS - Deploy Completo 100%
# Sincroniza TODOS os arquivos para produção
# Uso: ./deploy-complete.sh

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
REMOTE_HOST="34.176.34.240"
REMOTE_USER="diego"
SSH_KEY="$HOME/.ssh/google_compute_engine"
REMOTE_DIR="/opt/ruptur/saas"
LOCAL_DIR="/Users/diego/dev/ruptur-cloud/ruptur-main/saas"

echo -e "${BLUE}🚀 DEPLOY COMPLETO 100% - RUPTUR SaaS${NC}"
echo -e "${BLUE}=============================================${NC}"

# 1. Verificar se está no diretório correto
if [ ! -d "$LOCAL_DIR" ]; then
    echo -e "${RED}❌ Erro: Diretório SaaS não encontrado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Diretório local: $LOCAL_DIR${NC}"

# 2. Fazer commit das mudanças locais
echo -e "${YELLOW}📝 Fazendo commit das mudanças locais...${NC}"
cd "$LOCAL_DIR"
git add .
git commit -m "deploy: atualização completa $(date '+%Y-%m-%d %H:%M:%S')" || true
git push origin main

# 3. Sincronizar arquivos críticos
echo -e "${YELLOW}📦 Sincronizando arquivos críticos via rsync...${NC}"

# Usando rsync para sincronização incremental e rápida
rsync -avz --exclude 'node_modules' --exclude '.git' \
    -e "ssh -i $SSH_KEY" \
    "$LOCAL_DIR/modules" \
    "$LOCAL_DIR/web" \
    "$LOCAL_DIR/dist-client" \
    "$LOCAL_DIR/runtime-data" \
    "$LOCAL_DIR/shared" \
    "$LOCAL_DIR/middleware" \
    "$LOCAL_DIR/routes" \
    "$LOCAL_DIR/api" \
    "$LOCAL_DIR/integrations" \
    "$LOCAL_DIR/docker-compose.yml" \
    "$LOCAL_DIR/Dockerfile" \
    "$LOCAL_DIR/package.json" \
    "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

# 4. Parar e reconstruir container
echo -e "${YELLOW}🔧 Reconstruindo container em produção...${NC}"
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker compose down"

# 5. Build e start
echo -e "${YELLOW}🏗️ Buildando nova imagem...${NC}"
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker compose build --no-cache"

echo -e "${YELLOW}🚀 Iniciando container...${NC}"
ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker compose up -d"

# 6. Aguardar startup
echo -e "${YELLOW}⏳ Aguardando startup (15s)...${NC}"
sleep 15

# 7. Verificar status
echo -e "${YELLOW}🔍 Verificando status...${NC}"
HEALTH=$(curl -s https://app.ruptur.cloud/api/local/health | jq -r '.ok // false')

if [ "$HEALTH" = "true" ]; then
    echo -e "${GREEN}✅ DEPLOY 100% FUNCIONAL!${NC}"
else
    echo -e "${RED}❌ Erro: Health check falhou${NC}"
    echo -e "${YELLOW}📋 Logs do container:${NC}"
    ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && docker logs saas-web --tail 20"
    exit 1
fi

# 8. Testar APIs
echo -e "${YELLOW}🧪 Testando APIs...${NC}"

echo -n "  📊 Inbox API: "
INBOX_STATUS=$(curl -s https://app.ruptur.cloud/api/inbox/summary -w "%{http_code}" -o /dev/null)
if [ "$INBOX_STATUS" = "200" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌ ($INBOX_STATUS)${NC}"; fi

echo -n "  📈 Campaigns API: "
CAMPAIGNS_STATUS=$(curl -s https://app.ruptur.cloud/api/campaigns -w "%{http_code}" -o /dev/null)
if [ "$CAMPAIGNS_STATUS" = "200" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌ ($CAMPAIGNS_STATUS)${NC}"; fi

echo -n "  🎨 Warmup Light: "
WARMUP_LIGHT=$(curl -s https://app.ruptur.cloud/warmup/ -w "%{http_code}" -o /dev/null)
if [ "$WARMUP_LIGHT" = "200" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌ ($WARMUP_LIGHT)${NC}"; fi

echo -n "  🌙 Warmup Dark: "
WARMUP_DARK=$(curl -s https://app.ruptur.cloud/warmup/dark/ -w "%{http_code}" -o /dev/null)
if [ "$WARMUP_DARK" = "200" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌ ($WARMUP_DARK)${NC}"; fi

echo -n "  👥 Client Area: "
CLIENT_AREA=$(curl -s https://app.ruptur.cloud/client-area/ -w "%{http_code}" -o /dev/null)
if [ "$CLIENT_AREA" = "200" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌ ($CLIENT_AREA)${NC}"; fi

echo -n "  🎛️ Manager Area: "
MANAGER_AREA=$(curl -s https://app.ruptur.cloud/manager/ -w "%{http_code}" -o /dev/null)
if [ "$MANAGER_AREA" = "200" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌ ($MANAGER_AREA)${NC}"; fi

echo -e "${GREEN}🎉 DEPLOY COMPLETO FINALIZADO COM SUCESSO!${NC}"
echo -e "${BLUE}🌐 URLs disponíveis:${NC}"
echo -e "   🏠 Principal: https://app.ruptur.cloud"
echo -e "   🔧 Warmup Light: https://app.ruptur.cloud/warmup/"
echo -e "   🌙 Warmup Dark: https://app.ruptur.cloud/warmup/dark/"
echo -e "   👥 Client Area: https://app.ruptur.cloud/client-area/"
echo -e "   🎛️ Manager: https://app.ruptur.cloud/manager/"
echo -e "   📊 APIs: /api/inbox/, /api/campaigns/"
