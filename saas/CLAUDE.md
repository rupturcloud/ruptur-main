# Orientação para Claude Code — Ruptur SaaS

Claude Code deve ler e seguir `AGENTS.md` antes de alterar código neste projeto.

Resumo obrigatório:

- Responder Diego em pt-BR.
- Não expor segredos, tokens ou conteúdo de `.env`.
- Verificar `git status --short --branch` antes de alterar.
- Preservar alterações de Codex, Graphyfy ou outros agentes.
- Rodar validações antes de finalizar: `npm run lint`, `npm test -- --runInBand`, `npm run build`.
- Para arquitetura de integrações/webhooks, consultar `docs/INTEGRATIONS_AND_WEBHOOK_CORE.md`.
- Para deploy, consultar `docs/DEPLOYMENT.md` e o runbook em `AGENTS.md`.

Se estiver tratando erro em produção, sempre informar:

1. causa provável;
2. arquivos alterados;
3. comandos executados;
4. validações feitas;
5. pendências ou riscos.
