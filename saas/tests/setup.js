import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export async function setupTestTenant() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Criar tenant de teste
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: 'Test Tenant Webhooks',
      slug: `test-webhook-${Date.now()}`,
      email: `test-webhook-${Date.now()}@test.local`
    })
    .select('id')
    .single();

  if (tenantError) {
    throw new Error(`Erro ao criar tenant: ${tenantError.message}`);
  }

  const tenantId = tenant.id;

  // 2. Criar wallet para o tenant
  const { error: walletError } = await supabase
    .from('wallets')
    .insert({
      tenant_id: tenantId,
      balance: 10000,
      version: 1
    });

  if (walletError) {
    throw new Error(`Erro ao criar wallet: ${walletError.message}`);
  }

  // 3. Criar um payment de teste
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      tenant_id: tenantId,
      status: 'INITIATED',
      amount_cents: 100000,
      payment_type: 'credit_card',
      getnet_payment_id: `test_payment_${Date.now()}`
    })
    .select('id')
    .single();

  if (paymentError) {
    throw new Error(`Erro ao criar payment: ${paymentError.message}`);
  }

  return {
    tenantId,
    paymentId: payment.id,
    cleanup: async () => {
      // Limpeza opcional
      await supabase.from('webhook_events').delete().eq('tenant_id', tenantId);
      await supabase.from('refunds').delete().eq('tenant_id', tenantId);
      await supabase.from('payments').delete().eq('tenant_id', tenantId);
      await supabase.from('wallets').delete().eq('tenant_id', tenantId);
      await supabase.from('tenants').delete().eq('id', tenantId);
    }
  };
}
