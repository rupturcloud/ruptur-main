/**
 * Módulo de Billing — Integração Mercado Pago
 *
 * 3 fluxos:
 * 1. createCheckoutPreference() → pagamento único (créditos avulsos)
 * 2. createSubscription() → assinatura recorrente (planos mensais)
 * 3. handleWebhook() → processar notificações IPN do Mercado Pago
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs
 */

// Pacotes de créditos disponíveis para compra avulsa
const CREDIT_PACKAGES = {
  'pack-1k': { credits: 1000,  price_cents: 4900,  label: '1.000 créditos' },
  'pack-5k': { credits: 5000,  price_cents: 19900, label: '5.000 créditos' },
  'pack-10k': { credits: 10000, price_cents: 34900, label: '10.000 créditos' },
};

class BillingService {
  constructor(config = {}) {
    this.accessToken = config.accessToken || process.env.MP_ACCESS_TOKEN;
    this.publicKey = config.publicKey || process.env.MP_PUBLIC_KEY;
    this.webhookSecret = config.webhookSecret || process.env.MP_WEBHOOK_SECRET;
    this.notificationUrl = config.notificationUrl || process.env.MP_NOTIFICATION_URL;
    this.baseUrl = 'https://api.mercadopago.com';
    this.supabase = config.supabase || null;
  }

