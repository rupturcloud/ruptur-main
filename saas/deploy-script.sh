#!/bin/bash
# Deploy Script — Phase 1 + Phase 2 Início
# Execuções na VPS GCP: 34.176.34.240
# Data: 2026-05-08

set -e

echo "🚀 Iniciando deployment..."
echo "===================================="

# 1. Navegue para o diretório
cd /opt/ruptur/saas
echo "✅ Diretório: $(pwd)"

# 2. Fazer pull da nova imagem
echo ""
echo "📦 Fazendo pull da imagem do GCP..."
docker-compose pull
echo "✅ Pull completo"

# 3. Parar containers antigos (se existirem)
echo ""
echo "🛑 Parando containers antigos..."
docker-compose down || true
echo "✅ Containers parados"

# 4. Iniciar containers novos
echo ""
echo "🚀 Iniciando novos containers..."
docker-compose up -d
echo "✅ Containers iniciados"

# 5. Aguardar 5 segundos para container estabilizar
echo ""
echo "⏳ Aguardando container estabilizar..."
sleep 5

# 6. Verificar logs
echo ""
echo "📋 Logs do container saas-web:"
echo "===================================="
docker-compose logs saas-web | tail -20
echo "===================================="

# 7. Health check
echo ""
echo "🏥 Executando health check..."
HEALTH=$(curl -s http://localhost:3001/api/health || echo '{"error": "timeout"}')
echo "Resposta: $HEALTH"

if echo "$HEALTH" | grep -q '"ok":true'; then
  echo "✅ Health check OK!"
else
  echo "⚠️  Health check falhou. Verifique logs acima."
  exit 1
fi

# 8. Verificar containers
echo ""
echo "📊 Status dos containers:"
docker-compose ps

echo ""
echo "✅ DEPLOYMENT COMPLETO!"
echo ""
echo "🌐 Endpoints disponíveis:"
echo "  - https://saas.ruptur.cloud"
echo "  - https://saas.ruptur.cloud/api/health"
echo ""
echo "🧪 Para smoke tests, consulte: DEPLOYMENT_INSTRUCTIONS.md"
