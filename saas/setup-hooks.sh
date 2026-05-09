#!/bin/bash

# Setup script para Husky pre-commit hooks
# Executar uma vez: ./setup-hooks.sh

set -e

echo "🔧 Configurando Husky pre-commit hooks..."
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 20+ e tente novamente."
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"

# Instalar dependências
echo ""
echo "📦 Instalando dependências..."
npm install

# Instalar Husky
echo ""
echo "🪝 Instalando Husky..."
npx husky install

# Fazer hook executável
echo ""
echo "📝 Tornando hook executável..."
chmod +x .husky/pre-commit

echo ""
echo "✅ Setup completo!"
echo ""
echo "Próximas vezes que fizer commit:"
echo "  - Lint será validado automaticamente"
echo "  - Testes serão executados automaticamente"
echo "  - Se algo falhar, o commit será bloqueado"
echo ""
echo "Teste agora:"
echo "  git commit --allow-empty -m 'Test commit'"
echo ""
