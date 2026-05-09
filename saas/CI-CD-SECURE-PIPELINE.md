# 🔒 Ruptur SaaS - CI/CD Secure Pipeline

> **GARANTIA**: Nenhum código quebrado chega a produção. Testes BLOQUEIAM deploy.

## Por Que Isso Importa?

Após o outage do dia 2026-05-08, implementamos um pipeline que **garante**:

- ❌ Testes falhando? Deploy bloqueado.
- ❌ Lint falhando? Deploy bloqueado.
- ❌ Build falhando? Deploy bloqueado.
- ❌ Security vulnerabilities? Deploy bloqueado.

## Como Usar

### Antes de Fazer Push (Sua Responsabilidade)

```bash
# Executar validação local (5-10 minutos)
make ci

# Se tudo passar:
git push origin your-branch
```

**Resultado esperado**:
```
[BLUE] Executando pipeline CI...
[GREEN] Executando lint... OK
[GREEN] Executando testes... OK
[GREEN] Executando quality gate... OK
[GREEN] Gerando cobertura... OK
✅ Toda validação passou! Pronto para push.
```

### O que Acontece Depois (Automático)

1. **GitHub Actions CI** roda os mesmos testes
2. Se **TODOS** passarem → Deploy automático em produção
3. Se **QUALQUER UM** falhar → ❌ BUILD FALHA, Slack notifica

### Tempo de Espera

- **Local** (`make ci`): ~8-12 minutos
- **CI/CD**: ~15-20 minutos
- **Total até produção**: ~25-30 minutos (se tudo OK)

## Comandos Rápidos

### Validação Completa (Recomendado)
```bash
make ci
```

### Validação Parcial
```bash
make ci-lint         # Apenas sintaxe (30s)
make ci-test         # Apenas testes (5 min)
make ci-quality      # Lint + test + build (8 min)
make ci-coverage     # Gera relatório (5 min)
make ci-audit        # Security (2 min)
```

### Depois de Usar
```bash
make ci-coverage    # Ver relatório: open coverage/lcov-report/index.html
```

## Setup Inicial (Uma Vez)

Se você ainda não tem os hooks:

```bash
./setup-hooks.sh
```

Isso configura validação **automática** antes de cada commit:

```bash
$ git commit -m "My change"
🔍 Pre-commit validation...
📋 Executando lint... OK
🧪 Executando testes... OK
✅ Pre-commit validation passed!
[main abc1234] My change
```

## Arquitetura

```
Seu Computador (Local)
└─ make ci (opcional, mas FORTEMENTE RECOMENDADO)
   ├─ npm run lint
   ├─ npm test -- --runInBand
   ├─ npm run quality
   └─ npm run test:coverage
       ↓ Tudo OK? Você faz git push

GitHub Actions (Automático)
├─ Step 1: npm ci (instalar dependências)
├─ Step 2: npm run lint (BLOQUEIA se falhar)
├─ Step 3: npm test -- --runInBand (BLOQUEIA se falhar)
├─ Step 4: npm run quality (BLOQUEIA se falhar)
├─ Step 5: npm run test:coverage (BLOQUEIA se falhar)
├─ Step 6: npm audit (BLOQUEIA se falhar)
├─ Step 7: docker build (BLOQUEIA se falhar)
├─ Step 8: health check (BLOQUEIA se falhar)
│
└─ TODOS os passos passaram?
   │
   └─ SIM: Deploy com rsync
      ├─ Cria backup automático
      ├─ Sincroniza arquivos
      ├─ Instala dependências remotas
      ├─ Executa migrações
      └─ Health check final
         ↓
      Produção atualizada ✅
      Slack notificado 🔔
```

## Debugging

### "Meu teste passa localmente mas falha no CI"

1. Executar com flag `--runInBand` (sem paralelismo):
   ```bash
   npm test -- --runInBand
   ```

2. Verificar variáveis de ambiente:
   ```bash
   cat .env.example
   # Suas variáveis estão definidas?
   ```

3. Limpar cache:
   ```bash
   rm -rf node_modules coverage .next
   npm ci
   make ci
   ```

### "Lint falha mas não fiz nada"

1. Executar lint:
   ```bash
   npm run lint
   ```

2. Verificar diffs não intencionais:
   ```bash
   git diff
   git status
   ```

3. Auto-corrigir (se possível):
   ```bash
   npm run lint -- --fix
   ```

### "Preciso fazer push urgentemente mas há falhas"

❌ **NÃO USE** `git commit --no-verify`

Ao invés:
1. Corrigir o problema
2. Ou abrir issue documentando a falha
3. Ou falar com tech lead sobre exceção

## Fases do Pipeline

### Fase 1 ✅ (ATUAL)
- Tests bloqueiam deploy
- Lint bloqueia deploy
- Security audit obrigatório
- Pre-commit hooks disponíveis

### Fase 2 🔜 (Próxima)
- Enforce coverage mínimo (80%)
- SAST com Snyk
- Code review bot

### Fase 3 🚀 (Futuro)
- Feature flags para rollback automático
- Canary deployments
- Blue-green deployments

## Emergências

Se algo der muito errado em produção:

```bash
# SSH no servidor
ssh deploy@ruptur.cloud

# Listar backups (criados automaticamente)
ls -la /app/ruptur-saas/backups/

# Restaurar último backup (5 minutos)
cd /app/ruptur-saas
rm -rf .
cp -r backups/backup-LATEST/* .
npm start
```

## Variáveis de Ambiente

Configuradas em: GitHub > Settings > Secrets and Variables > Actions

```
✅ GCP_SA_KEY          (Service account JSON para deploy)
✅ DEPLOY_SSH_KEY      (Chave SSH para rsync)
✅ DEPLOY_KNOWN_HOSTS  (Hosts conhecidos SSH)
✅ SLACK_WEBHOOK       (Para notificações)
```

Verificar se existem:
```bash
# Sem output = não configurado
gh secret list
```

## Métricas

Monitorando em:
- **GitHub Actions**: https://github.com/YOUR_REPO/actions
- **Slack**: #deployments
- **Production Health**: https://app.ruptur.cloud/api/local/health

## Documentação Completa

- [CI-CD-PIPELINE.md](docs/CI-CD-PIPELINE.md) - Documentação técnica completa
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Guia de deploy manual
- [Makefile](Makefile) - Todos os comandos disponíveis

## Perguntas?

1. Verificar `docs/CI-CD-PIPELINE.md`
2. Verificar logs do GitHub Actions
3. Contatar tech lead

---

**Status**: ✅ Implementado e Testado  
**Data**: 2026-05-08  
**Responsável**: Subagente C (CI/CD)  
**Próximo Review**: 2026-05-22
