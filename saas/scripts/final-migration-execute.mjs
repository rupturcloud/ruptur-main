#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Carregar .env
const envPath = path.join(projectRoot, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  console.log('✨ EXECUTANDO MIGRAÇÃO: Link Superadmins to Ruptur Tenants\n');

  // Step 1: Buscar todos os users que são donos (assumindo que owners = superadmins ou admins)
  console.log('🔍 Step 1: Buscando usuários com acesso administrativo...');

  const { data: ownersData, error: ownersError } = await supabase
    .from('user_tenant_memberships')
    .select('user_id')
    .eq('role', 'owner');

  if (ownersError) {
    console.error(`❌ Erro: ${ownersError.message}`);
    process.exit(1);
  }

  const uniqueUserIds = [...new Set(ownersData.map(m => m.user_id))];
  console.log(`✓ Encontrados ${uniqueUserIds.length} usuários únicos com role 'owner'`);
  uniqueUserIds.forEach((id, i) => {
    console.log(`  ${i + 1}. ${id.substring(0, 12)}...`);
  });

  // Step 2: Buscar tenants Ruptur
  console.log('\n🔍 Step 2: Buscando tenants Ruptur...');

  const { data: rupturTenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name')
    .ilike('name', '%ruptur%');

  if (tenantsError) {
    console.error(`❌ Erro: ${tenantsError.message}`);
    process.exit(1);
  }

  console.log(`✓ Encontrados ${rupturTenants.length} tenants:`);
  rupturTenants.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name}`);
    console.log(`     ID: ${t.id}`);
  });

  // Step 3: Buscar memberships existentes
  console.log('\n🔍 Step 3: Verificando memberships existentes...');

  const { data: allMemberships, error: memberError } = await supabase
    .from('user_tenant_memberships')
    .select('user_id, tenant_id');

  if (memberError) {
    console.error(`❌ Erro: ${memberError.message}`);
    process.exit(1);
  }

  const existingPairs = new Set(
    allMemberships.map(m => `${m.user_id}|${m.tenant_id}`)
  );
  console.log(`✓ Total de memberships existentes: ${existingPairs.size}`);

  // Step 4: Determinar novos memberships a criar
  console.log('\n🔍 Step 4: Calculando novos memberships...');

  const newMemberships = [];
  for (const userId of uniqueUserIds) {
    for (const tenant of rupturTenants) {
      const key = `${userId}|${tenant.id}`;
      if (!existingPairs.has(key)) {
        newMemberships.push({
          user_id: userId,
          tenant_id: tenant.id,
          role: 'admin',
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  console.log(`✓ Novos memberships a criar: ${newMemberships.length}`);
  if (newMemberships.length > 0) {
    newMemberships.slice(0, 5).forEach((m, i) => {
      console.log(`  ${i + 1}. User: ${m.user_id.substring(0, 12)}... → ${m.tenant_id.substring(0, 12)}...`);
    });
    if (newMemberships.length > 5) {
      console.log(`  ... e mais ${newMemberships.length - 5}`);
    }
  }

  // Step 5: Inserir novos memberships
  if (newMemberships.length > 0) {
    console.log('\n📝 Step 5: Criando novos memberships...');

    const { error: insertError, count: insertCount } = await supabase
      .from('user_tenant_memberships')
      .insert(newMemberships);

    if (insertError) {
      console.error(`❌ Erro ao inserir: ${insertError.message}`);
      process.exit(1);
    }

    console.log(`✓ Inseridos com sucesso!`);
  } else {
    console.log('\n✓ Todos os memberships já existem, nenhuma ação necessária');
  }

  // Step 6: Verificação final
  console.log('\n📊 Step 6: Verificação final...\n');

  const { data: finalMemberships } = await supabase
    .from('user_tenant_memberships')
    .select('user_id, tenant_id, role');

  const finalCount = new Set(
    finalMemberships.map(m => `${m.user_id}|${m.tenant_id}`)
  ).size;

  console.log('📋 Status Final:');
  console.log('─'.repeat(70));

  for (const tenant of rupturTenants) {
    const countForTenant = finalMemberships.filter(m => m.tenant_id === tenant.id).length;
    console.log(`${tenant.name}:`);
    console.log(`  Total de memberships: ${countForTenant}`);

    const adminCount = finalMemberships.filter(
      m => m.tenant_id === tenant.id && m.role === 'admin'
    ).length;
    const ownerCount = finalMemberships.filter(
      m => m.tenant_id === tenant.id && m.role === 'owner'
    ).length;
    const memberCount = finalMemberships.filter(
      m => m.tenant_id === tenant.id && m.role === 'member'
    ).length;

    console.log(`    - Admins: ${adminCount}`);
    console.log(`    - Owners: ${ownerCount}`);
    console.log(`    - Members: ${memberCount}`);
  }

  console.log('─'.repeat(70));
  console.log(`\nTotal de memberships no sistema: ${finalCount}`);

  console.log('\n✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!\n');

} catch (error) {
  console.error('❌ Erro inesperado:', error.message);
  process.exit(1);
}
