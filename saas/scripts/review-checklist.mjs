#!/usr/bin/env node
/**
 * Checklist automatizado de code review para o Ruptur SaaS.
 *
 * Não substitui revisão humana. Ele aponta riscos comuns antes de commit/deploy:
 * - arquivos sensíveis modificados
 * - segredos aparentes em arquivos versionados
 * - migrações sem documentação de rollback
 * - bundle antigo referenciado no HTML
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

const status = run('git', ['status', '--short']);
const changed = status.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.replace(/^..\s+/, ''));

const warnings = [];
const blockers = [];

const sensitiveFiles = changed.filter((file) => /(^|\/)(\.env|\.env\.|service-account|credentials|secret|private-key)/i.test(file));
if (sensitiveFiles.length > 0) {
  blockers.push(`Arquivos sensíveis alterados/versionados: ${sensitiveFiles.join(', ')}`);
}

const secretPattern = /(client_secret|admin_token|private_key|secret_key|access_token)\s*[:=]\s*['\"]?[A-Za-z0-9_\-./+=]{24,}/i;
for (const file of changed) {
  if (!existsSync(file)) continue;
  if (/^(dist-client|node_modules|coverage|\.git)\//.test(file)) continue;
  try {
    const content = readFileSync(file, 'utf8');
    if (secretPattern.test(content)) {
      blockers.push(`Possível segredo literal encontrado em ${file}. Use .env/secret manager e masque logs.`);
    }
  } catch {
    // ignora arquivos binários
  }
}

const migrationChanges = changed.filter((file) => file.startsWith('migrations/') && file.endsWith('.sql'));
if (migrationChanges.length > 0) {
  warnings.push(`Migrações alteradas: confirme idempotência, RLS, índices, rollback e aplicação em staging: ${migrationChanges.join(', ')}`);
}

if (existsSync('dist-client/index.html')) {
  const html = readFileSync('dist-client/index.html', 'utf8');
  const match = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  if (match) {
    const asset = join('dist-client/assets', match[1]);
    if (!existsSync(asset)) blockers.push(`dist-client/index.html referencia ${match[1]}, mas o arquivo não existe.`);
  }
}

const jsAssets = existsSync('dist-client/assets')
  ? readdirSync('dist-client/assets').filter((name) => /^index-.*\.js$/.test(name))
  : [];
if (jsAssets.length > 2) {
  warnings.push(`Há ${jsAssets.length} bundles JS em dist-client/assets. Verifique limpeza de artefatos antigos antes do deploy.`);
}

console.log('🔎 Review automatizada Ruptur SaaS');
console.log(`Arquivos alterados: ${changed.length || 0}`);

if (warnings.length > 0) {
  console.log('\n⚠️  Avisos:');
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (blockers.length > 0) {
  console.error('\n❌ Bloqueios:');
  for (const blocker of blockers) console.error(`- ${blocker}`);
  process.exit(1);
}

console.log('\n✅ Checklist automatizado sem bloqueios.');
