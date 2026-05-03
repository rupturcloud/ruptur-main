#!/usr/bin/env node

/**
 * Script: Aplicar Migration 011 via Postgres
 *
 * Conecta direto ao Supabase Postgres e executa SQL
 *
 * Uso:
 * node scripts/apply-migration-pg.mjs
 */

import pkg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

const { Client } = pkg;

dotenv.config();

// Extrair credenciais Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  process.exit(1);
}

// Parse URL Supabase: https://xxxx.supabase.co → xxxx.supabase.co
const urlMatch = supabaseUrl.match(/https?:\/\/([^/]+)/);
const host = urlMatch ? urlMatch[1] : supabaseUrl;

// Connection string
const connectionString = `postgres://postgres:${supabaseServiceKey}@${host}:5432/postgres`;

async function applyMigration() {
  console.log('🚀 Aplicando Migration 011 via Postgres...\n');

  const client = new Client({ connectionString });

  try {
    console.log('🔌 Conectando ao Supabase...');
    await client.connect();
    console.log('✅ Conectado!\n');

    // Ler SQL
    const migrationPath = resolve('migrations/011_platform_admins_and_invites.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executando SQL...\n');

    // Executar query completa
    await client.query(sql);

    console.log('✅ Migration 011 aplicada com sucesso!\n');

    // Verificar se as tabelas foram criadas
    const { rows } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('platform_admins', 'platform_admin_invites')
    `);

    if (rows.length >= 2) {
      console.log('✅ Tabelas criadas:');
      rows.forEach(r => console.log(`   • ${r.table_name}`));
    } else {
      console.log('⚠️  Tabelas não encontradas. Verifique a migration.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.detail) {
      console.error('   Detalhe:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('');
  }
}

applyMigration();
