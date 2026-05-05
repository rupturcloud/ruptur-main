#!/usr/bin/env node
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'migrations');
const targetDir = path.join(root, 'supabase', 'migrations');

// Ordem canônica para a Supabase CLI. Mantém os SQLs legados intactos em /migrations,
// mas materializa nomes versionados únicos no formato esperado pela CLI.
const migrations = [
  ['20260505000100', '002_tenants_and_users.sql'],
  ['20260505000200', '003_wallet_transactions.sql'],
  ['20260505000300', '008_audit_logs_and_rbac.sql'],
  ['20260505000400', '001_instance_registry.sql'],
  ['20260505000500', '004_plans_and_subscriptions.sql'],
  ['20260505000600', '006_migrate_to_getnet.sql'],
  ['20260505000700', '003_grace_period_cancellation.sql'],
  ['20260505000800', '005_campaigns.sql'],
  ['20260505000900', '007_referral_system.sql'],
  ['20260505001000', '009_idempotency_and_versioning.sql'],
  ['20260505001100', '009_secrets_vault.sql'],
  ['20260505001200', '010_webhook_tracking_and_refunds.sql'],
  ['20260505001300', '011_platform_admins_and_invites.sql'],
  ['20260505001400', '012_provider_accounts_and_leases.sql'],
  ['20260505001500', '013_payment_gateway_accounts.sql'],
];

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });

const bootstrapName = '20260505000000_bootstrap_helpers.sql';
await writeFile(path.join(targetDir, bootstrapName), `-- Helpers globais exigidos por migrations legadas.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`);

const lines = [
  '# Migrations geradas para Supabase CLI',
  '',
  'Estes arquivos foram materializados a partir de `/migrations` por:',
  '',
  '```bash',
  'npm run supabase:prepare',
  '```',
  '',
  'Não edite estes SQLs duplicados sem também atualizar a fonte em `/migrations`.',
  '',
  `- ${bootstrapName} ← gerada por scripts/supabase-prepare-cli.mjs`,
];

for (const [version, file] of migrations) {
  const source = path.join(sourceDir, file);
  const basename = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
  const targetName = `${version}_${basename}.sql`;
  await copyFile(source, path.join(targetDir, targetName));
  lines.push(`- ${targetName} ← migrations/${file}`);
}

await writeFile(path.join(root, 'supabase', 'MIGRATIONS.md'), `${lines.join('\n')}\n`);
console.log(`Supabase CLI migrations preparadas em ${path.relative(root, targetDir)} (${migrations.length} arquivos).`);
