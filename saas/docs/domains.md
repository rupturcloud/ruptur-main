# Arquitetura de domínios Ruptur Cloud

Esta é a convenção canônica para produção.

| Domínio | Papel | Uso esperado |
| --- | --- | --- |
| `ruptur.cloud` | Site público | Landing page, vendas, institucional e hot site. |
| `app.ruptur.cloud` | Aplicação | Frontend autenticado, login, painel e dashboard do cliente. |
| `api.ruptur.cloud` | Backend | APIs, webhooks e integrações externas. |
| `saas.ruptur.cloud` | Compatibilidade/gateway | Gateway SaaS atual e compatibilidade temporária. Não deve ser usado como URL pública definitiva de webhook. |

## Getnet

A URL canônica de callback/webhook da Getnet é:

```txt
https://api.ruptur.cloud/api/webhooks/getnet
```

Use a mesma URL nos callbacks de pagamento normal, PIX, cancelamento, débito, crédito e boleto.

## Boas práticas adotadas

- Separar site público, aplicação e API por subdomínio reduz acoplamento entre frontend e backend.
- `api.ruptur.cloud` deve ser o host estável para integrações externas, porque callbacks de adquirentes precisam de URL previsível e permanente.
- Registros A/CNAME que servem tráfego HTTP/HTTPS devem ficar proxied no Cloudflare quando não houver necessidade de validação direta por IP de origem.
- Webhooks devem validar autenticidade quando o provedor oferecer assinatura; quando o provedor não expõe segredo de assinatura, mitigar com HTTPS, idempotência, validação de schema, rate limit e logs de auditoria.
