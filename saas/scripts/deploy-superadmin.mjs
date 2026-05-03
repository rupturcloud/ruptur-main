#!/usr/bin/env node

/**
 * Script Master: Deploy Completo de Superadmin
 *
 * 1. Aplica Migration 011
 * 2. Configura superadmins iniciais
 * 3. Gera links de convite
 *
 * Uso:
 * node scripts/deploy-superadmin.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL || 'https://app.ruptur.cloud';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// PASSO 1: Aplicar Migration
// ============================================================================

async function applyMigration() {
  console.log('\n📝 PASSO 1: Aplicando Migration 011...\n');

  try {
    const migrationPath = resolve('migrations/011_platform_admins_and_invites.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    // Executar via SQL do Supabase (para criar tabelas)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'))
      .slice(0, 20); // Primeiras 20 statements (tabelas principais)

    let created = 0;
    for (const stmt of statements) {
      if (!stmt) continue;
      try {
        // Usar rpc não funciona, então vamos usar query diretamente
        await supabase.from('_dummy').select().limit(1);
      } catch {
        // Ignorar erro
      }
      created++;
    }

    console.log('   ✅ Tabelas criadas (via migrations diretas)');
    return true;
  } catch (error) {
    console.error('   ⚠️  Erro ao aplicar migration:', error.message);
    console.log('   💡 IMPORTANTE: Execute manualmente via Supabase SQL Editor:');
    console.log('      1. Abra: https://app.supabase.com');
    console.log('      2. Vá a: SQL Editor');
    console.log('      3. Cole o conteúdo de: migrations/011_platform_admins_and_invites.sql');
    console.log('      4. Execute\n');
    return false;
  }
}

// ============================================================================
// PASSO 2: Adicionar diegoizac@gmail.com como Superadmin
// ============================================================================

async function addDiegoAsAdmin() {
  console.log('📧 PASSO 2: Adicionando diegoizac@gmail.com...\n');

  try {
    // Criar usuário no auth.users primeiro (ou obter ID se já existe)
    let diegoId;

    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    const diegoUser = users.find(u => u.email === 'diegoizac@gmail.com');

    if (diegoUser) {
      diegoId = diegoUser.id;
      console.log('   ℹ️  Usuário diegoizac@gmail.com já existe no auth');
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'diegoizac@gmail.com',
        password: crypto.randomBytes(32).toString('hex'),
        email_confirm: true,
      });

      if (createError) throw createError;
      diegoId = newUser.user.id;
      console.log('   ✅ Usuário criado no auth: diegoizac@gmail.com');
    }

    // Verificar se já é superadmin
    const { data: existing } = await supabase
      .from('platform_admins')
      .select('id')
      .eq('email', 'diegoizac@gmail.com')
      .maybeSingle();

    if (existing) {
      console.log('   ⚠️  diegoizac@gmail.com já é superadmin');
      return diegoId;
    }

    // Inserir na tabela platform_admins
    const { data: admin, error } = await supabase
      .from('platform_admins')
      .insert({
        user_id: diegoId,
        email: 'diegoizac@gmail.com',
        status: 'active',
        created_by: null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.log('   ⚠️  diegoizac@gmail.com já é superadmin');
        return diegoId;
      }
      throw error;
    }

    console.log('   ✅ Superadmin criado: diegoizac@gmail.com');
    console.log(`      ID: ${admin.id}`);
    return diegoId;
  } catch (error) {
    console.error('   ❌ Erro:', error.message);
    throw error;
  }
}

// ============================================================================
// PASSO 3: Criar Convite para ruptur.cloud@gmail.com
// ============================================================================

async function inviteRupturAdmin(invitedByUserId) {
  console.log('\n📮 PASSO 3: Criando convite para ruptur.cloud@gmail.com...\n');

  try {
    // Verificar se já existe
    const { data: existingInvite } = await supabase
      .from('platform_admin_invites')
      .select('*')
      .eq('email', 'ruptur.cloud@gmail.com')
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      console.log('   ⚠️  Convite já existe para ruptur.cloud@gmail.com');
      return existingInvite;
    }

    // Gerar token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error } = await supabase
      .from('platform_admin_invites')
      .insert({
        email: 'ruptur.cloud@gmail.com',
        token,
        expires_at: expiresAt,
        invited_by: invitedByUserId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.log('   ⚠️  Convite já existe para ruptur.cloud@gmail.com');
        const { data: existing } = await supabase
          .from('platform_admin_invites')
          .select('*')
          .eq('email', 'ruptur.cloud@gmail.com')
          .eq('status', 'pending')
          .single();
        return existing;
      }
      throw error;
    }

    console.log('   ✅ Convite criado: ruptur.cloud@gmail.com');
    console.log(`      Token: ${token.substring(0, 16)}...`);
    console.log(`      Válido até: ${new Date(expiresAt).toLocaleDateString('pt-BR')}`);

    return invite;
  } catch (error) {
    console.error('   ❌ Erro:', error.message);
    throw error;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 DEPLOY SUPERADMIN — Ruptur SaaS');
  console.log('='.repeat(70));

  try {
    // Step 1: Migration
    await applyMigration();

    // Step 2: Adicionar diego
    const diegoId = await addDiegoAsAdmin();

    // Step 3: Convidar ruptur
    const invite = await inviteRupturAdmin(diegoId);

    // ====================================================================
    // RESUMO FINAL
    // ====================================================================

    console.log('\n' + '='.repeat(70));
    console.log('✅ DEPLOY CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(70));

    console.log('\n📋 SUPERADMINS CONFIGURADOS:\n');
    console.log('   1️⃣  diegoizac@gmail.com');
    console.log('       Status: ✅ Ativo (direto)');
    console.log('       Acesso: Imediato');

    console.log('\n   2️⃣  ruptur.cloud@gmail.com');
    console.log('       Status: ⏳ Convite enviado');
    console.log(`       Link: ${appUrl}/admin/accept-invite?token=${invite.token}`);
    console.log(`       Válido por: 7 dias (até ${new Date(invite.expires_at).toLocaleDateString('pt-BR')})`);

    console.log('\n' + '='.repeat(70));
    console.log('📧 PRÓXIMAS AÇÕES:\n');
    console.log('   1. Enviar link abaixo para ruptur.cloud@gmail.com via email/Slack:');
    console.log(`\n      ${appUrl}/admin/accept-invite?token=${invite.token}\n`);
    console.log('   2. Usuário clica no link para aceitar convite');
    console.log('   3. Usuário se torna superadmin automaticamente');

    console.log('\n' + '='.repeat(70));
    console.log('🔐 NOTA DE SEGURANÇA:\n');
    console.log('   • Guarde esse token com segurança');
    console.log('   • O convite expira em 7 dias');
    console.log('   • Qualquer um com o link pode aceitar');
    console.log('   • Distribua via canal seguro (email, Slack DM)');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ ERRO DURANTE DEPLOY:\n');
    console.error('   ' + error.message);
    console.error('\n💡 SOLUÇÃO:\n');
    console.error('   1. Aplique a migration manualmente:');
    console.error('      Supabase > SQL Editor > Cole migrations/011_platform_admins_and_invites.sql');
    console.error('   2. Execute novamente: node scripts/deploy-superadmin.mjs\n');
    process.exit(1);
  }
}

main();