  /**
   * Fetch autenticado para a API do Mercado Pago
   */
  async mpFetch(path, options = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data.message || `MP API error: ${res.status}`);
      error.status = res.status;
      error.body = data;
      throw error;
    }
    return data;
  }

  /**
   * 1. Criar Checkout para compra avulsa de créditos
   * Retorna { checkoutUrl, preferenceId }
   */
  async createCheckoutPreference(tenantId, packageId) {
    const pkg = CREDIT_PACKAGES[packageId];
    if (!pkg) throw new Error(`Pacote inválido: ${packageId}`);

    const preference = await this.mpFetch('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [{
          title: `RupturCloud - ${pkg.label}`,
          description: `Pacote de ${pkg.credits} créditos para disparos WhatsApp`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: pkg.price_cents / 100,
        }],
        back_urls: {
          success: `https://saas.ruptur.cloud/carteira?status=approved`,
          failure: `https://saas.ruptur.cloud/carteira?status=failure`,
          pending: `https://saas.ruptur.cloud/carteira?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${this.notificationUrl}?tenant=${tenantId}&package=${packageId}`,
        external_reference: `${tenantId}:${packageId}:${Date.now()}`,
        metadata: {
          tenant_id: tenantId,
          package_id: packageId,
          credits: pkg.credits,
          type: 'credit_purchase',
        },
      }),
    });

    return {
      checkoutUrl: preference.init_point,
      sandboxUrl: preference.sandbox_init_point,
      preferenceId: preference.id,
    };
  }

  /**
   * 2. Criar Assinatura Recorrente (Preapproval)
   * Retorna { subscriptionUrl, subscriptionId }
   */
  async createSubscription(tenantId, planId) {
    if (!this.supabase) throw new Error('Supabase client necessário');

    // Buscar dados do plano no banco
    const { data: plan, error } = await this.supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (error || !plan) throw new Error(`Plano não encontrado: ${planId}`);

    // Buscar dados do tenant
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('email, name')
      .eq('id', tenantId)
      .single();

    const subscription = await this.mpFetch('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: `RupturCloud - Plano ${plan.name}`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.price_cents / 100,
          currency_id: 'BRL',
        },
        payer_email: tenant?.email,
        back_url: `https://saas.ruptur.cloud/carteira?subscription=active`,
        external_reference: `sub:${tenantId}:${planId}`,
        status: 'pending',
      }),
    });

    // Salvar assinatura no banco
    await this.supabase.from('subscriptions').insert({
      tenant_id: tenantId,
      plan_id: planId,
      mp_subscription_id: subscription.id,
      status: 'pending',
    });

    return {
      subscriptionUrl: subscription.init_point,
      subscriptionId: subscription.id,
    };
  }

  /**
   * 3. Processar Webhook IPN do Mercado Pago
   * Chamado por POST /api/webhooks/mp
   */
  async handleWebhook(body, query = {}) {
    if (!this.supabase) throw new Error('Supabase client necessário');

    const { type, data } = body;

    if (type === 'payment') {
      return this.handlePaymentNotification(data.id, query);
    }

    if (type === 'subscription_preapproval') {
      return this.handleSubscriptionNotification(data.id);
    }

    console.log(`[Billing] Webhook tipo ignorado: ${type}`);
    return { ok: true, action: 'ignored' };
  }

  /**
   * Processar notificação de pagamento aprovado
   */
  async handlePaymentNotification(paymentId, query = {}) {
    // Buscar detalhes do pagamento no MP
    const payment = await this.mpFetch(`/v1/payments/${paymentId}`);

    // Registrar pagamento no banco
    await this.supabase.from('payments').upsert({
      mp_payment_id: String(paymentId),
      tenant_id: query.tenant || payment.metadata?.tenant_id,
      mp_status: payment.status,
      mp_status_detail: payment.status_detail,
      amount_cents: Math.round(payment.transaction_amount * 100),
      payment_type: payment.metadata?.type || 'credit_purchase',
      credits_granted: payment.metadata?.credits || 0,
      metadata: payment.metadata || {},
    }, { onConflict: 'mp_payment_id' });

    // Se aprovado, adicionar créditos
    if (payment.status === 'approved') {
      const credits = payment.metadata?.credits || 0;
      const tenantId = query.tenant || payment.metadata?.tenant_id;

      if (credits > 0 && tenantId) {
        await this.addCreditsToTenant(tenantId, credits, {
          source: 'purchase',
          reference_id: String(paymentId),
          description: `Compra de ${credits} créditos (MP #${paymentId})`,
        });
      }
    }

    return { ok: true, action: 'payment_processed', status: payment.status };
  }

  /**
   * Processar notificação de assinatura
   */
  async handleSubscriptionNotification(subscriptionId) {
    const sub = await this.mpFetch(`/preapproval/${subscriptionId}`);

    // Atualizar status da assinatura no banco
    const { data: dbSub } = await this.supabase
      .from('subscriptions')
      .update({
        status: sub.status,
        last_payment_at: sub.last_modified ? new Date(sub.last_modified) : null,
      })
      .eq('mp_subscription_id', String(subscriptionId))
      .select('tenant_id, plan_id')
      .single();

    // Se autorizada, adicionar créditos mensais
    if (sub.status === 'authorized' && dbSub) {
      const { data: plan } = await this.supabase
        .from('plans')
        .select('credits_per_month, max_instances, name')
        .eq('id', dbSub.plan_id)
        .single();

      if (plan) {
        // Atualizar plano do tenant
        await this.supabase.from('tenants').update({
          plan: dbSub.plan_id,
          monthly_credits: plan.credits_per_month,
          max_instances: plan.max_instances,
          mp_subscription_id: String(subscriptionId),
        }).eq('id', dbSub.tenant_id);

        // Adicionar créditos mensais
        await this.addCreditsToTenant(dbSub.tenant_id, plan.credits_per_month, {
          source: 'subscription',
          reference_id: String(subscriptionId),
          description: `Créditos mensais - Plano ${plan.name}`,
        });
      }
    }

    // Se cancelada
    if (sub.status === 'cancelled' && dbSub) {
      await this.supabase.from('subscriptions').update({
        cancelled_at: new Date().toISOString(),
      }).eq('mp_subscription_id', String(subscriptionId));

      // Downgrade para trial
      await this.supabase.from('tenants').update({
        plan: 'trial',
        monthly_credits: 0,
        mp_subscription_id: null,
      }).eq('id', dbSub.tenant_id);
    }

    return { ok: true, action: 'subscription_processed', status: sub.status };
  }

  /**
   * Adicionar créditos ao tenant (operation atômica)
   */
  async addCreditsToTenant(tenantId, amount, txData = {}) {
    // 1. Atualizar saldo
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('credits_balance')
      .eq('id', tenantId)
      .single();

    const newBalance = (tenant?.credits_balance || 0) + amount;

    await this.supabase.from('tenants').update({
      credits_balance: newBalance,
    }).eq('id', tenantId);

    // 2. Registrar transação
    await this.supabase.from('wallet_transactions').insert({
      tenant_id: tenantId,
      type: 'credit',
      amount,
      balance_after: newBalance,
      source: txData.source || 'system',
      reference_id: txData.reference_id || null,
      description: txData.description || `+${amount} créditos`,
    });

    return { balance: newBalance };
  }

  /**
   * Listar planos disponíveis
   */
  async getPlans() {
    if (!this.supabase) throw new Error('Supabase client necessário');
    const { data } = await this.supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    return data || [];
  }

  /**
   * Obter pacotes de créditos disponíveis
   */
  getCreditPackages() {
    return Object.entries(CREDIT_PACKAGES).map(([id, pkg]) => ({
      id,
      ...pkg,
      price: (pkg.price_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    }));
  }
}

export { BillingService, CREDIT_PACKAGES };
export default BillingService;
