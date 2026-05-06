/**
 * Script: Configurar Superadmins Iniciais
 *
 * Adiciona os primeiros superadmins da plataforma:
 * - diegoizac@gmail.com (direto)
 * - ruptur.cloud@gmail.com (via convite)
 *
 * Uso:
 * node scripts/setup-superadmins.js
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupSuperadmins() {
  console.log('🚀 Iniciando setup de superadmins...\n');

  try {
    // ===== PASSO 1: Adicionar diegoizac@gmail.com =====
    console.log('📝 Passo 1: Criando superadmin diegoizac@gmail.com...');

    // Buscar ou criar usuário no auth
    let diegoUserId = null;

    // Tentar buscar usuário existente
    const { data: existingDiego } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('email', 'diegoizac@gmail.com')
      .single();

    if (existingDiego?.user_id) {
      diegoUserId = existingDiego.user_id;
      console.log(`   ✅ Usuário já é superadmin: ${diegoUserId}`);
    } else {
      // Gerar um UUID para o usuário (será criado no auth separadamente)
      diegoUserId = crypto.randomUUID();
      console.log(`   📌 ID de usuário: ${diegoUserId}`);

      // Inserir como superadmin (sem user_id validado ainda)
      const { data: admin1, error: error1 } = await supabase
        .from('platform_admins')
        .insert({
          user_id: diegoUserId,
          email: 'diegoizac@gmail.com',
          status: 'active',
          created_by: null, // Criado pelo script de setup
        })
        .select()
        .single();

      if (error1) {
        // Se já existe, só logamos
        if (error1.code === '23505') {
          console.log(`   ✅ diegoizac@gmail.com já é superadmin`);
        } else {
          throw error1;
        }
      } else {
        console.log(`   ✅ Superadmin criado: ${admin1.email}`);
      }
    }

    // ===== PASSO 2: Convidar ruptur.cloud@gmail.com =====
    console.log('\n📧 Passo 2: Criando convite para ruptur.cloud@gmail.com...');

    // Gerar token de convite
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: error2 } = await supabase
      .from('platform_admin_invites')
      .insert({
        email: 'ruptur.cloud@gmail.com',
        token,
        expires_at: expiresAt,
        invited_by: diegoUserId, // Convidado por diego
      })
      .select()
      .single();

    if (error2) {
      if (error2.code === '23505') {
        console.log(`   ⚠️  Convite já existe para ruptur.cloud@gmail.com`);

        // Buscar o convite existente
        const { data: existingInvite } = await supabase
          .from('platform_admin_invites')
          .select('*')
          .eq('email', 'ruptur.cloud@gmail.com')
          .eq('status', 'pending')
          .single();

        if (existingInvite) {
          console.log(`   📌 Link de convite: ${process.env.APP_URL || 'https://app.ruptur.cloud'}/admin/accept-invite?token=${existingInvite.token}`);
        }
      } else {
        throw error2;
      }
    } else {
      console.log(`   ✅ Convite criado: ${invite.email}`);
      console.log(`   📌 Link de convite: ${process.env.APP_URL || 'https://app.ruptur.cloud'}/admin/accept-invite?token=${token}`);
      console.log(`   ⏰ Válido até: ${new Date(expiresAt).toLocaleDateString('pt-BR')}`);
    }

    // ===== RESUMO =====
    console.log('\n' + '='.repeat(60));
    console.log('✅ Setup concluído com sucesso!');
    console.log('='.repeat(60));
    console.log('\n📋 Resumo:');
    console.log(`   1️⃣  diegoizac@gmail.com → Superadmin (direto)`);
    console.log(`   2️⃣  ruptur.cloud@gmail.com → Convite enviado`);
    console.log('\n⚠️  PRÓXIMAS AÇÕES:');
    console.log(`   • Enviar link de convite para ruptur.cloud@gmail.com`);
    console.log(`   • Link: ${process.env.APP_URL || 'https://app.ruptur.cloud'}/admin/accept-invite?token=${token}`);
    console.log(`   • Válido por 7 dias\n`);

  } catch (error) {
    console.error('❌ Erro durante setup:', error.message);
    console.error(error);
    process.exit(1);
  }
}

setupSuperadmins();
