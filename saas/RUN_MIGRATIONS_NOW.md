# 🚀 Execute as Migrations AGORA

## ⚡ 3 Passos Rápidos (5 minutos)

### Passo 1: Abra o Supabase SQL Editor

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá para: **SQL Editor** → **New Query**

### Passo 2: Copie e Cole Migration 009

**Abra o arquivo:** `migrations/009_idempotency_and_versioning.sql`

Copie TODO o conteúdo e cole no Supabase SQL Editor.

Clique em **Run** (botão ▶️) ou `Ctrl+Enter`

**Esperado:**
```
✅ Query executed successfully
```

### Passo 3: Repita com Migration 010 e 011

**Para Migration 010:**
- Arquivo: `migrations/010_webhook_tracking_and_refunds.sql`
- Copie, cole, execute (Run/Ctrl+Enter)

**Para Migration 011:**
- Arquivo: `migrations/011_metrics_tables.sql`
- Copie, cole, execute (Run/Ctrl+Enter)

---

## ✅ Verificar que Funcionou

Após executar as 3 migrations, rode este comando:

```bash
cd /Users/diego/dev/ruptur-cloud/ruptur-main/saas

export SUPABASE_URL=https://seu-projeto.supabase.co
export SUPABASE_KEY=sua_chave_service_role

node verify-migrations.mjs
```

**Esperado:**
```
✅ Todas as migrations foram executadas com sucesso!
```

---

## 📍 Encontrar Sua SUPABASE_KEY

1. Abra: https://app.supabase.com
2. Vá para: **Settings** → **API**
3. Copie a **service_role** key (não a anon)

---

## 🎯 Depois de Executar as Migrations

```bash
# Rodar os testes
npm test -- tests/billing.test.js
npm test -- tests/webhook.test.js
npm test -- tests/performance.test.js
```

