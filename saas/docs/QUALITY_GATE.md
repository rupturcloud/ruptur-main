# Quality Gate — Ruptur SaaS

Este documento define o padrão mínimo para qualquer alteração antes de commit, push e deploy.

## Comandos oficiais

Execute sempre na raiz `saas/`:

```bash
npm run review
npm run quality
npm run test:coverage
```

O que cada comando cobre:

| Comando | Objetivo |
| --- | --- |
| `npm run review` | Checklist automatizado de riscos: segredos, artefatos, migrações e bundles quebrados. |
| `npm run lint` | Validação de sintaxe Node.js + lint do frontend React. |
| `npm run test:unit` | Testes unitários/integrados Jest existentes. |
| `npm run test:coverage` | Gera cobertura em `coverage/` com `text`, `lcov` e `json-summary`. |
| `npm run build` | Build de produção do frontend em `dist-client/`. |
| `npm run quality` | Executa lint, testes unitários e build em sequência. |

## Política de cobertura

A cobertura passa a ser medida em todo PR, mas o limite global inicial está em `0%` para não bloquear a evolução do MVP por código legado ainda sem testes.

Regra de evolução:

1. Todo módulo novo de regra de negócio deve vir com teste.
2. Toda correção de bug deve incluir teste de regressão quando possível.
3. A cobertura global não deve cair em PRs futuros.
4. Quando um domínio estabilizar, subir metas gradualmente por arquivo ou módulo.

Prioridade de cobertura:

1. Billing, webhooks, idempotência e reconciliação.
2. Permissões, ambientes, admin/superadmin e RLS indireto via API.
3. UAZAPI/provider accounts/leases.
4. Warmup/campanhas/fila/controle de envio.
5. UI crítica de compra, onboarding e área do cliente.

## Checklist antes de deploy

- [ ] `git status` revisado, sem arquivo inesperado.
- [ ] Nenhum segredo real em arquivos versionados.
- [ ] `npm run review` OK.
- [ ] `npm run quality` OK.
- [ ] `npm run test:coverage` executado e cobertura analisada.
- [ ] Se alterou frontend, `dist-client/index.html` aponta para bundle existente.
- [ ] Se alterou migração, confirmou idempotência (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) e RLS.
- [ ] Se alterou billing/webhook, confirmou idempotência, assinatura, replay e logs mascarados.
- [ ] Se alterou deploy/env, validou health em produção após publicar.

## Critérios de bloqueio

Não enviar para produção se houver:

- segredo literal versionado;
- teste ou build falhando;
- rota crítica sem autenticação/validação;
- migration destrutiva sem plano de rollback;
- alteração de cobrança sem idempotência;
- alteração de webhook sem proteção contra replay/duplicidade;
- bundle referenciado no HTML inexistente;
- log expondo token, client secret, admin token, access token ou payload sensível.

## Validação pós-deploy

```bash
curl -sS https://app.ruptur.cloud/api/local/health
curl -sS -o /dev/null -w 'admin/superadmin %{http_code}\n' https://app.ruptur.cloud/admin/superadmin
curl -sS -o /dev/null -w 'admin %{http_code}\n' https://app.ruptur.cloud/admin
curl -sS -o /dev/null -w 'dashboard %{http_code}\n' https://app.ruptur.cloud/dashboard
curl -L -sS -o /dev/null -w 'aquecimento %{http_code}\n' https://app.ruptur.cloud/aquecimento
```

Também confira os logs do container e valide que aparecem:

- Supabase conectado;
- Billing ativo conforme gateway configurado;
- Static `dist-client` OK;
- sem stack trace na inicialização.
