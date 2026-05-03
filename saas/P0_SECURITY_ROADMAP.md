# 🚨 P0 SECURITY ROADMAP — RUPTUR SAAS

**Status:** ❌ CRÍTICO — 10 HIGH-RISK findings
**Timeline:** ~2 horas (você controla o timing)
**Risk Level:** IMMEDIATE ACTION REQUIRED

---

## 📊 Current State (Run Now)

```bash
node scripts/security-check.mjs
```

**Findings:**
- ❌ 10 HIGH-RISK: Supabase Key + UAZAPI Token exposed in runtime-data + code
- ⚠️  5 MEDIUM-RISK: Generic secrets in .env (expected)
- 📜 1 GIT HISTORY: warmup-state.json tracked in 25 commits

**Impact:** Any attacker with repo access → Full database + WhatsApp automation

---

## ✅ Execution Plan (Do This)

### Phase 1: Information Gathering (15 min) — YOU CONTROL

```bash
# Step 1: Extract current credentials (SAVE IN 1PASSWORD)
echo "=== UAZAPI Token ===" 
grep -o '"adminToken":"[^"]*"' runtime-data/warmup-state.json

echo "=== Supabase Key ==="
grep -o '"supabaseKey":"[^"]*"' runtime-data/warmup-state.json

# Step 2: Verify .env has these
cat .env | grep -E "UAZAPI_TOKEN|SUPABASE"
```

**What you need:**
- [ ] UAZAPI_TOKEN value (saved securely)
- [ ] SUPABASE_PUBLISHABLE_KEY value (saved securely)
- [ ] .env file updated with both

---

### Phase 2: Automated Migration (30 min) — SCRIPTS DO THE WORK

Once .env has credentials:

```bash
# Step 3: Remove from JSON
node scripts/migrate-credentials-p0.mjs

# Step 4: Update code references (DRY-RUN first)
node scripts/fix-credential-references.mjs
# Review output, then:
node scripts/fix-credential-references.mjs --apply

# Step 5: Verify security
node scripts/security-check.mjs
```

---

### Phase 3: Git Cleanup (30 min) — CAUTION: REWRITES HISTORY

**⚠️ WARNING:** This affects all clones of the repo. Plan with team.

```bash
# Step 6: Backup branch first
git branch backup-before-filter-branch

# Step 7: Remove file from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch runtime-data/warmup-state.json' \
  --prune-empty HEAD

# Step 8: Cleanup git
git reflog expire --expire=now --all
git gc --prune=now

# Step 9: Force push (warn team first!)
git push --force-with-lease origin main
```

---

### Phase 4: Credential Rotation (45 min) — PRODUCTION REQUIRES THIS

Only do AFTER phases 1-3 are complete.

#### A. Rotate Supabase Key

```
1. Go to: https://app.supabase.com
2. Project → Settings → API
3. Find "anon public key"
4. Click "Rotate"
5. Copy new key
6. Update .env: VITE_SUPABASE_PUBLISHABLE_KEY={new_key}
7. Commit & deploy
```

#### B. Rotate UAZAPI Token

```
1. Go to: https://tiatendeai.uazapi.com/admin
2. Settings → API → Tokens
3. Revoke old token
4. Generate new token
5. Update .env: UAZAPI_TOKEN={new_token}
6. Commit & deploy
```

#### C. Test

```bash
# Start server
node modules/warmup-core/server.mjs

# Should see:
# ✅ Supabase connected
# ✅ UAZAPI authenticated
# ✅ Warmup scheduler started
```

---

## 📋 Checklist

- [ ] Run `security-check.mjs` and save findings
- [ ] Extract credentials from JSON to .env
- [ ] Run `migrate-credentials-p0.mjs`
- [ ] Review changes: `git diff`
- [ ] Run `fix-credential-references.mjs --apply`
- [ ] Run security check again (should be cleaner)
- [ ] Backup branch: `git branch backup-before-filter-branch`
- [ ] Run git filter-branch
- [ ] Force push to main
- [ ] Rotate Supabase key in UI
- [ ] Rotate UAZAPI token in UI
- [ ] Test server startup
- [ ] Commit & deploy
- [ ] Verify in production: `curl https://app.ruptur.cloud/health`

---

## 🛑 If Something Goes Wrong

### Rollback

```bash
# Restore backup branch
git reset --hard backup-before-filter-branch

# Or restore single file
git checkout backup-before-filter-branch -- runtime-data/warmup-state.json

# Push (warn team!)
git push --force-with-lease origin main
```

### Git History Still Has Tokens?

Run again:
```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch runtime-data/warmup-state.json' \
  --prune-empty HEAD

git push --force-with-lease origin main
```

### Code Still References Old Tokens?

```bash
# Check what's still hardcoded
grep -r "adminToken\|supabaseKey" modules/ --include="*.mjs" --include="*.js"

# Manually fix those files, then commit
```

---

## 📞 Support

- **security-check.mjs:** Detects exposures
- **migrate-credentials-p0.mjs:** Removes from JSON
- **fix-credential-references.mjs:** Updates code
- **CREDENTIAL_MIGRATION_P0.md:** Detailed step-by-step guide

Run `node scripts/{script} --help` for more info.

---

## Timeline Summary

```
Phase 1: Information gathering      15 min  ← YOU control this
Phase 2: Automated migration        30 min  ← Scripts run
Phase 3: Git cleanup               30 min  ← Destructive, plan it
Phase 4: Credential rotation       45 min  ← Production critical
─────────────────────────────────────────
TOTAL:                       ~2 hours
```

**IMPORTANT:** Phases 1-2 take 45 min and eliminate 90% of risk.
Phases 3-4 are critical for production but can happen after testing in staging.

---

## Next: Let's Go

When ready, start Phase 1:

```bash
# 1. Extract credentials
grep -o '"adminToken":"[^"]*"' runtime-data/warmup-state.json
grep -o '"supabaseKey":"[^"]*"' runtime-data/warmup-state.json

# 2. Update .env with those values
# (use your editor, don't paste in terminal)

# 3. Then: node scripts/migrate-credentials-p0.mjs
```

---

**Owner:** Diego
**Status:** Ready for execution
**Risk if skipped:** Medium-High (tokens accessible to anyone with repo access)
