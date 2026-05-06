# 🔐 CREDENTIAL MIGRATION — P0 SECURITY FIX

**Status:** ❌ CRÍTICO — 10 HIGH RISK findings
**Timeline:** 4 horas
**Owner:** Diego (você tem credenciais reais)

---

## STEP 1: Extract Current Tokens (Seu Controle)

### ⚠️ **Importante:** Você precisa fazer isso manualmente porque são credenciais REAIS

Rode este comando e **guarde a saída em um lugar seguro** (1Password, LastPass, etc):

```bash
# Extrair UAZAPI Token
grep -o '"adminToken":"[^"]*"' runtime-data/warmup-state.json

# Extrair Supabase Anon Key
grep -o '"supabaseKey":"[^"]*"' runtime-data/warmup-state.json

# Extrair do .env atual (para backup)
cat .env | grep -E "SUPABASE|UAZAPI|GETNET"
```

**Salve em um arquivo temporário seguro:**
```bash
# Copie para um editor seguro (não commit isso!)
# Exemplo structure:
# UAZAPI_ADMIN_TOKEN=UmiLwsiyjN01ipt5XuaU97vC4PTyPwHfhFN15CyHvJklANTzGX
# VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## STEP 2: Update .env (Você faz manualmente)

Edite seu `.env` atual e adicione/confirme:

```env
# === UAZAPI Configuration ===
UAZAPI_BASE_URL=https://tiatendeai.uazapi.com
UAZAPI_TOKEN={COLE_O_TOKEN_AQUI}
WARMUP_ADMIN_TOKEN={MESMO_TOKEN}
WARMUP_SERVER_URL=https://tiatendeai.uazapi.com

# === Supabase ===
VITE_SUPABASE_URL=https://axrwlboyowoskdxeogba.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY={COLE_A_KEY_AQUI}
SUPABASE_SERVICE_ROLE_KEY={SE_TIVER_ROLE_KEY}
```

✅ **Verificar:** `cat .env | grep -E "UAZAPI|SUPABASE"` deve mostrar valores reais

---

## STEP 3: Remove Credentials from JSON Files (Você roda o script)

Execute este script para **remover tokens dos arquivos JSON**:

```bash
node scripts/migrate-credentials-p0.mjs
```

O que faz:
- ✅ Lê `warmup-state.json`
- ✅ Remove `supabaseKey` e `adminToken`
- ✅ Salva backup em `runtime-data/warmup-state.json.backup`
- ✅ Atualiza arquivo com valores vazios

**Verificar resultado:**
```bash
# Deve estar vazio agora
grep -i "token\|key" runtime-data/warmup-state.json | grep -v "false\|true"
```

---

## STEP 4: Update Code References (Automático)

O código precisa LER tokens do `.env` em vez de `warmup-state.json`.

**Status atual:** `modules/warmup-core/server.mjs` lê de ambos os lugares
**Status necessário:** Ler APENAS de `process.env` ou `.env`

Script a rodar:
```bash
node scripts/fix-credential-references.mjs
```

Vai:
- ✅ Atualizar server.mjs para usar `process.env.SUPABASE_KEY`
- ✅ Remover hardcoded refs em modules/
- ✅ Criar relatório de mudanças

---

## STEP 5: Add to .gitignore (Automático)

```bash
# Verificar que runtime-data/warmup-state.json está em .gitignore
grep "warmup-state.json\|runtime-data" .gitignore

# Se não estiver, adicione:
echo "runtime-data/warmup-state.json" >> .gitignore
```

---

## STEP 6: Clean Git History (⚠️ Destrutivo)

**AVISO:** Este passo **reescreve git history**. Faça backup primeiro.

```bash
# Backup local
git branch backup-before-filter-branch

# Remove arquivo do histórico
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch runtime-data/warmup-state.json' \
  --prune-empty HEAD

# Limpa reflogs
git reflog expire --expire=now --all
git gc --prune=now

