#!/bin/bash
# 🔧 Script para remover redirect do saas.ruptur.cloud no Cloudflare
# Execute manualmente no seu terminal

set -e

# Credenciais - preencha antes de executar
CF_EMAIL="ruptur.cloud@gmail.com"
CF_API_KEY="COLE_SUA_GLOBAL_API_KEY_AQUI"
ZONE_ID="227b5a55cb0351ee3c1ca6b533d3cbfb"

echo "🔍 Listando Page Rules..."
RULES=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/pagerules" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" \
  -H "Content-Type: application/json")

echo "$RULES" | jq -r '.result[] | "ID: \(.id) | URL: \(.targets[0].constraint.value) | Actions: \(.actions[].id)"' 2>/dev/null || echo "$RULES" | jq .

echo ""
echo "⚠️  Se encontrar uma regra com 'saas.ruptur.cloud' fazendo redirect:"
echo "   1. Copie o ID da regra"
echo "   2. Execute:"
echo "   curl -X DELETE \"https://api.cloudflare.com/client/v4/zones/$ZONE_ID/pagerules/ID_DA_REGRA\" \\"
echo "     -H \"X-Auth-Email: $CF_EMAIL\" \\"
echo "     -H \"X-Auth-Key: $CF_API_KEY\""
echo ""
echo "🌐 Ou acesse manualmente: https://dash.cloudflare.com"
