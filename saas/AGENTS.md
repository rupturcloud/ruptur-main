# Guia para Agentes — Ruptur SaaS

Este arquivo orienta agentes humanos/IA que entram no projeto. Leia antes de alterar código.

## 1. Regra de comunicação

- Responder Diego sempre em português do Brasil (`pt-BR`).
- Manter nomes técnicos literais quando necessário: comandos, paths, APIs, variáveis, logs e erros.
- Não expor segredos, tokens, client secrets, service role keys ou conteúdo de `.env`.
- Se encontrar credenciais em chat/log/histórico, mascarar e orientar rotação quando aplicável.

## 2. Objetivo do produto

Ruptur Cloud é um SaaS para automação/gestão de WhatsApp, campanhas, aquecimento, wallet/créditos, billing, integrações externas e painéis Admin/Superadmin/Cliente.

Diretriz arquitetural atual:

```txt
Integrações externas -> adapters/presets -> eventos internos -> motores agnósticos
```

Motores internos como `billing`, `wallet`, `campaigns`, `warmup-core` e `subscription` não devem depender diretamente de APIs externas específicas.

## 3. Estrutura principal

```txt
api/gateway.mjs                         Gateway HTTP principal do SaaS
modules/billing/                        Billing, gateways de pagamento, auditoria e webhooks legados
modules/integrations-core/              Presets/adapters/contratos de integrações externas
modules/webhook-core/                   Ingestão, normalização e idempotência de webhooks
modules/wallet/                         Motor de créditos/wallet
modules/warmup-core/                    Runtime de aquecimento e proxy warmup
modules/providers/                      Gestão de contas UAZAPI/provider accounts
modules/provider-adapter/               Adapter UAZAPI expandido
web/client-area/src/                    Frontend React do Cliente/Admin/Superadmin
migrations/                             Migrations SQL Supabase/Postgres
dist-client/                            Bundle de produção gerado pelo Vite
docs/                                   Documentação operacional e arquitetura
```

## 4. Arquivos/documentos importantes

- `docs/INTEGRATIONS_AND_WEBHOOK_CORE.md`: arquitetura de integrações/webhooks.
- `docs/UAZAPI_INTEGRATION_COVERAGE.md`: cobertura UAZAPI.
- `docs/QUALITY_GATE.md`: validações de qualidade.
- `docs/AGENT_UX_REVIEW_PROMPT.md`: prompt/runbook para agentes de code review, UX e jornadas.
- `docs/DEPLOYMENT.md`: deploy.
- `DEPLOYMENT_STATUS.md`, `DEPLOYMENT_SUMMARY.md`, `DEPLOYMENT-FINAL-STATUS.md`: histórico/status operacional.
- `migrations/014_integration_and_webhook_core.sql`: base agnóstica de integrações/webhooks.
- `migrations/013_payment_gateway_accounts.sql`: gateways de pagamento legados/atuais.
- `migrations/012_provider_accounts_and_leases.sql`: contas UAZAPI/provider accounts/leases.

## 5. Comandos padrão

Executar a partir da raiz `saas/`.

```bash
npm run lint
npm test -- --runInBand
npm run build
npm run review
```

Validações pontuais úteis:

```bash
node --check api/gateway.mjs
node --check modules/warmup-core/server.mjs
node --check modules/billing/payment-gateway-account.service.js
npm --prefix web/client-area run lint
npm --prefix web/client-area run build -- --emptyOutDir
```

## 6. Execução local

Gateway SaaS:

```bash
npm run saas
```

Warmup runtime:

```bash
npm start
```

Observação: o `api/gateway.mjs` faz proxy para o Warmup em `WARMUP_RUNTIME_URL` ou `http://localhost:8787`. Se o Warmup não estiver rodando, rotas `/api/warmup/*` podem retornar `502`.

## 7. Deploy atual

Servidor conhecido:

```txt
diego@34.176.34.240:/opt/ruptur/saas
```

Fluxo usado historicamente:

```bash
rsync -avzR -e "ssh -i $HOME/.ssh/google_compute_engine" <arquivos> diego@34.176.34.240:/opt/ruptur/saas/
ssh -i $HOME/.ssh/google_compute_engine diego@34.176.34.240 "cd /opt/ruptur/saas && docker compose build --no-cache && docker compose up -d"
```

Validar após deploy:

```bash
curl -sS https://app.ruptur.cloud/api/local/health
curl -sS -o /dev/null -w 'admin %{http_code}\n' https://app.ruptur.cloud/admin
curl -sS -o /dev/null -w 'superadmin %{http_code}\n' https://app.ruptur.cloud/admin/superadmin
curl -sS -o /dev/null -w 'dashboard %{http_code}\n' https://app.ruptur.cloud/dashboard
curl -L -sS -o /dev/null -w 'aquecimento %{http_code}\n' https://app.ruptur.cloud/aquecimento
```

Logs:

```bash
ssh -i $HOME/.ssh/google_compute_engine diego@34.176.34.240 "docker logs saas-web --tail 100"
```

## 8. Git e colaboração

- Branch atual usada com frequência: `codex/getnet-prod-fix`.
- Antes de alterar: `git status --short --branch`.
- Não misturar escopos no mesmo commit.
- Não commitar `.env`, chaves ou dumps sensíveis.
- Se houver alterações locais de outro agente, não reverter sem confirmar.
- Mensagens de commit em português claro, exemplo:

```bash
git commit -m "feat: criar nucleo agnostico de integracoes e webhooks"
```

## 9. Segurança e segredos

