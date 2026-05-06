# Status — Infraestrutura Ruptur SaaS

Atualizado em: 2026-05-04

## Diretriz canônica

A infraestrutura operacional do Ruptur SaaS deve permanecer centralizada no GCP.

## Produção GCP

Host principal:

- `ruptur-shipyard-01`
- IP público: `34.176.34.240`
- Projeto: `ruptur-jarvis-v1-68358`
- Zona: `southamerica-west1-a`

Serviço SaaS:

- container: `saas-web`
- porta interna/externa: `3001`
- domínio alvo de API: `api.ruptur.cloud`
- health esperado: `/api/health`

## Deploy SaaS

Fluxo esperado:

1. sincronizar código para `/opt/ruptur/saas` no host GCP;
2. preservar `.env` de produção no host;
3. executar `docker compose up -d --build`;
4. validar localmente no host:
   - `http://127.0.0.1:3001/api/health`
   - `http://127.0.0.1:3001/api/billing/packages`
5. validar publicamente:
   - `https://api.ruptur.cloud/api/health`
   - `https://api.ruptur.cloud/api/billing/packages`

## Variáveis obrigatórias para Getnet

Para o billing real ficar ativo, o `.env` de produção precisa conter:

- `GETNET_CLIENT_ID`
- `GETNET_CLIENT_SECRET`
- `GETNET_SELLER_ID`
- `GETNET_WEBHOOK_SECRET`

Sem essas variáveis, o gateway deve continuar saudável, mas `billing` permanece `false` no health check e o webhook deve recusar processamento em produção.

## Guardrails

- Não versionar `.env`, certificados, dumps, volumes Docker ou sessões.
- Não publicar credenciais reais no Git.
- DNS público de produção deve apontar para o GCP.
