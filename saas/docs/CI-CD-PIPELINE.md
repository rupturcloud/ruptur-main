# Ruptur SaaS - CI/CD Pipeline Seguro

## Objetivo

Garantir que **quebras de testes NUNCA cheguem à produção**. Este documento descreve o pipeline implementado para forçar validações e bloquear deploys inseguros.

## Arquitetura do Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Desenvolvedor faz PUSH                       │
│                  em main ou develop branch                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            GitHub Actions CI Pipeline (deploy-rsync.yml)        │
│                                                                  │
│  Step 1: npm ci                                                 │
│  ✅ Instala dependências exatas (seguro)                        │
│                                                                  │
│  Step 2: npm run test -- --runInBand                            │
│  ✅ Executa testes unitários (BLOQUEIA SE FALHAR)              │
│                                                                  │
│  Step 3: npm run lint                                           │
│  ✅ Linting de código (BLOQUEIA SE FALHAR)                      │
│                                                                  │
│  Step 4: npm run quality (= lint + test + build)                │
│  ✅ Quality gate completa (BLOQUEIA SE FALHAR)                  │
│                                                                  │
│  Step 5: npm run test:coverage                                  │
│  ✅ Gera relatório de coverage (BLOQUEIA SE FALHAR)             │
│                                                                  │
│  Step 6: npm run build                                          │
│  ✅ Build final (BLOQUEIA SE FALHAR)                            │
│                                                                  │
│  TODOS OS PASSOS TÊM set -e (falha = pipeline para)             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    Tudo OK?
                         │
                    SIM──▼──NÃO
                    │        │
                    │        ▼
                    │    ❌ PIPELINE FALHA
                    │    • Notifica Slack
                    │    • Logs disponíveis
                    │    • Developer corrige
                    │
                    ▼
        ┌───────────────────────────────┐
        │  Deploy com rsync (Step 7+)   │
        │                               │
        │  • Cria backup (rollback)     │
        │  • Sincroniza arquivos        │
        │  • Instala dependências       │
        │  • Executa migrações          │
        │  • Health check               │
        │  • Notifica Slack             │
        └───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │   Produção Atualizada ✅      │
        │   (com testes validados)      │
        └───────────────────────────────┘
```

## Validações Implementadas

### 1. Testes Unitários (Obrigatório)

```bash
npm test -- --runInBand
```

- **Quando**: SEMPRE antes de deploy
- **Falha de teste**: ❌ BLOQUEIA DEPLOY
- **Coverage mínimo**: Será monitorado após esta implementação
- **Relatório**: Armazenado em `coverage/`

### 2. Linting (Obrigatório)

```bash
npm run lint
```

- **Quando**: SEMPRE antes de deploy
- **Falha de lint**: ❌ BLOQUEIA DEPLOY
- **Ferramentas**: Node.js syntax check + Nextra linter

### 3. Quality Gate (Obrigatório)

```bash
npm run quality
```

Executa:
- `npm run lint` - validação de sintaxe
- `npm run test:unit` - testes
- `npm run build` - build da aplicação

**Uma falha aqui = NENHUM deploy acontece**

### 4. Coverage Report (Monitorado)

```bash
npm run test:coverage
```

- Gera relatório em `coverage/`
- Atualmente em 0% (será enforçado em fase 2)
- Armazenado como artefato no GitHub Actions

### 5. Security Audit (Obrigatório)

```bash
npm audit --audit-level moderate
```

- Escaneia vulnerabilidades npm
- Bloqueia se encontrar HIGH ou CRITICAL
- Relatório disponível em logs

### 6. Build Docker (Obrigatório para E2E)

```bash
docker build -t ruptur-saas:$BUILD_NUMBER .
```

- Valida sintaxe Dockerfile
- Prepara imagem para testes
- Teste de saúde básico (`/api/local/health`)

## Pre-commit Hooks (Local)

Para adicionar validação **ANTES** de fazer commit, use:

```bash
npm install husky --save-dev
npx husky install
npx husky add .husky/pre-commit "npm run test && npm run lint"
```

Isso garante que:
- ✅ Nenhum código quebrado chega ao git
- ✅ Desenvolvedor recebe feedback imediato
- ✅ CI/CD será redundante (camada extra de segurança)

## Fluxo em Detalhes

### Quando ocorrem testes?

1. **Local** (antes de commit):
   - `npm test` - no seu computador
   - `npm run lint` - no seu computador
   - **Se falhar**: Não consegue fazer commit!

2. **CI/CD** (depois de push):
   - GitHub Actions roda os mesmos testes
   - Testes E2E adicionais com Docker
   - Security scan com Trivy
   - **Se falhar**: Build é marcado como ❌ FAILED

3. **Deploy**:
   - Rsync com rsync.sh (só se CI passou)
   - Backup automático criado
   - Health check verifica saúde
   - **Se falhar**: Pode fazer rollback manual

### Comandos Locais para Validar

Antes de fazer push:

```bash
# Opção 1: Validação rápida
npm run lint
npm test

