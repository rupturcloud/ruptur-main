# Orientação para Claude Code — Ruptur SaaS

Claude Code deve ler e seguir `AGENTS.md` antes de alterar código neste projeto.

Resumo obrigatório:

- Responder Diego em pt-BR.
- Não expor segredos, tokens ou conteúdo de `.env`.
- Verificar `git status --short --branch` antes de alterar.
- Preservar alterações de Codex, Graphyfy ou outros agentes.
- Rodar validações antes de finalizar: `npm run lint`, `npm test -- --runInBand`, `npm run build`.
- Para arquitetura de integrações/webhooks, consultar `docs/INTEGRATIONS_AND_WEBHOOK_CORE.md`.
- Para code review, UX e jornadas, consultar `docs/AGENT_UX_REVIEW_PROMPT.md`.
- Para deploy, consultar `docs/DEPLOYMENT.md` e o runbook em `AGENTS.md`.

Se estiver tratando erro em produção, sempre informar:

1. causa provável;
2. arquivos alterados;
3. comandos executados;
4. validações feitas;
5. pendências ou riscos.


## Graphyfy

Claude Code também deve usar/considerar Graphyfy como ferramenta transversal do projeto.

Quando mexer em arquitetura, integrações, webhooks, billing, wallet, permissões, tenants ou deploy:

- preservar diagramas/fluxos/artefatos existentes;
- manter nomes de módulos e eventos consistentes;
- documentar mudanças de forma que possam ser refletidas em grafo;
- se houver divergência entre código e Graphyfy, informar no resumo e propor correção documental.
