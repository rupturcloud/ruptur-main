#!/usr/bin/env node
/**
 * FIX CREDENTIAL REFERENCES — P0
 *
 * Updates code to read credentials from process.env instead of warmup-state.json
 * Usage: node scripts/fix-credential-references.mjs --apply
 *
 * Dry-run mode (default):
 *   Shows what would change
 *
 * Apply mode (--apply):
 *   Actually modifies files
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const APPLY_MODE = process.argv.includes('--apply');
const FILE_PATTERNS = [
  'modules/**/*.mjs',
  'modules/**/*.js',
  'api/**/*.mjs',
  'api/**/*.js',
];

const SUBSTITUTIONS = [
  {
    name: 'Supabase Key from config',
    pattern: /state\.config\.settings\.supabaseKey\s*\|\|\s*process\.env\.VITE_SUPABASE_PUBLISHABLE_KEY/g,
    replacement: 'process.env.VITE_SUPABASE_PUBLISHABLE_KEY',
  },
  {
    name: 'Supabase Key from state',
    pattern: /state\.config\.settings\.supabaseKey/g,
    replacement: 'process.env.VITE_SUPABASE_PUBLISHABLE_KEY',
  },
  {
    name: 'UAZAPI Admin Token from config',
    pattern: /state\.config\.settings\.adminToken\s*\|\|\s*process\.env\.UAZAPI_TOKEN/g,
    replacement: 'process.env.UAZAPI_TOKEN',
  },
  {
    name: 'UAZAPI Admin Token from state',
    pattern: /state\.config\.settings\.adminToken/g,
    replacement: 'process.env.UAZAPI_TOKEN',
  },
  {
    name: 'UAZAPI Token from config',
    pattern: /settings\.uazapiToken\s*\|\|\s*process\.env\.UAZAPI_TOKEN/g,
    replacement: 'process.env.UAZAPI_TOKEN',
  },
  {
    name: 'Generic credential pattern',
    pattern: /const\s+(\w+Token)\s*=\s*state\.config\.settings\.\1/g,
    replacement: 'const $1 = process.env[`${$1.toUpperCase()}`]',
  },
];

function findFiles(pattern) {
  const files = [];
  function walk(dir) {
    try {
      for (const file of readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        const stat = require('fs').statSync(fullPath);

        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          walk(fullPath);
        } else if (
          stat.isFile() &&
          (fullPath.endsWith('.mjs') || fullPath.endsWith('.js')) &&
          !fullPath.includes('node_modules')
        ) {
          files.push(fullPath);
        }
      }
    } catch (err) {
      // ignore
    }
  }
  walk('.');
  return files;
}

console.log('\n🔧 FIX CREDENTIAL REFERENCES\n');
console.log(`Mode: ${APPLY_MODE ? '✏️  APPLY' : '👁️  DRY-RUN'}\n`);

const files = findFiles('.');
const changes = [];

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch (err) {
    continue;
  }

  let modified = false;
  let newContent = content;

  for (const sub of SUBSTITUTIONS) {
    if (sub.pattern.test(newContent)) {
      const count = (newContent.match(sub.pattern) || []).length;
      changes.push({
        file,
        pattern: sub.name,
        count,
      });

      newContent = newContent.replace(sub.pattern, sub.replacement);
      modified = true;
    }
  }

  if (modified && APPLY_MODE) {
    writeFileSync(file, newContent);
    console.log(`✅ ${file}`);
  } else if (modified) {
    console.log(`📝 ${file}`);
  }
}

if (changes.length === 0) {
  console.log('ℹ️  No credential references found to update\n');
} else {
  console.log(`\n${changes.length} file(s) need updates:\n`);
  for (const change of changes) {
    console.log(`  ${change.file}`);
    console.log(`    └─ ${change.pattern} (${change.count}x)\n`);
  }

  if (!APPLY_MODE) {
    console.log('To apply changes, run:');
    console.log('  node scripts/fix-credential-references.mjs --apply\n');
  } else {
    console.log('✅ Changes applied!\n');
    console.log('Next:');
    console.log('  1. Review: git diff');
    console.log('  2. Test:   node modules/warmup-core/server.mjs');
    console.log('  3. Commit: git add -A && git commit -m "fix: use process.env for credentials"');
    console.log('');
  }
}
