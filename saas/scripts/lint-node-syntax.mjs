#!/usr/bin/env node
/**
 * Validação sintática rápida dos arquivos Node.js do projeto.
 *
 * Mantém fora do escopo: dependências, bundles, artefatos, frontend JSX e arquivos
 * gerados. A intenção é capturar erro de parse antes do build/deploy.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
  '.git',
  '.github',
  '.claude',
  'node_modules',
  'dist',
  'dist-client',
  'coverage',
  'playwright-report',
  'test-results',
  'tmp',
  'artifacts',
]);

const EXCLUDED_PREFIXES = [
  'web/client-area/src/',
  'web/client-area/dist/',
  'web/client-area/node_modules/',
  'web/client-area/coverage/',
];

function shouldSkipFile(path) {
  const rel = relative(ROOT, path).replaceAll('\\\\', '/');
  if (EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
  if (rel.endsWith('.config.js')) return false;
  return !(rel.endsWith('.js') || rel.endsWith('.mjs'));
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (!shouldSkipFile(full)) files.push(full);
  }
  return files;
}

const files = walk(ROOT).sort();
const failures = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push({ file: rel, stderr: result.stderr || result.stdout });
  }
}

if (failures.length > 0) {
  console.error(`❌ Falha de sintaxe em ${failures.length} arquivo(s):`);
  for (const failure of failures) {
    console.error(`\n--- ${failure.file} ---`);
    console.error(failure.stderr.trim());
  }
  process.exit(1);
}

console.log(`✅ Sintaxe Node.js validada em ${files.length} arquivo(s).`);
