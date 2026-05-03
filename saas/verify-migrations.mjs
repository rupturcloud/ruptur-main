import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

if (!SUPABASE_KEY) {
  console.error('❌ Erro: SUPABASE_KEY não definida');
  console.error('Configure com: export SUPABASE_KEY=sua_chave');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const expectedTables = {
  '009': ['payments', 'wallets', 'webhook_delivery_log'],
  '010': ['webhook_events', 'refunds'],
  '011': ['webhook_metrics', 'payment_metrics', 'aggregated_metrics']
};

async function checkTable(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('1')
      .limit(1);
    return !error;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log('🔍 Verificando migrations...');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`);

  const results = {};
  let allExecuted = true;

  for (const [migration, tables] of Object.entries(expectedTables)) {
    console.log(`\n⏳ Migration ${migration}:`);
    const migrationResults = {};

    for (const table of tables) {
      const exists = await checkTable(table);
      migrationResults[table] = exists;

      const status = exists ? '✅' : '❌';
      console.log(`  ${status} ${table}`);

      if (!exists) allExecuted = false;
    }

    results[migration] = migrationResults;
  }

  console.log('\n' + '='.repeat(50));

  if (allExecuted) {
    console.log('✅ Todas as migrations foram executadas com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('1. npm test -- tests/billing.test.js');
    console.log('2. npm test -- tests/webhook.test.js');
    console.log('3. npm test -- tests/performance.test.js');
  } else {
    console.log('❌ Algumas tabelas não foram criadas.');
    console.log('\n📝 Execute as migrations manualmente:');
    console.log('1. Abra console.supabase.com → SQL Editor');
    console.log('2. Execute migrations/009_idempotency_and_versioning.sql');
    console.log('3. Execute migrations/010_webhook_tracking_and_refunds.sql');
    console.log('4. Execute migrations/011_metrics_tables.sql');
  }

  process.exit(allExecuted ? 0 : 1);
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
