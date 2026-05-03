# 🔧 Cloudflare Fix - Remover Redirect saas.ruptur.cloud

## Credenciais (GUARDE ESTE ARQUIVO)

- **Email:** ruptur.cloud@gmail.com
- **API Token:** Global API Key
- **Zone ID:** 227b5a55cb0351ee3c1ca6b533d3cbfb

## Problema

O domínio `saas.ruptur.cloud` tem um redirect para `app.ruptur.cloud/client-area/`

Precisamos remover este redirect para a landing page funcionar.

## Passos Manuais (Recomendado)

1. Acesse: https://dash.cloudflare.com
2. Login com: ruptur.cloud@gmail.com
3. Selecione o domínio: ruptur.cloud
4. Vá em: **Rules** → **Page Rules** ou **Redirect Rules**
5. Procure regra com:
   - URL: `saas.ruptur.cloud/*` ou `*saas.ruptur.cloud/*`
   - Ação: "Forwarding URL" ou "Redirect"
   - Destino: `app.ruptur.cloud/client-area/`
6. **Delete** ou **Pause** esta regra
7. Aguarde 1-2 minutos

## Validação

Teste no terminal:
```bash
curl -I https://saas.ruptur.cloud/
```

Deve retornar `200 OK` em vez de `301 Moved Permanently`

## Ou Use Script Local

```bash
#!/bin/bash
export CF_EMAIL="ruptur.cloud@gmail.com"
export CF_API_KEY="SUA_GLOBAL_API_KEY"
export ZONE_ID="227b5a55cb0351ee3c1ca6b533d3cbfb"

# Listar Page Rules
curl -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/pagerules" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_API_KEY" \
  -H "Content-Type: application/json" | jq .

# Encontrar ID da regra com saas.ruptur.cloud e deletar:
# curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/pagerules/ID_DA_REGRA" \
#   -H "X-Auth-Email: $CF_EMAIL" \
#   -H "X-Auth-Key: $CF_API_KEY"
```

Execute este script no SEU terminal (não no meu).
