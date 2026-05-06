#!/bin/bash
# Setup do Supabase CLI e aplicação do schema

set -e

echo "🔧 Configurando Supabase..."

# Verificar se supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "📦 Instalando Supabase CLI..."
    
    # macOS (Homebrew)
    if command -v brew &> /dev/null; then
        brew install supabase/tap/supabase
    else
        # Linux/macOS via script
        curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
    fi
fi

echo "✅ Supabase CLI instalado: $(supabase --version)"

# Linkar ao projeto remoto
echo "🔗 Linkando ao projeto: axrwlboyowoskdxeogba"
supabase link --project-ref axrwlboyowoskdxeogba

# Aplicar migrations
echo "📤 Aplicando schema..."
supabase db push

echo "✅ Setup completo!"
echo ""
echo "📋 PRÓXIMO PASSO: Execute no SQL Editor do Supabase:"
echo "   1. Acesse: https://app.supabase.com/project/axrwlboyowoskdxeogba"
echo "   2. Vá em 'SQL Editor' → 'New query'"
echo "   3. Cole o conteúdo de: supabase-setup.sql"
echo "   4. Clique em 'Run'"
