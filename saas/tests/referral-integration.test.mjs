/**
 * Teste de Integração: Sistema de Referral (25% crédito)
 *
 * Fluxo simulado:
 * 1. Criar dois tenants (indicador + indicado)
 * 2. Gerar link de referral
 * 3. Indicado reivindica referral
 * 4. Indicado realiza pagamento/assinatura
 * 5. Verificar comissão creditada ao indicador
 */

import { createClient } from '@supabase/supabase-js';
import { BillingService } from '../modules/billing/getnet.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const billing = new BillingService({
  clientId: process.env.GETNET_CLIENT_ID,
  clientSecret: process.env.GETNET_CLIENT_SECRET,
  sellerId: process.env.GETNET_SELLER_ID,
  sandbox: true,
  supabase,
});

let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function assert(condition, message) {
  if (!condition) {
    testResults.failed++;
    testResults.tests.push({ status: '❌ FAIL', message });
    throw new Error(message);
  }
  testResults.passed++;
  testResults.tests.push({ status: '✅ PASS', message });
}

async function test(name, fn) {
  console.log(`\n📌 ${name}`);
  try {
    await fn();
    console.log(`   ✅ Passou`);
  } catch (e) {
    console.error(`   ❌ Erro: ${e.message}`);
  }
}

// ============================================================================
//  TESTES
// ============================================================================