Nunca imprimir valores completos de:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GETNET_CLIENT_SECRET`
- `CAKTO_CLIENT_SECRET`
- `PAYMENT_GATEWAY_SECRET_KEY`
- `SECRETS_MASTER_KEY`
- tokens UAZAPI/admin tokens
- qualquer `.env`

Para UI/admin, usar `last4` e campos criptografados.

## 10. Arquitetura de integrações

Padrão correto:

```txt
Provider externo (Cakto/Getnet/Stripe/Mercado Livre/UAZAPI)
  -> adapter em modules/integrations-core
  -> evento interno normalizado
  -> modules/webhook-core deduplica/processa
  -> billing/wallet/campaigns aplicam regra de negócio
```

Evitar:

- webhook controller creditando wallet diretamente;
- billing importando SDK de provider específico;
- lógica financeira sem idempotência;
- atualizar saldo sem ledger/auditoria;
- responder webhook só depois de operações longas.

## 11. Erros conhecidos e investigação rápida

### `[Auth] Usuário sem tenant vinculado: undefined`

Significa que o usuário autenticado não encontrou tenant no fluxo atual.

Verificar:

- tabela `user_tenant_memberships` para o `auth.users.id`;
- tabela `users` com `tenant_id`;
- fallback por `tenants.email = user.email`;
- endpoint `/api/me/environments`, que monta ambientes Cliente/Admin/Superadmin.

Esse aviso pode aparecer para Superadmin sem tenant de cliente. Só vira problema se o usuário deveria acessar área Cliente e não possui vínculo.

### `/api/warmup/config` retornando `502`

Normalmente significa que o gateway não conseguiu acessar o Warmup runtime.

Verificar:

- `WARMUP_RUNTIME_URL`;
- se o runtime está rodando na porta esperada (`8787` por padrão);
- logs do container `saas-web`;
- se o deploy subiu apenas gateway sem o serviço warmup correspondente.

### `A listener indicated an asynchronous response... message channel closed`

Geralmente vem de extensão do navegador/Chrome extension, não necessariamente do app. Confirmar em aba anônima sem extensões antes de tratar como bug do produto.

## 12. Regras para migrations

- Migrations precisam ser idempotentes: `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- Habilitar RLS conscientemente.
- Service role pode bypassar RLS; usuário comum não deve acessar segredos.
- Evitar policies referenciando tabelas inexistentes.
- Ao criar campos sensíveis, armazenar criptografado pela aplicação.

## 13. Qualidade mínima antes de finalizar

Sempre que mexer em código:

```bash
npm run lint
npm test -- --runInBand
npm run build
```

Se mexer em segurança/deploy/migrations:

```bash
npm run review
```

No resumo final, informar:

- arquivos alterados;
- comandos rodados;
- resultado;
- commit/push/deploy se feitos;
- pendências explícitas.

## 14. Como agir com outro agente trabalhando junto

- Não duplicar investigação: peça/considere o relatório do outro agente.
- Se o outro agente estiver tratando um bug específico, não altere o mesmo arquivo sem necessidade.
- Trabalhe por escopo: documentação, diagnóstico, testes, ou patch isolado.
- Preserve alterações não commitadas de terceiros.
- Se encontrar conflito de orientação, priorize segurança, idempotência e não quebrar produção.

## 15. Agentes/ferramentas específicas em uso

### Codex

Codex também possui orientação específica em `CODEX.md` e resumo curto em `CODEX.txt`. Essas instruções complementam este arquivo e não substituem `AGENTS.md`.

Regras principais para Codex:

- Fazer patches pequenos, claros e validados.
- Sempre preservar alterações de Claude Code, Graphyfy ou outros agentes.
- Evitar commits misturando escopos.
- Registrar no resumo final comandos, validações e pendências.

### Claude Code

O projeto também pode ser trabalhado por Claude Code. Para ele:

- Ler este `AGENTS.md` e também `CLAUDE.md` quando existir.
- Usar as mesmas regras de segurança, idioma e qualidade descritas aqui.
- Não sobrescrever alterações feitas por Codex, Graphyfy ou outro agente sem revisar `git status`/diff.
- Se estiver depurando um erro específico, registrar no resumo quais arquivos tocou e quais comandos rodou.
- Preferir patches pequenos e verificáveis.

### Graphyfy

Graphyfy é ferramenta transversal de apoio visual/arquitetural do projeto. Todos os agentes — Codex, Claude Code e demais — devem considerar Graphyfy como parte do fluxo quando houver decisão estrutural, mapeamento de dependências, mudança de módulo ou documentação de arquitetura.

Uso esperado do Graphyfy:

- Antes de mudanças estruturais, consultar/considerar o mapa visual quando disponível.
- Ao criar ou alterar arquitetura, deixar documentação textual pronta para virar grafo/diagrama.
- Mapear fluxos críticos: autenticação, tenants, permissões, billing, wallet, webhooks, integrações, UAZAPI, warmup, deploy.
- Preservar diagramas, mapas, fluxos ou artefatos gerados por Graphyfy.
- Usar nomes consistentes para módulos e eventos: `integrations-core`, `webhook-core`, `billing`, `wallet`, `internal_events`, `integration_webhook_events`.
- Não renomear conceitos centrais sem atualizar código, documentação e artefatos compatíveis com Graphyfy.

Regra de verdade:

- Código executável e migrations aplicadas são a fonte operacional final.
- Graphyfy é a fonte visual/arquitetural de alinhamento.
- Se código e grafo divergirem, não inventar: registrar a divergência e corrigir documentação/grafo ou abrir pendência explícita.

