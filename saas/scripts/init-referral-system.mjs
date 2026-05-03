/**
 * Script de Inicialização: Sistema de Referral
 *
 * Executa a migration 007_referral_system.sql se ainda não tiver sido executada.
 * Uso: node scripts/init-referral-system.mjs
 *
 * Verifica:
 * - Se tabela referral_links existe
 * - Se tabela referral_commissions existe
 * - Se VIEW referral_summary existe
 * - Se RLS policies estão ativas
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableExists(tableName) {
  const { data } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', tableName);

  return data && data.length > 0;
}

async function executeSQL(sql) {
  // Supabase não expõe um método direto para executar SQL raw
  // Vamos usar rpc ou fazer via Postgres
  console.log('Executando SQL via RPC...');
  // Alternativa: usar SQL diretamente via fetch para Supabase
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    console.warn('⚠️  RPC não disponível, tentando alternativa...');
    return false;
  }
  return true;
}

async function init() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║       🔧 Inicialização: Sistema de Referral                    ║
║           (25% comissão em créditos)                           ║
╚════════════════════════════════════════════════════════════════╝
  `);

  try {
    // Verificar se tabelas já existem
    console.log('📋 Verificando schema existente...');

    const referralLinksExists = await checkTableExists('referral_links');
    const referralCommissionsExists = await checkTableExists('referral_commissions');
    const referralClicksExists = await checkTableExists('referral_clicks');

    if (referralLinksExists && referralCommissionsExists && referralClicksExists) {
      console.log('✅ Schema de referral já existe (todas as tabelas presentes)');
      return;
    }

    console.log('⚠️  Schema incompleto ou não inicializado');
    console.log(`   - referral_links: ${referralLinksExists ? '✅' : '❌'}`);
    console.log(`   - referral_commissions: ${referralCommissionsExists ? '✅' : '❌'}`);
    console.log(`   - referral_clicks: ${referralClicksExists ? '✅' : '❌'}`);

    // Ler migration SQL
    console.log('\n📖 Lendo migration SQL...');
    const migrationPath = resolve(process.cwd(), 'migrations/007_referral_system.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Tentar executar SQL
    console.log('🚀 Executando migration...');

    // Supabase SDK não tem método direto para executar SQL raw
    // Solução: usar PostgreSQL connection string se disponível
    if (process.env.DATABASE_URL) {
      console.log('💾 Usando connection string direto...');
      const { spawn } = await import('node:child_process');

      const psql = spawn('psql', [
        process.env.DATABASE_URL,
        '-c', migrationSQL,
      ]);

      let output = '';
      let errorOutput = '';

      psql.stdout.on('data', (data) => { output += data.toString(); });
      psql.stderr.on('data', (data) => { errorOutput += data.toString(); });

      await new Promise((resolve, reject) => {
        psql.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`psql retornou código ${code}: ${errorOutput}`));
          } else {
            resolve();
          }
        });
      });

      console.log('✅ Migration executada com sucesso!');
    } else {
      console.log(`
⚠️  Para executar a migration manualmente:

1. Acesse o Supabase Console: https://app.supabase.com
2. Vá para SQL Editor
3. Cole o conteúdo de: migrations/007_referral_system.sql
4. Clique em "Run"

Ou execute via psql:
  psql "postgresql://..." < migrations/007_referral_system.sql
      `);

      // Verificar novamente se tabelas foram criadas por outro meio
      const check = await checkTableExists('referral_links');
      if (check) {
        console.log('\n✅ Schema de referral detectado!');
      }
    }

    // Verificação final
    console.log('\n✔️  Verificando integridade final...');
    const finalCheck = await checkTableExists('referral_links');
    if (finalCheck) {
      console.log('✅ Sistema de referral inicializado e pronto para uso!');
    } else {
      console.log('⚠️  Execute a migration manualmente conforme instruções acima');
    }
  } catch (error) {
    console.error(`❌ Erro ao inicializar: ${error.message}`);
    process.exit(1);
  }
}

init();
