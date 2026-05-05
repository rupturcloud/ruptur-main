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
npm run supabase:start:core
npm run supabase:reset
npm run supabase:stop
```

Depois do `supabase:start:core`, rode:

```bash
supabase status
```

Copie `API URL`, `anon key` e `service_role key` para um `.env.local` baseado em `docs/SUPABASE_ENV_LOCAL.example`.


## Perfil local recomendado

Use por padrão:

```bash
npm run supabase:start:core
```

Esse perfil sobe o núcleo necessário para desenvolvimento local — Postgres, Auth, REST, Realtime, Studio, Meta e Mailpit — e exclui serviços opcionais que não são usados pelo SaaS agora e podem falhar em healthcheck local: `storage-api`, `imgproxy`, `logflare` e `vector`.

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