# Opção 2: Validação completa (como CI fará)
npm run quality
npm run test:coverage
npm audit --audit-level moderate
npm run build

# Opção 3: Simular CI completo com Docker
docker build -t ruptur-saas:local .
docker run ruptur-saas:local npm test
```

## Variáveis de Ambiente Necessárias

No GitHub: Settings > Secrets and Variables > Actions

```
GCP_SA_KEY           (Service account JSON)
GCP_PROJECT_ID      (ruptur-jarvis-v1-68358)
SLACK_WEBHOOK       (Para notificações)
DEPLOY_SSH_KEY      (Para rsync)
DEPLOY_KNOWN_HOSTS  (Para SSH)
```

## Monitoramento e Alertas

### Falhas são notificadas em:

1. **GitHub Actions UI**: Status na PR/commit
2. **Slack**: Webhook notifica #deployments
3. **Email**: DEPLOY_EMAIL recebe relatório

### Como debugar uma falha?

1. Ir em GitHub > Actions > workflow run
2. Expandir o step que falhou
3. Ver logs completos (últimas 100 linhas)
4. Reproduzir localmente: `npm run [comando que falhou]`
5. Corrigir e fazer novo push

## Segurança - Fases

### Fase 1 (ATUAL - Este documento)

- ✅ Tests bloqueiam deploy
- ✅ Lint bloqueia deploy
- ✅ Quality gate implementado
- ✅ Security audit obrigatório
- ✅ Pre-commit hooks documentados
- ✅ Rollback manual possível

### Fase 2 (Próxima)

- [ ] Enforce coverage mínimo (ex: 80%)
- [ ] SAST (Static Analysis) com Snyk
- [ ] Code review bot (Reviewdog)
- [ ] Aprovação manual para main branch

### Fase 3 (Futuro)

- [ ] Feature flags para rollback automático
- [ ] Canary deployments
- [ ] Blue-green deployments
- [ ] Observabilidade (Datadog/New Relic)

## Rollback de Emergência

Se algo der errado em produção:

```bash
# 1. SSH no servidor
ssh deploy@ruptur.cloud

# 2. Listar backups
ls -la /app/ruptur-saas/backups/

# 3. Restaurar backup mais recente
cd /app/ruptur-saas
rm -rf .
cp -r backups/backup-YYYYMMDD-HHMMSS/* .

# 4. Reiniciar serviço
npm run start
```

**Nota**: Backups automáticos são criados a cada deploy via `deploy-rsync.sh`.

## Troubleshooting

### "Tests passed locally but failed in CI"

1. Usar `npm test -- --runInBand` (sem paralelismo)
2. Verificar variáveis de ambiente no Actions
3. Verificar Node.js version (deve ser 20.x)

### "Lint fails but I didn't change anything"

1. Executar `npm run lint` localmente
2. Ver se tem diffs em `.github/` ou `package.json`
3. Fazer reset: `git checkout -- file.js`

### "Rsync fails but CI passed"

1. Verificar conectividade SSH: `ssh -i ~/.ssh/deploy_key deploy@ruptur.cloud echo OK`
2. Verificar espaço em disco: `ssh deploy@ruptur.cloud 'df -h'`
3. Verificar permissões: `ssh deploy@ruptur.cloud 'ls -la /app/ruptur-saas'`

### "Health check fails after deploy"

1. Verificar logs no servidor: `ssh deploy@ruptur.cloud 'tail -f /app/ruptur-saas/logs/*.log'`
2. Testar manualmente: `curl https://app.ruptur.cloud/api/local/health`
3. Verificar variáveis de ambiente: `ssh deploy@ruptur.cloud 'cat /app/ruptur-saas/.env | head'`

## Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Husky Pre-commit Hooks](https://typicode.github.io/husky/)
- [npm Test Best Practices](https://docs.npmjs.com/cli/v10/commands/npm-test)
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guia de deploy manual

---

**Última atualização**: 2026-05-08  
**Responsável**: Subagente C (CI/CD Pipeline)  
**Status**: ✅ Implementado (Fase 1)
