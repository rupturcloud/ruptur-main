# Husky Pre-commit Hooks

## Configuração Inicial

Execute uma vez no seu computador:

```bash
npm install
npx husky install
chmod +x .husky/pre-commit
```

## O Que Faz

Antes de cada `git commit`, valida:

1. **Lint** - Verifica sintaxe e estilo do código
2. **Testes** - Executa testes unitários (rápido, sem paralelismo)

Se qualquer uma falhar:
- ❌ Commit é bloqueado
- ✅ Mensagem de erro é mostrada
- ✅ Você pode corrigir e tentar novamente

## Exemplo

```bash
$ git commit -m "Add new feature"
🔍 Pre-commit validation...
📋 Executando lint...
✅ Lint OK
🧪 Executando testes unitários...
✅ Testes OK
✅ Pre-commit validation passed!
[main abc1234] Add new feature
 1 file changed, 10 insertions(+)
```

## Se Algo der Errado

### Lint falha

```bash
npm run lint
# Corrige automaticamente:
npm run lint -- --fix
```

### Testes falham

```bash
npm test
# Debugar teste específico:
npm test -- --testNamePattern="seu teste"
```

### Desabilitar hooks temporariamente (não recomendado!)

```bash
git commit --no-verify
```

**⚠️ AVISO**: Usar `--no-verify` **BURLARÁ** a validação local. Use apenas em emergências.

---

**Mais informações**: Veja `docs/CI-CD-PIPELINE.md`
