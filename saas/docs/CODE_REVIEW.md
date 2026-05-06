# Guia de Code Review — Ruptur SaaS

## Objetivo

Garantir que cada alteração preserve segurança, estabilidade, rastreabilidade e capacidade de deploy sem quebrar produção.

## Revisão funcional

- A alteração resolve exatamente o problema pedido?
- Não mistura escopos não relacionados no mesmo commit?
- Fluxos existentes continuam funcionando?
- Existe fallback quando a dependência externa falha?
- Erros são tratados com mensagem segura e útil?

## Revisão de segurança

- Autenticação obrigatória nas rotas privadas.
- Autorização baseada em permissão/tenant, não apenas presença de sessão.
- Tokens, secrets e credenciais nunca aparecem em resposta, log ou bundle.
- RLS e service role foram considerados quando a rota acessa Supabase.
- Webhooks validam assinatura/origem quando o provedor oferece esse recurso.
- Operações financeiras usam idempotência.

## Revisão de banco/migrations

- Migration é idempotente.
- Índices existem para filtros frequentes.
- RLS foi habilitado onde há dados multi-tenant.
- Políticas não expõem dados globais para usuário comum.
- Alterações destrutivas têm rollback/plano de migração.
- Colunas sensíveis ficam criptografadas ou fora do banco quando possível.

## Revisão de billing/gateways

- Idempotência por evento/transação/pedido.
- Reprocessamento seguro.
- Logs mascarados.
- Separação clara entre sandbox/homologação/produção.
- Gateway ativo/inativo não quebra health.
- Webhook nunca concede crédito/assinatura duas vezes.

## Revisão de frontend

- Estados de loading, erro e vazio existem.
- Componentes não fazem loop de autenticação/sessão.
- Área ativa e atalhos respeitam permissões reais da credencial.
- Nenhum segredo ou configuração server-side foi enviado para o bundle.
- Build gera asset existente e referenciado por `dist-client/index.html`.

## Revisão de observabilidade

- Health reflete dependências críticas.
- Logs têm contexto suficiente sem expor dados sensíveis.
- Erros de integração externa indicam provider, ambiente e operação.
- Operações administrativas geram evento/auditoria quando aplicável.

## Onde 90% dos projetos erram — mitigação

1. **Permissão só no frontend** — sempre validar no backend.
2. **Webhook sem idempotência** — armazenar evento/processamento e rejeitar duplicidade.
3. **Segredo em log/env commitado** — usar `.env`, secret manager e mascaramento.
4. **Migration irreversível** — usar rollout seguro e plano de rollback.
5. **Deploy sem smoke test** — health + rotas críticas + logs sempre.
6. **Build local diferente da produção** — rodar Docker build/rebuild e conferir bundle publicado.
7. **Fallback silencioso** — avisar no health/log quando provider/tabela/migration faltar.
8. **Escopo misturado no commit** — commits pequenos, rastreáveis e com mensagem objetiva.
