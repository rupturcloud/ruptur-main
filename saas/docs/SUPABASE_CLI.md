# Supabase CLI — ambiente local Ruptur

## Estado preparado

- CLI instalada: `supabase --version`
- Config local: `supabase/config.toml`
- Migrations CLI: `supabase/migrations/*.sql`
- Seed local: `supabase/seed.sql`
- Exemplo de env local: `docs/SUPABASE_ENV_LOCAL.example`

## Pré-requisito

A Supabase CLI usa Docker para rodar Postgres, Auth, Storage, Realtime e Studio localmente. Antes de iniciar, abra o Docker Desktop ou garanta que o daemon Docker esteja rodando.

## Comandos principais

```bash
npm run supabase:version
npm run supabase:status
npm run supabase:start:app
npm run supabase:reset
npm run supabase:stop
```

Depois do `supabase:start:app`, rode:

```bash
supabase status
```

Copie `API URL`, `anon key` e `service_role key` para um `.env.local` baseado em `docs/SUPABASE_ENV_LOCAL.example`.


## Perfil local recomendado

Use por padrão:

```bash
npm run supabase:start:app
```

Esse perfil sobe o núcleo necessário para desenvolvimento local do painel — Postgres, Auth, REST, Studio/Meta e Mailpit — e exclui serviços que não são necessários para este fluxo agora e que estão falhando em healthcheck local: `storage-api`, `imgproxy`, `logflare`, `vector`, `realtime` e `edge-runtime`.

Se um dia precisarmos testar Storage/Analytics completos, use:

```bash
npm run supabase:start:full
```

## Migrations

As migrations históricas continuam em `/migrations`. Para materializar o formato usado pela Supabase CLI:

```bash
npm run supabase:prepare
```

Para criar nova migration:

```bash
npm run supabase:migration:new nome_da_migration
```

Para aplicar localmente do zero:

```bash
npm run supabase:reset
```

Para aplicar no projeto remoto linkado:

```bash
npm run supabase:db:push
```

> Atenção: `db push` altera o banco remoto. Confira `supabase projects list` e `supabase status` antes.

## Link remoto atual

O projeto remoto usado no `.env` é:

```txt
axrwlboyowoskdxeogba
```

Para linkar, use:

```bash
npm run supabase:link -- --project-ref axrwlboyowoskdxeogba
```
