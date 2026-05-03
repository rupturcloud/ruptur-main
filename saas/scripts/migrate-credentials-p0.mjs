#!/usr/bin/env node
/**
 * MIGRATE CREDENTIALS P0
 *
 * Remove tokens from JSON files after they're in .env
 * Usage: node scripts/migrate-credentials-p0.mjs
 *
 * REQUIRES: Your .env already has UAZAPI_TOKEN and SUPABASE_KEY
 *
 * Does:
 * 1. Reads runtime-data/warmup-state.json
 * 2. Backs it up
 * 3. Removes sensitive fields
 * 4. Verifies with security-check.mjs
 */

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const STATE_FILE = path.resolve(process.cwd(), 'runtime-data/warmup-state.json');
const BACKUP_FILE = `${STATE_FILE}.backup`;

console.log('\n🔐 CREDENTIAL MIGRATION — P0\n');

// Step 1: Verify .env has credentials
console.log('Step 1: Verifying .env has credentials...');
try {
  const env = readFileSync('.env', 'utf8');
  const hasUazapiToken = /UAZAPI_TOKEN\s*=\s*[a-zA-Z0-9_-]+/.test(env);
  const hasSupabaseKey = /VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*eyJ/.test(env);

  if (!hasUazapiToken) {
    console.error('❌ .env missing UAZAPI_TOKEN');
    console.error('   Please add: UAZAPI_TOKEN={your_token}');
    process.exit(1);
  }
  if (!hasSupabaseKey) {
    console.error('❌ .env missing VITE_SUPABASE_PUBLISHABLE_KEY');
    console.error('   Please add: VITE_SUPABASE_PUBLISHABLE_KEY={your_key}');
    process.exit(1);
  }
  console.log('✅ .env has both UAZAPI_TOKEN and VITE_SUPABASE_PUBLISHABLE_KEY');
} catch (err) {
  console.error('❌ Cannot read .env');
  process.exit(1);
}

// Step 2: Backup warmup-state.json
console.log('\nStep 2: Backing up warmup-state.json...');
try {
  copyFileSync(STATE_FILE, BACKUP_FILE);
  console.log(`✅ Backup created: ${BACKUP_FILE}`);
} catch (err) {
  console.error(`❌ Cannot backup file: ${err.message}`);
  process.exit(1);
}

// Step 3: Load and sanitize JSON
console.log('\nStep 3: Removing sensitive fields from warmup-state.json...');
let state;
try {
  state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
} catch (err) {
  console.error(`❌ Cannot parse JSON: ${err.message}`);
  process.exit(1);
}

const fieldsToRemove = ['supabaseKey', 'adminToken', 'uazapiToken', 'apiSecret'];
const removed = [];

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return;

  for (const field of fieldsToRemove) {
    if (field in obj) {
      removed.push(field);
      delete obj[field];
    }
  }

  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  }
}

sanitizeObject(state);

if (removed.length === 0) {
  console.log('ℹ️  No sensitive fields found to remove');
} else {
  console.log(`✅ Removed ${removed.length} field(s): ${removed.join(', ')}`);
}

// Step 4: Write sanitized JSON
console.log('\nStep 4: Writing sanitized warmup-state.json...');
try {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  console.log('✅ File updated');
} catch (err) {
  console.error(`❌ Cannot write file: ${err.message}`);
  process.exit(1);
}

// Step 5: Verify with security check
console.log('\nStep 5: Running security check...');
try {
  execSync('node scripts/security-check.mjs', { stdio: 'inherit' });
  console.log('\n✅ Security check passed!');
} catch (err) {
  console.warn('\n⚠️  Some security findings remain (expected if hardcoded in code)');
  console.warn('    Next step: Run scripts/fix-credential-references.mjs');
}

// Step 6: Summary
console.log('\n' + '='.repeat(60));
console.log('✅ CREDENTIAL MIGRATION COMPLETE\n');
console.log('Backup:');
console.log(`  ${BACKUP_FILE}\n`);
console.log('Next steps:');
console.log('1. Verify changes: git diff runtime-data/warmup-state.json');
console.log('2. Fix code refs:  node scripts/fix-credential-references.mjs');
console.log('3. Test server:    node modules/warmup-core/server.mjs');
console.log('4. Commit:         git add -A && git commit -m "fix: move credentials to .env"');
console.log('5. Clean history:  See CREDENTIAL_MIGRATION_P0.md STEP 6');
console.log('\n');
