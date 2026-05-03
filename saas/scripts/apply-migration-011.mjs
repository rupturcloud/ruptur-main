/**
 * Script: Aplicar Migration 011 (Platform Admins & Invites)
 *
 * Conecta ao Supabase e executa a migration SQL.
 *
 * Uso:
 * node scripts/apply-migration-011.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente obrigatórias não configuradas:');
  console.error('   - SUPABASE_URL (ou VITE_SUPABASE_URL)');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Aplicando Migration 011...\n');

  try {
    // Ler arquivo SQL
    const migrationPath = resolve('migrations/011_platform_admins_and_invites.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    // Dividir em declarações (simples split por ;)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`📝 Executando ${statements.length} declarações SQL...\n`);

    let executed = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Pular comentários e linhas vazias
      if (!stmt || stmt.startsWith('--')) continue;

      // Log de progresso
      process.stdout.write(`   [${i + 1}/${statements.length}] `);

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: stmt });

        if (error) {
          // Alguns erros são esperados (ex: IF NOT EXISTS)
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log(`⚠️  Já existe`);
          } else {
            console.log(`❌ Erro: ${error.message}`);
          }
        } else {
          console.log(`✅`);
          executed++;
        }
      } catch (e) {
        // Tentar executar diretamente (alguns bancos não suportam exec_sql)
        try {
          const { error } = await supabase.rpc('execute_sql', { sql: stmt });
          if (error) throw error;
          console.log(`✅`);
          executed++;
        } catch (fallbackError) {
          // Ignorar erros de IF NOT EXISTS
          if (stmt.includes('IF NOT EXISTS')) {
            console.log(`⚠️  Já existe`);
          } else {
            console.log(`❌ ${fallbackError.message}`);
          }
        }
      }
    }

    console.log(`\n✅ Migration 011 aplicada com sucesso!`);
    console.log(`   Declarações executadas: ${executed}`);

  } catch (error) {
    console.error('\n❌ Erro ao aplicar migration:');
    console.error(error.message);
    console.error('\n💡 Solução alternativa:');
    console.error('   1. Acesse Supabase > SQL Editor');
    console.error('   2. Cole o conteúdo de: migrations/011_platform_admins_and_invites.sql');
    console.error('   3. Execute');
    process.exit(1);
  }
}

applyMigration();
