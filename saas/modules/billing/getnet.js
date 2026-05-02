/**
 * Módulo de Billing — Integração Getnet (Santander)
 *
 * Fluxos suportados:
 * 1. createCheckoutPreference()  → pagamento único (créditos avulsos) via crédito/débito
 * 2. createSubscription()        → assinatura recorrente via Cofre + Recorrência
 * 3. handleWebhook()             → processar notificações de pagamento
 * 4. tokenizeCard()              → tokenização PCI-compliant de cartão
 *
 * API Base:
 *   Sandbox:   https://api-sandbox.getnet.com.br
 *   Produção:  https://api.getnet.com.br
 *
 * Docs: https://developers.getnet.com.br/
 *       https://docs.globalgetnet.com/pt
 */

// Pacotes de créditos disponíveis para compra avulsa
const CREDIT_PACKAGES = {
  'pack-1k':  { credits: 1000,  price_cents: 4900,  label: '1.000 créditos' },
  'pack-5k':  { credits: 5000,  price_cents: 19900, label: '5.000 créditos' },
  'pack-10k': { credits: 10000, price_cents: 34900, label: '10.000 créditos' },
};

class BillingService {
  constructor(config = {}) {
    this.clientId       = config.clientId       || process.env.GETNET_CLIENT_ID;
    this.clientSecret   = config.clientSecret   || process.env.GETNET_CLIENT_SECRET;
    this.sellerId       = config.sellerId       || process.env.GETNET_SELLER_ID;
    this.webhookSecret  = config.webhookSecret  || process.env.GETNET_WEBHOOK_SECRET;
    this.isSandbox      = (config.sandbox ?? process.env.GETNET_SANDBOX !== 'false');
    this.baseUrl        = this.isSandbox
      ? 'https://api-sandbox.getnet.com.br'
      : 'https://api.getnet.com.br';
    this.supabase       = config.supabase || null;

    // Cache do token OAuth2
    this._token       = null;
    this._tokenExp    = 0;
  }

  // ========================================================================
  //  Auth — OAuth2 Client Credentials
  // ========================================================================

  /**
   * Obter (ou reutilizar) token de acesso OAuth2
   */
  async getAccessToken() {
    const now = Date.now();

    // Token em cache e ainda válido (margem de 60s)
    if (this._token && this._tokenExp > now + 60_000) {
      return this._token;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const res = await fetch(`${this.baseUrl}/auth/oauth/v2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'scope=oob&grant_type=client_credentials',
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Getnet OAuth falhou (${res.status}): ${body}`);
    }

    const data = await res.json();
    this._token    = data.access_token;
    this._tokenExp = now + (data.expires_in * 1000);

    return this._token;
  }

