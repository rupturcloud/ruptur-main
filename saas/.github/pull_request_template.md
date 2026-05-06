## Resumo

Descreva objetivamente o que mudou e por quê.

## Tipo de alteração

- [ ] Bugfix
- [ ] Feature
- [ ] Refactor
- [ ] Migration/banco
- [ ] Billing/gateway/webhook
- [ ] Infra/deploy
- [ ] Documentação/testes

## Checklist de qualidade

- [ ] Rodei `npm run review`
- [ ] Rodei `npm run quality`
- [ ] Rodei `npm run test:coverage`
- [ ] Não há segredo real em arquivos versionados/logs
- [ ] Não misturei escopos não relacionados
- [ ] Atualizei documentação quando necessário

## Banco/migrations

- [ ] Não se aplica
- [ ] Migration idempotente
- [ ] RLS/policies revisadas
- [ ] Índices revisados
- [ ] Rollback/plano de recuperação descrito

## Segurança/permissões

- [ ] Autenticação validada no backend
- [ ] Autorização por tenant/permissão validada no backend
- [ ] Dados sensíveis mascarados
- [ ] Webhooks/idempotência revisados, se aplicável

## Evidências

Cole aqui saída dos comandos principais, prints ou links de validação.

```bash
npm run review
npm run quality
npm run test:coverage
```

## Pós-deploy

- [ ] Health OK
- [ ] Rotas críticas OK
- [ ] Logs sem erro de inicialização
