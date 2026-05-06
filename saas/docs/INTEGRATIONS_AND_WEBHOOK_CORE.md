# Integration Core & Webhook Core

## Decisão arquitetural

A plataforma deve conhecer integrações externas, mas os motores internos devem ser agnósticos.

- `integrations-core`: presets, capacidades e adapters por provider.
- `webhook-core`: entrada, idempotência, normalização e despacho de webhooks.
- `billing`, `wallet`, `subscriptions`, `campaigns`: motores especialistas que consomem eventos internos canônicos.

## Fluxo alvo

```txt
Provider externo (Cakto/Getnet/Stripe/Mercado Livre/UAZAPI)
  -> Adapter do integrations-core
  -> Evento interno normalizado
  -> webhook-core salva/deduplica/despacha
  -> billing/wallet/campaigns aplicam regra de negócio
```

## Regras de segurança

1. Controller de webhook responde rápido: valida, persiste e agenda processamento.
2. Payload bruto deve ser armazenado para auditoria/replay.
3. Todo evento externo precisa de idempotência.
4. Segredos ficam em `.env`, vault ou campo criptografado; UI só mostra `last4`.
5. Billing e Wallet não devem importar SDK/API de provider externo.
6. Status externos devem ser convertidos para eventos internos versionados.

## Tabelas propostas na migration 014

- `integration_accounts`: conta/configuração agnóstica por provider.
- `integration_webhook_events`: inbox durável para webhooks brutos e normalizados.
- `internal_events`: eventos canônicos para motores internos.
- `integration_idempotency_keys`: idempotência transversal.

## Providers previstos

- Pagamento: Cakto, Getnet, Stripe, Mercado Pago.
- Marketplace: Mercado Livre.
- Mensageria: UAZAPI.

## MVP seguro

O código atual continua funcionando com `payment_gateway_accounts`. A fundação nova entra sem quebra e permite migrar gradualmente:

1. Presets centralizados em `modules/integrations-core/provider-presets.js`.
2. Adapters iniciais para Cakto/Getnet.
3. `webhook-core` com normalização e idempotência em memória para testes/PoC.
4. Migration 014 para persistência real quando aplicada no Supabase.
