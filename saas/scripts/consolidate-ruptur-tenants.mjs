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
  console.log('🔄 CONSOLIDANDO TENANTS\n');

  // Passo 1: Buscar todos os tenants
  const { data: allTenants } = await supabase
    .from('tenants')
    .select('id, name');

  console.log('📋 Tenants atuais:');
  allTenants.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name} (${t.id})`);
  });

  // Passo 2: Deletar Ruptur Fill (manter Ruptur Cloud Demo)
  console.log('\n🗑️  Deletando Ruptur Fill...');

  const rupturFillId = 'bf3bd0c6-3908-42a4-ac5b-5c7e8f8ef55d';

  // Primeiro, deletar memberships associadas
  const { error: memberError } = await supabase
    .from('user_tenant_memberships')
    .delete()
    .eq('tenant_id', rupturFillId);

  if (memberError) {
    console.log(`⚠️  Erro ao deletar memberships: ${memberError.message}`);
  } else {
    console.log('✓ Memberships deletados');
  }

  // Deletar o tenant
  const { error: deleteError } = await supabase
    .from('tenants')
    .delete()
    .eq('id', rupturFillId);

  if (deleteError) {
    console.log(`⚠️  Erro ao deletar tenant: ${deleteError.message}`);
  } else {
    console.log('✓ Tenant Ruptur Fill deletado');
  }

  // Passo 3: Renomear Ruptur Cloud Demo para Ruptur (PROD)
  console.log('\n📝 Renomeando Ruptur Cloud Demo → Ruptur (PROD)...');

  const rupturCloudDemoId = '135c7d7a-3745-4952-8322-faf454553818';
  const { error: renameError1 } = await supabase
    .from('tenants')
    .update({ name: 'Ruptur (PROD)' })
    .eq('id', rupturCloudDemoId);

  if (renameError1) {
    console.log(`⚠️  Erro: ${renameError1.message}`);
  } else {
    console.log('✓ Renomeado para "Ruptur (PROD)"');
  }

  // Passo 4: Renomear Demo Tenant → ti atende
  console.log('\n📝 Renomeando Demo Tenant → ti atende...');

  const demoTenantId = '082aa612-c6fa-42d6-9dfe-90d763443cd0';
  const { error: renameError2 } = await supabase
    .from('tenants')
    .update({ name: 'ti atende' })
    .eq('id', demoTenantId);

  if (renameError2) {
    console.log(`⚠️  Erro: ${renameError2.message}`);
  } else {
    console.log('✓ Renomeado para "ti atende"');
  }

  // Passo 5: Renomear Test Tenant Webhooks → 2dl company
  console.log('\n📝 Renomeando Test Tenant Webhooks → 2dl company...');

  const testWebhooksId = '0dcc86aa-fbd4-4be2-ac2b-67ee2c63eeaf';
  const { error: renameError3 } = await supabase
    .from('tenants')
    .update({ name: '2dl company' })
    .eq('id', testWebhooksId);

  if (renameError3) {
    console.log(`⚠️  Erro: ${renameError3.message}`);
  } else {
    console.log('✓ Renomeado para "2dl company"');
  }

  // Passo 6: Verificação final
  console.log('\n✅ Verificação final:\n');

  const { data: finalTenants } = await supabase
    .from('tenants')
    .select('id, name')
    .order('created_at');

  console.log('📋 Tenants após consolidação:');
  finalTenants.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name}`);
    console.log(`   ID: ${t.id}`);
  });

  console.log('\n✨ CONSOLIDAÇÃO CONCLUÍDA!\n');
  console.log('Resumo:');
  console.log('  ✓ Deletado: Ruptur Fill');
  console.log('  ✓ PROD: Ruptur (PROD)');
  console.log('  ✓ Cliente 1: ti atende');
  console.log('  ✓ Cliente 2: 2dl company\n');

} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