# Force push (cuidado — afeta todos que clonaram)
git push --force-with-lease origin main
```

---

## STEP 7: Rotate Credentials (Supabase + UAZAPI)

**Depois que tudo acima está done, IMEDIATAMENTE:**

### A. Rotate Supabase Keys

1. Login em https://app.supabase.com
2. Projeto → Settings → API
3. **Anon/Public Key** → Click "Rotate"
4. Copie nova key
5. Atualize `.env`:
   ```
   VITE_SUPABASE_PUBLISHABLE_KEY={NOVA_KEY}
   ```

### B. Rotate UAZAPI Token

1. Login em https://tiatendeai.uazapi.com
2. Admin Settings → API Keys
3. Gere novo token
4. Retire token antigo
5. Atualize `.env`:
   ```
   UAZAPI_TOKEN={NOVO_TOKEN}
   WARMUP_ADMIN_TOKEN={NOVO_TOKEN}
   ```

---

## STEP 8: Test (Seu Controle)

```bash
# Verificar que server inicia sem erros
node modules/warmup-core/server.mjs

# Deve listar:
# ✅ Supabase connected
# ✅ Warmup scheduler started
# ✅ Listening on :8787
```

---

## STEP 9: Deploy (Seu Controle)

```bash
# Review changes
git status
git diff --cached

# Commit
git add -A
git commit -m "fix: move credentials from JSON to .env, remove from git history

- Extract UAZAPI_TOKEN and SUPABASE_KEY to .env
- Remove sensitive data from runtime-data/warmup-state.json
- Update code to read from process.env
- Add runtime-data/warmup-state.json to .gitignore
- Cleaned git history with filter-branch

SECURITY: All credentials have been rotated.
No sensitive data remains in git history."

# Push
git push origin main

# Monitor logs
tail -f logs/warmup.log
```

---

## Verification Checklist

```
[ ] .env has UAZAPI_TOKEN and SUPABASE_KEY
[ ] runtime-data/warmup-state.json has empty/placeholder values
[ ] No JWT tokens visible in server.mjs
[ ] runtime-data/* is in .gitignore
[ ] server starts without "credential" errors
[ ] Git history cleaned (25 commits → clean)
[ ] New credentials rotated in Supabase + UAZAPI
[ ] security-check.mjs returns exit code 0
```

---

## Rollback (Se algo der errado)

```bash
# Restore from backup branch
git checkout backup-before-filter-branch

# Or restore file
git checkout HEAD runtime-data/warmup-state.json

# Re-apply old credentials if needed
cat runtime-data/warmup-state.json.backup | jq '.config.settings'
```

---

## Timeline Estimate

```
1. Extract tokens:           15 min (manual)
2. Update .env:              5 min (manual)
3. Run migration scripts:    10 min (automated)
4. Verify git history:       10 min (manual verification)
5. Rotate credentials:       30 min (Supabase + UAZAPI UIs)
6. Test & deploy:           15 min
7. Monitor:                  ongoing
────────────────────────────────
TOTAL:                       ~85 minutes (1h 25min)
```

---

## Q&A

**Q: Por que não automático?**
A: Credenciais REAIS não devem ser automáticas. Você controla quando rotaciona, onde salva, etc.

**Q: E se eu fizer git filter-branch errado?**
A: Você tem `backup-before-filter-branch` branch. Recuper com:
```bash
git checkout backup-before-filter-branch
git push --force origin main:main
```

**Q: Preciso avisar meus devs?**
A: SIM. Quando você fizer `git push --force-with-lease`, todos precisam:
```bash
git fetch origin
git reset --hard origin/main
```

**Q: E produção?**
A: Deploy automáticamente lê `.env` (CI/CD copia `.env.production`). Depois que você rotaciona credenciais em Supabase + UAZAPI, produção continuará funcionando porque:
1. Code lê de `process.env`
2. Deployment tem `.env` atualizado
3. Novos tokens funcionam

---

**Status:** 🔴 PENDENTE — Aguardando sua execução manual dos steps 1-2

**Próximo:** Quando terminar steps 1-2, rode:
```bash
node scripts/migrate-credentials-p0.mjs
```
