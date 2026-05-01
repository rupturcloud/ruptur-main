#!/bin/bash

# Setup de Segurança - Ruptur SaaS
# Este script configura Google OAuth, JWT e Supabase para produção

set -e

echo "🔐 Setup de Segurança - Ruptur SaaS"
echo "===================================="
echo ""

# 1. Gerar JWT Secret
echo "1️⃣  Gerando JWT Secret..."
JWT_SECRET=$(openssl rand -base64 32)
echo "✅ JWT_SECRET gerado:"
echo "   $JWT_SECRET"
echo ""
echo "📝 Adicione ao seu .env:"
echo "   JWT_SECRET=$JWT_SECRET"
echo ""

# 2. Verificar Google OAuth
echo "2️⃣  Configuração Google OAuth"
if [ -z "$GOOGLE_CLIENT_ID" ]; then
  echo "⚠️  GOOGLE_CLIENT_ID não configurado"
  echo "   Vá em: https://console.cloud.google.com/"
  echo "   1. Crie um projeto (ou use existente)"
  echo "   2. APIs & Services > Credentials"
  echo "   3. Create OAuth 2.0 Credentials (Web)"
  echo "   4. Adicione URIs autorizados:"
  echo "      - http://localhost:8787"
  echo "      - https://app.ruptur.cloud"
else
  echo "✅ GOOGLE_CLIENT_ID já configurado"
fi
echo ""

# 3. Verificar Supabase
echo "3️⃣  Configuração Supabase"
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_PUBLISHABLE_KEY" ]; then
  echo "⚠️  Supabase não configurado"
  echo "   1. Acesse https://supabase.com"
  echo "   2. Crie um novo projeto"
  echo "   3. Copie URL e anon key pra .env"
else
  echo "✅ Supabase já configurado"
  echo "   Executando migrations..."

  # TODO: executar migrations automaticamente
  echo "   ⚠️  Execute manualmente em Supabase SQL Editor:"
  echo "   cat migrations/001_instance_registry.sql"
fi
echo ""

# 4. Checklist
echo "4️⃣  Checklist de Produção"
echo "   [ ] JWT_SECRET adicionado ao .env"
echo "   [ ] GOOGLE_CLIENT_ID/SECRET adicionados ao .env"
echo "   [ ] Supabase migrations rodadas"
echo "   [ ] CORS_ORIGIN = seu domínio (não *)"
echo "   [ ] ENABLE_DEV_MODE = false"
echo "   [ ] NODE_ENV = production"
echo "   [ ] TLS/HTTPS configurado"
echo ""

# 5. Testar Dev Mode
if [ "$ENABLE_DEV_MODE" = "true" ]; then
  echo "5️⃣  Dev Mode Ativado - Testando..."
  echo ""
  echo "   Teste estas rotas (devem funcionar sem auth):"
  echo "   - GET http://localhost:8787/dev/status"
  echo "   - GET http://localhost:8787/dev/mock/token"
  echo "   - GET http://localhost:8787/dev/mock/instances"
  echo ""
fi

echo "✨ Setup concluído!"
echo ""
echo "Próximos passos:"
echo "1. Configure JWT_SECRET, Google OAuth, Supabase"
echo "2. Execute: STANDALONE=true node modules/warmup-core/server-secured.mjs"
echo "3. Teste login em /auth/google"
echo "4. Leia SETUP-SECURITY.md para detalhes completos"