async function runTests() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         🔗 Teste de Integração: Sistema de Referral            ║
║                  (25% em créditos)                              ║
╚════════════════════════════════════════════════════════════════╝
  `);

  const referrerId = crypto.randomUUID();
  const refereeId = crypto.randomUUID();
  let refCode = '';
  let referralLinkId = '';
  let paymentId = '';

  // Teste 1: Criar tenants de teste
  await test('Criar tenant referrer', async () => {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        id: referrerId,
        email: `referrer-${Date.now()}@test.local`,
        name: 'Referrer Test',
        plan: 'trial',
        credits_balance: 100,
      })
      .select()
      .single();

    assert(!error, `Erro ao criar tenant: ${error?.message}`);
    assert(tenant?.id === referrerId, 'Tenant referrer criado com ID incorreto');
  });

  await test('Criar tenant referee', async () => {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        id: refereeId,
        email: `referee-${Date.now()}@test.local`,
        name: 'Referee Test',
        plan: 'trial',
        credits_balance: 50,
      })
      .select()
      .single();

    assert(!error, `Erro ao criar tenant: ${error?.message}`);
    assert(tenant?.id === refereeId, 'Tenant referee criado com ID incorreto');
  });

  // Teste 2: Gerar link de referral
  await test('Gerar link de referral', async () => {
    const { data: link, error } = await supabase
      .from('referral_links')
      .insert({
        referrer_tenant_id: referrerId,
        ref_code: `test_${crypto.getRandomValues(new Uint8Array(4)).join('').slice(0, 6).toUpperCase()}`,
        status: 'active',
      })
      .select()
      .single();

    assert(!error, `Erro ao criar referral_link: ${error?.message}`);
    assert(link?.ref_code, 'ref_code não gerado');
    refCode = link.ref_code;
    referralLinkId = link.id;
  });

  // Teste 3: Reivindicar referral
  await test('Reivindicar referral (associate referee)', async () => {
    const { error } = await supabase
      .from('referral_links')
      .update({ referee_tenant_id: refereeId })
      .eq('id', referralLinkId);

    assert(!error, `Erro ao atualizar referee_tenant_id: ${error?.message}`);
  });

  // Teste 4: Registrar pagamento de teste
  await test('Registrar pagamento simulado (4900 centavos = R$49)', async () => {
    paymentId = `test-payment-${Date.now()}`;
    const { error } = await supabase
      .from('payments')
      .insert({
        getnet_payment_id: paymentId,
        tenant_id: refereeId,
        status: 'APPROVED',
        amount_cents: 4900,
        payment_type: 'credit_purchase',
        credits_granted: 1000,
        metadata: { test: true },
      });

    assert(!error, `Erro ao registrar pagamento: ${error?.message}`);
  });

  // Teste 5: Processar comissão de referral
  await test('Processar comissão (25% de R$49 = R$12.25 = 1225 centavos)', async () => {
    const result = await billing.processReferralCommission(refereeId, paymentId, 4900);

    assert(result.ok, `Erro ao processar comissão: ${result.error}`);
    assert(result.action === 'commission_credited', 'Ação não foi commission_credited');
    assert(result.commissionAmount === 1225, `Comissão esperada 1225, recebeu ${result.commissionAmount}`);
  });

  // Teste 6: Verificar comissão foi creditada
  await test('Verificar comissão em referral_commissions', async () => {
    const { data: commission, error } = await supabase
      .from('referral_commissions')
      .select('*')
      .eq('getnet_payment_id', paymentId)
      .single();

    assert(!error, `Erro ao buscar comissão: ${error?.message}`);
    assert(commission?.referrer_tenant_id === referrerId, 'Referrer incorreto');
    assert(commission?.referee_tenant_id === refereeId, 'Referee incorreto');
    assert(commission?.commission_amount === 1225, `Comissão incorreta: ${commission?.commission_amount}`);
    assert(commission?.status === 'credited', `Status incorreto: ${commission?.status}`);
  });

  // Teste 7: Verificar créditos foram adicionados ao referrer
  await test('Verificar wallet_transactions (créditos do referrer)', async () => {
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('tenant_id', referrerId)
      .eq('source', 'referral');

    assert(!error, `Erro ao buscar transações: ${error?.message}`);
    assert(transactions?.length > 0, 'Nenhuma transação de referral encontrada');

    const refTx = transactions[0];
    assert(refTx.amount === 1225, `Transação com valor incorreto: ${refTx.amount}`);
    assert(refTx.type === 'credit', `Tipo incorreto: ${refTx.type}`);
  });

  // Teste 8: Verificar saldo atualizado
  await test('Verificar saldo de créditos do referrer', async () => {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('credits_balance')
      .eq('id', referrerId)
      .single();

    assert(tenant?.credits_balance >= 100 + 1225, `Saldo esperado >= 1325, obtido ${tenant?.credits_balance}`);
  });

  // Teste 9: Verificar VIEW referral_summary
  await test('Verificar VIEW referral_summary', async () => {
    const { data: summary } = await supabase
      .from('referral_summary')
      .select('*')
      .eq('referrer_tenant_id', referrerId)
      .single();

    assert(summary?.total_referrals > 0, 'total_referrals deve ser > 0');
    assert(summary?.paying_referrals > 0, 'paying_referrals deve ser > 0');
    assert(summary?.total_commission_cents === 1225, `total_commission_cents deve ser 1225, obtido ${summary?.total_commission_cents}`);
  });

  // Teste 10: Validar UNIQUE constraint (replay de webhook)
  await test('Validar proteção contra replay (UNIQUE getnet_payment_id)', async () => {
    const result = await billing.processReferralCommission(refereeId, paymentId, 4900);

    assert(result.action === 'commission_duplicate', 'Deveria retornar commission_duplicate para replay');
  });

  // Limpeza
  console.log('\n🧹 Limpando dados de teste...');
  await supabase.from('referral_links').delete().eq('id', referralLinkId);
  await supabase.from('payments').delete().eq('getnet_payment_id', paymentId);
  await supabase.from('tenants').delete().eq('id', referrerId);
  await supabase.from('tenants').delete().eq('id', refereeId);

  // Relatório
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    RELATÓRIO DE TESTES                         ║
╠════════════════════════════════════════════════════════════════╣
  `);

  testResults.tests.forEach(t => console.log(`${t.status} ${t.message}`));

  console.log(`
╠════════════════════════════════════════════════════════════════╣
║  ✅ Passou: ${testResults.passed}                                             ║
║  ❌ Falhou: ${testResults.failed}                                             ║
╚════════════════════════════════════════════════════════════════╝
  `);

  process.exit(testResults.failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('❌ Erro crítico:', err);
  process.exit(1);
});