  /**
   * Fetch autenticado para a API da Getnet
   */
  async apiFetch(path, options = {}) {
    const token = await this.getAccessToken();

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'seller_id': this.sellerId,
        ...options.headers,
      },
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const error = new Error(data.message || data.details?.[0]?.description || `Getnet API error: ${res.status}`);
      error.status = res.status;
      error.body = data;
      throw error;
    }

    return data;
  }

  // ========================================================================
  //  Tokenização — PCI DSS Compliance
  // ========================================================================

  /**
   * Tokenizar número do cartão (deve ser feito no front ou via server-to-server)
   * @param {string} cardNumber - Número do cartão (PAN)
   * @param {string} customerId - ID do cliente
   * @returns {{ number_token: string }}
   */
  async tokenizeCard(cardNumber, customerId) {
    return this.apiFetch('/v1/tokens/card', {
      method: 'POST',
      body: JSON.stringify({
        card_number: cardNumber,
        customer_id: customerId,
      }),
    });
  }

  // ========================================================================
  //  Cofre (Vault) — Salvar cartão para recorrência
  // ========================================================================

  /**
   * Salvar cartão no Cofre da Getnet para cobranças futuras
   */
  async saveCardToVault(numberToken, customerId, cardData) {
    return this.apiFetch('/v1/cards', {
      method: 'POST',
      body: JSON.stringify({
        number_token: numberToken,
        brand: cardData.brand,           // Mastercard, Visa, Elo, etc.
        cardholder_name: cardData.holderName,
        expiration_month: cardData.expMonth,
        expiration_year: cardData.expYear,
        customer_id: customerId,
        verify_card: true,               // Valida o cartão com uma micro-cobrança
      }),
    });
  }

  /**
   * Listar cartões salvos do cliente
   */
  async listVaultCards(customerId) {
    return this.apiFetch(`/v1/cards?customer_id=${customerId}`);
  }

  // ========================================================================
  //  1. Pagamento Único — Compra de créditos
  // ========================================================================

  /**
   * Criar pagamento de créditos avulsos via cartão de crédito
   * @param {string} tenantId
   * @param {string} packageId - ID do pacote de créditos
   * @param {object} cardData  - { numberToken, holderName, securityCode, expMonth, expYear, brand }
   * @param {object} customer  - { customerId, firstName, lastName, email, documentType, documentNumber }
   * @returns {{ paymentId, status }}
   */
  async createCheckoutPreference(tenantId, packageId, cardData = {}, customer = {}) {
    const pkg = CREDIT_PACKAGES[packageId];
    if (!pkg) throw new Error(`Pacote inválido: ${packageId}`);

    const orderId = `${tenantId}-${packageId}-${Date.now()}`;

    const payload = {
      seller_id: this.sellerId,
      amount: pkg.price_cents,  // Getnet espera valor em centavos
      currency: 'BRL',
      order: {
        order_id: orderId,
        sales_tax: 0,
        product_type: 'service',
      },
      customer: {
        customer_id: customer.customerId || tenantId,
        first_name: customer.firstName || 'Cliente',
        last_name: customer.lastName || 'Ruptur',
        email: customer.email || '',
        document_type: customer.documentType || 'CPF',
        document_number: customer.documentNumber || '',
        billing_address: customer.billingAddress || {},
      },
      credit: {
        delayed: false,
        save_card_data: false,
        transaction_type: 'FULL',
        number_installments: 1,
        card: {
          number_token: cardData.numberToken,
          cardholder_name: cardData.holderName,
          security_code: cardData.securityCode,
          brand: cardData.brand,
          expiration_month: cardData.expMonth,
          expiration_year: cardData.expYear,
        },
      },
    };

    const payment = await this.apiFetch('/v1/payments/credit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // Registrar pagamento no banco
    if (this.supabase) {
      await this.supabase.from('payments').upsert({
        getnet_payment_id: payment.payment_id,
        tenant_id: tenantId,
        status: payment.status,
        status_detail: payment.status_detail || '',
        amount_cents: pkg.price_cents,
        payment_type: 'credit_purchase',
        credits_granted: pkg.credits,
        metadata: {
          order_id: orderId,
          package_id: packageId,
          provider: 'getnet',
        },
      }, { onConflict: 'getnet_payment_id' });

      // Se aprovado, adicionar créditos imediatamente
      if (payment.status === 'APPROVED') {
        await this.addCreditsToTenant(tenantId, pkg.credits, {
          source: 'purchase',
          reference_id: payment.payment_id,
          description: `Compra de ${pkg.credits} créditos (Getnet #${payment.payment_id})`,
        });
      }
    }

    return {
      paymentId: payment.payment_id,
      status: payment.status,
      statusDetail: payment.status_detail,
    };
  }

  // ========================================================================
  //  2. Assinatura Recorrente
  // ========================================================================

  /**
   * Criar assinatura recorrente (via Cofre + Recorrência Getnet)
   * @param {string} tenantId
   * @param {string} planId
   * @param {string} cardId - ID do cartão salvo no Cofre (card_id)
   */
  async createSubscription(tenantId, planId, cardId) {
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

    const subscriptionPayload = {
      seller_id: this.sellerId,
      customer_id: tenantId,
      plan_id: planId,
      order_id: `sub-${tenantId}-${planId}-${Date.now()}`,
      subscription: {
        plan: {
          name: `RupturCloud - ${plan.name}`,
          amount: plan.price_cents,
          currency: 'BRL',
          payment_types: ['CREDIT_CARD'],
          period: {
            type: 'monthly',
            billing_cycle: 0,  // 0 = sem limite de ciclos
          },
        },
        card_id: cardId,
      },
    };

    const sub = await this.apiFetch('/v1/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscriptionPayload),
    });

    // Salvar assinatura no banco
    await this.supabase.from('subscriptions').insert({
      tenant_id: tenantId,
      plan_id: planId,
      getnet_subscription_id: sub.subscription_id || sub.subscription?.subscription_id,
      status: sub.status || 'active',
      provider: 'getnet',
    });

    // Atualizar plano do tenant
    await this.supabase.from('tenants').update({
      plan: planId,
      monthly_credits: plan.credits_per_month,
      max_instances: plan.max_instances,
      getnet_subscription_id: sub.subscription_id || sub.subscription?.subscription_id,
    }).eq('id', tenantId);

    // Adicionar créditos do primeiro mês
    await this.addCreditsToTenant(tenantId, plan.credits_per_month, {
      source: 'subscription',
      reference_id: sub.subscription_id || sub.subscription?.subscription_id,
      description: `Créditos mensais - Plano ${plan.name}`,
    });

    return {
      subscriptionId: sub.subscription_id || sub.subscription?.subscription_id,
      status: sub.status || 'active',
    };
  }

  /**
   * Cancelar assinatura
   */
  async cancelSubscription(subscriptionId) {
    const result = await this.apiFetch(`/v1/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });

    if (this.supabase) {
      const { data: dbSub } = await this.supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('getnet_subscription_id', subscriptionId)
        .select('tenant_id')
        .single();

      if (dbSub) {
        await this.supabase.from('tenants').update({
          plan: 'trial',
          monthly_credits: 0,
          getnet_subscription_id: null,
        }).eq('id', dbSub.tenant_id);
      }
    }

    return result;
  }

  // ========================================================================
  //  3. Webhook — Notificações da Getnet
  // ========================================================================

  /**
   * Validar assinatura de webhook Getnet
   * Getnet usa HMAC-SHA256 para assinatura
   * @param {string} body - Body bruto do webhook (JSON string)
   * @param {string} signature - Header X-Signature do webhook
   * @returns {boolean}
   */
  validateWebhookSignature(body, signature) {
    if (!this.webhookSecret) {
      console.warn('[Webhook] AVISO: webhookSecret não configurado! Pulando validação.');
      return true; // Permitir em dev se secret não configurado
    }

    if (!signature) {
      console.error('[Webhook] Erro: X-Signature header não fornecido');
      return false;
    }

    try {
      // Getnet usa HMAC-SHA256
      const crypto = require('crypto');
      const hash = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(body)
        .digest('hex');

      const isValid = hash === signature;

      if (!isValid) {
        console.error('[Webhook] Erro: Assinatura inválida', {
          expected: hash.substring(0, 16) + '...',
          received: signature.substring(0, 16) + '...',
        });
      }

      return isValid;
    } catch (error) {
      console.error('[Webhook] Erro ao validar assinatura:', error);
      return false;
    }
  }

  /**
   * Processar webhook da Getnet
   * A Getnet envia notificações para URLs configuradas no painel do seller
   * @param {string} rawBody - Body bruto (para validação de assinatura)
   * @param {object} body - Body parseado
   * @param {object} headers - Headers do webhook
   */
  async handleWebhook(body, query = {}, headers = {}) {
    if (!this.supabase) throw new Error('Supabase client necessário');

    // Validar assinatura
    const signature = headers['x-signature'] || headers['X-Signature'];
    const rawBody = headers['_rawBody']; // Deve ser injetado pelo middleware

    if (signature && rawBody) {
      const isValid = this.validateWebhookSignature(rawBody, signature);
      if (!isValid) {
        console.error('[Webhook] Assinatura inválida - webhook rejeitado');
        throw new Error('Invalid webhook signature');
      }
      console.log('[Webhook] ✅ Assinatura validada');
    } else if (!process.env.ENABLE_DEV_MODE) {
      // Em produção, assinatura é obrigatória
      console.error('[Webhook] Assinatura obrigatória em produção');
      throw new Error('Missing webhook signature');
    }

    const eventType = body.event || body.type;
    const paymentId = body.payment_id || body.data?.payment_id;

    console.log(`[Billing:Getnet] Webhook recebido: ${eventType}`, { paymentId });

    switch (eventType) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_APPROVED':
        return this.handlePaymentApproved(body);

      case 'PAYMENT_DENIED':
      case 'PAYMENT_CANCELLED':
        return this.handlePaymentDenied(body);

      case 'SUBSCRIPTION_PAYMENT':
        return this.handleSubscriptionPayment(body);

      case 'SUBSCRIPTION_CANCELLED':
        return this.handleSubscriptionCancelled(body);

      default:
        console.log(`[Billing:Getnet] Evento ignorado: ${eventType}`);
        return { ok: true, action: 'ignored', event: eventType };
    }
  }

  /**
   * Processar pagamento aprovado
   */
  async handlePaymentApproved(body) {
    const paymentId = body.payment_id || body.data?.payment_id;

    // Buscar pagamento no banco para pegar tenant e créditos
    const { data: dbPayment } = await this.supabase
      .from('payments')
      .select('*')
      .eq('getnet_payment_id', paymentId)
      .single();

    if (dbPayment && dbPayment.status !== 'APPROVED') {
      await this.supabase.from('payments').update({
        status: 'APPROVED',
      }).eq('getnet_payment_id', paymentId);

      // Adicionar créditos se ainda não foram adicionados
      if (dbPayment.credits_granted > 0) {
        await this.addCreditsToTenant(dbPayment.tenant_id, dbPayment.credits_granted, {
          source: 'purchase',
          reference_id: paymentId,
          description: `Créditos (Getnet webhook #${paymentId})`,
        });
      }

      // Processar comissão de referral se aplicável
      await this.processReferralCommission(dbPayment.tenant_id, paymentId, dbPayment.amount_cents);
    }

    return { ok: true, action: 'payment_approved', paymentId };
  }

  /**
   * Processar pagamento negado
   */
  async handlePaymentDenied(body) {
    const paymentId = body.payment_id || body.data?.payment_id;

    await this.supabase.from('payments').update({
      status: body.event || 'DENIED',
    }).eq('getnet_payment_id', paymentId);

    return { ok: true, action: 'payment_denied', paymentId };
  }

  /**
   * Processar pagamento de assinatura recorrente
   */
  async handleSubscriptionPayment(body) {
    const subscriptionId = body.subscription_id || body.data?.subscription_id;
    const paymentId = body.payment_id || body.data?.payment_id;  // Pode vir no webhook
    const amount = body.amount || body.data?.amount;             // Valor do pagamento

    const { data: dbSub } = await this.supabase
      .from('subscriptions')
      .select('tenant_id, plan_id')
      .eq('getnet_subscription_id', subscriptionId)
      .single();

    if (dbSub) {
      const { data: plan } = await this.supabase
        .from('plans')
        .select('credits_per_month, name')
        .eq('id', dbSub.plan_id)
        .single();

      if (plan) {
        await this.addCreditsToTenant(dbSub.tenant_id, plan.credits_per_month, {
          source: 'subscription',
          reference_id: subscriptionId,
          description: `Renovação - Plano ${plan.name}`,
        });
      }

      // Processar comissão de referral se aplicável
      if (paymentId && amount) {
        await this.processReferralCommission(dbSub.tenant_id, paymentId, amount);
      }

      await this.supabase.from('subscriptions').update({
        last_payment_at: new Date().toISOString(),
      }).eq('getnet_subscription_id', subscriptionId);
    }

    return { ok: true, action: 'subscription_payment', subscriptionId };
  }

  /**
   * Processar cancelamento de assinatura
   */
  async handleSubscriptionCancelled(body) {
    const subscriptionId = body.subscription_id || body.data?.subscription_id;

    const { data: dbSub } = await this.supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('getnet_subscription_id', subscriptionId)
      .select('tenant_id')
      .single();

    if (dbSub) {
      await this.supabase.from('tenants').update({
        plan: 'trial',
        monthly_credits: 0,
        getnet_subscription_id: null,
      }).eq('id', dbSub.tenant_id);

      // Pausar comissões de referral (futuras cobranças deixarão de gerar comissão)
      const { data: referralLink } = await this.supabase
        .from('referral_links')
        .select('id')
        .eq('referee_tenant_id', dbSub.tenant_id)
        .eq('status', 'active')
        .single();

      if (referralLink) {
        await this.supabase.from('referral_links').update({
          status: 'expired',
        }).eq('id', referralLink.id);
        console.log(`[Billing:Referral] Link de referral pausado para ${dbSub.tenant_id}`);
      }
    }

    return { ok: true, action: 'subscription_cancelled', subscriptionId };
  }

  // ========================================================================
  //  Comissões de Referral
  // ========================================================================

  /**
   * Processar comissão de referral (25% de créditos)
   * Chamado quando um tenant que foi indicado por outro realiza um pagamento/assinatura
   */
  async processReferralCommission(refereeTenantId, paymentId, amountCents) {
    try {
      // Verificar se já existe comissão para este pagamento (evita duplicação em replay de webhook)
      const { data: existingCommission } = await this.supabase
        .from('referral_commissions')
        .select('id')
        .eq('getnet_payment_id', paymentId)
        .single();

      if (existingCommission) {
        console.log(`[Billing:Referral] Comissão já existe para payment_id ${paymentId}, ignorando replay`);
        return { ok: true, action: 'commission_duplicate' };
      }

      // Buscar referral_link ativo para este referee
      const { data: referralLink } = await this.supabase
        .from('referral_links')
        .select('id, referrer_tenant_id')
        .eq('referee_tenant_id', refereeTenantId)
        .eq('status', 'active')
        .single();

      if (!referralLink) {
        console.log(`[Billing:Referral] Nenhum referral ativo para referee ${refereeTenantId}`);
        return { ok: true, action: 'no_referral_found' };
      }

      // Calcular comissão: 25% em centavos
      const commissionAmount = Math.floor(amountCents * 0.25);

      // Inserir na tabela de comissões (imutável, histórico completo)
      const { data: commission, error } = await this.supabase
        .from('referral_commissions')
        .insert({
          referrer_tenant_id: referralLink.referrer_tenant_id,
          referee_tenant_id: refereeTenantId,
          referral_link_id: referralLink.id,
          getnet_payment_id: paymentId,
          payment_amount: amountCents,
          commission_rate: 0.25,
          commission_amount: commissionAmount,
          status: 'credited',
          credited_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error(`[Billing:Referral] Erro ao inserir comissão:`, error);
        return { ok: false, action: 'commission_insert_failed', error: error.message };
      }

      // Creditar comissão para o referrer
      await this.addCreditsToTenant(referralLink.referrer_tenant_id, commissionAmount, {
        source: 'referral',
        reference_id: commission.id,
        reference_type: 'referral_commission',
        description: `Comissão de referral (25% de R$${(amountCents / 100).toFixed(2)})`,
      });

      console.log(`[Billing:Referral] Comissão creditada: R$${(commissionAmount / 100).toFixed(2)} para ${referralLink.referrer_tenant_id}`);
      return {
        ok: true,
        action: 'commission_credited',
        commissionId: commission.id,
        commissionAmount,
        referrerTenantId: referralLink.referrer_tenant_id,
      };
    } catch (error) {
      console.error(`[Billing:Referral] Erro ao processar comissão:`, error);
      return { ok: false, action: 'commission_processing_failed', error: error.message };
    }
  }

  // ========================================================================
  //  Créditos — Operações atômicas na wallet
  // ========================================================================

  /**
   * Adicionar créditos ao tenant
   */
  async addCreditsToTenant(tenantId, amount, txData = {}) {
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('credits_balance')
      .eq('id', tenantId)
      .single();

    const newBalance = (tenant?.credits_balance || 0) + amount;

    await this.supabase.from('tenants').update({
      credits_balance: newBalance,
    }).eq('id', tenantId);

    await this.supabase.from('wallet_transactions').insert({
      tenant_id: tenantId,
      type: txData.type || 'credit',
      amount,
      balance_after: newBalance,
      source: txData.source || 'system',
      reference_id: txData.reference_id || null,
      reference_type: txData.reference_type || null,
      description: txData.description || `+${amount} créditos`,
    });

    return { balance: newBalance };
  }

  // ========================================================================
  //  Consultas
  // ========================================================================

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

  /**
   * Consultar status de um pagamento na Getnet
   */
  async getPaymentStatus(paymentId) {
    return this.apiFetch(`/v1/payments/credit/${paymentId}`);
  }
}

export { BillingService, CREDIT_PACKAGES };
export default BillingService;
