# Admin Comercial, Tracking e Suporte

Esta camada adiciona ao Admin um catálogo comercial agnóstico para MVP/POC sem acoplar billing ou wallet a um gateway específico.

## Módulos adicionados

- **Comercial**: planos, assinaturas, free tier, planos em destaque, periodicidade mensal/anual/customizada, pacotes de créditos e regras de preço por métrica.
- **Gateways**: Cakto, Getnet e Stripe como integrações plugáveis. O cadastro guarda credenciais criptografadas e expõe apenas `last4`.
- **Tracking**: UTMify, Google Analytics, Google Tag Manager, Meta Pixel, Google Ads e integrações customizadas.
- **Suporte**: tickets internos/de sustentação com prioridade, categoria e fluxo de status.

## Princípio arquitetural

- `billing` e `wallet` continuam módulos especialistas e agnósticos.
- `integrations-core` descreve providers conhecidos e seus contratos.
- `commercial_admin` parametriza o que será vendido: plano, oferta, pacote e regra.
- `tracking_integrations` parametriza destino de eventos sem espalhar credenciais pelo frontend.

## Migration

Aplicar `migrations/015_commercial_admin_tracking_support.sql` para criar:

- `commercial_plans`
- `commercial_offers`
- `commercial_credit_packages`
- `commercial_pricing_rules`
- `tracking_integrations`
- `support_tickets`
- `support_ticket_events`

Todas as tabelas têm RLS habilitado e bloqueiam acesso direto de usuário comum. O Admin opera via backend com `service_role`.

## Endpoints admin

- `GET /api/admin/commercial/catalog`
- `GET /api/admin/commercial/:resource`
- `POST /api/admin/commercial/:resource`
- `PATCH /api/admin/commercial/:resource/:id`
- `POST /api/admin/commercial/:resource/:id/status`

Recursos suportados:

- `plans`
- `offers`
- `packages`
- `pricing-rules`
- `tracking-integrations`
- `support-tickets`

## Boas práticas implementadas

- Allowlist de recursos no backend para evitar escrita arbitrária em tabela.
- Criptografia de credenciais de tracking no backend.
- Fallback amigável quando a migration ainda não foi aplicada.
- Separação entre configuração comercial e execução financeira.
- Status explícitos para ativar, pausar, arquivar e desativar sem apagar histórico.
