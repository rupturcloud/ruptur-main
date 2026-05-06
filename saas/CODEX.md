# Orientação para Codex — Ruptur SaaS

Este arquivo complementa `AGENTS.md`. Codex deve ler e seguir `AGENTS.md` antes de atuar neste projeto.

Para code review, UX e jornadas, consulte também `docs/AGENT_UX_REVIEW_PROMPT.md`.

## Regras obrigatórias

- Comunicar-se com Diego sempre em português do Brasil (`pt-BR`).
- Não expor segredos, tokens, client secrets, service role keys ou conteúdo completo de `.env`.
- Antes de alterar qualquer coisa, verificar `git status --short --branch`.
- Preservar alterações de Claude Code, Graphyfy ou outros agentes.
- Não misturar escopos no mesmo commit.
- Não commitar `.env`, dumps sensíveis ou dados runtime.

## Fluxo recomendado

1. Entender pedido e escopo.
2. Ler os arquivos relevantes.
3. Fazer patch pequeno e reversível.
4. Rodar validações:

```bash
npm run lint
npm test -- --runInBand
npm run build
```

5. Se mexer em segurança, deploy, migrations ou integrações:

```bash
npm run review
```

6. Resumir:
   - arquivos alterados;
   - comandos executados;
   - resultado;
   - commit/push/deploy quando aplicável;
   - pendências/riscos.

## Arquitetura que Codex deve preservar

```txt
Integrações externas -> integrations-core/adapters -> webhook-core -> eventos internos -> motores agnósticos
```

Não acoplar Billing/Wallet diretamente a Cakto/Getnet/Stripe/Mercado Livre/UAZAPI.

## Uso do Graphyfy

Codex deve usar/considerar Graphyfy como apoio padrão para entendimento arquitetural e documentação visual.

Quando a tarefa envolver arquitetura, fluxos, integrações, webhooks, billing, wallet, permissões, tenants, deploy ou dependências entre módulos:

- consultar o mapa/fluxo do Graphyfy quando estiver disponível;
- preservar nomes e conceitos usados nos grafos;
- documentar mudanças de forma compatível com grafo/diagrama;
- se encontrar divergência entre código e Graphyfy, tratar o código como fonte operacional e abrir/corrigir pendência documental.

## Deploy

Usar o runbook em `AGENTS.md` e `docs/DEPLOYMENT.md`.
Sempre validar produção depois do deploy:

```bash
curl -sS https://app.ruptur.cloud/api/local/health
curl -sS -o /dev/null -w 'admin %{http_code}\n' https://app.ruptur.cloud/admin
curl -sS -o /dev/null -w 'superadmin %{http_code}\n' https://app.ruptur.cloud/admin/superadmin
curl -L -sS -o /dev/null -w 'aquecimento %{http_code}\n' https://app.ruptur.cloud/aquecimento
```

## Colaboração multiagente

- Claude Code pode tratar bugs específicos; não duplicar nem sobrescrever sem revisar diff.
- Graphyfy pode manter fluxos/diagramas; preservar nomes e conceitos.
- Em caso de dúvida, priorizar segurança, idempotência, logs auditáveis e produção estável.
