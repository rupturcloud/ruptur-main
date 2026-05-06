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

const truthyEnv = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const packageEnvSuffix = (packageId) => String(packageId || '')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .toUpperCase();

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
    this.caktoClientId  = config.caktoClientId  || process.env.CAKTO_CLIENT_ID;
    this.caktoSecret    = config.caktoSecret    || process.env.CAKTO_CLIENT_SECRET;
    this.pocInstantCreditEnabled = truthyEnv(config.pocInstantCreditEnabled ?? process.env.BILLING_POC_INSTANT_CREDIT);
    this.pocInstantCreditTenantIds = String(
      config.pocInstantCreditTenantIds ?? process.env.BILLING_POC_INSTANT_CREDIT_TENANT_IDS ?? ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    // Cache do token OAuth2
    this._token       = null;
    this._tokenExp    = 0;
  }

  hasGetnetCredentials() {
    return Boolean(this.clientId && this.clientSecret && this.sellerId);
  }

  hasCaktoCredentials() {
    return Boolean(this.caktoClientId && this.caktoSecret);
  }

  getPackage(packageId) {
    const pkg = CREDIT_PACKAGES[packageId];
    if (!pkg) throw new Error(`Pacote inválido: ${packageId}`);
    return pkg;
  }

  /**
   * Resolve um checkout externo por pacote.
   *
   * MVP/PoC:
   * - CAKTO_CREDIT_PACKAGES_JSON='{"pack-1k":"https://..."}'
   * - CAKTO_CREDIT_PACKAGES_JSON='{"pack-1k":{"checkoutUrl":"https://..."}}'
   * - CAKTO_CHECKOUT_URL_PACK_1K=https://...
   */
  getCaktoCheckoutUrl(packageId) {
    const suffix = packageEnvSuffix(packageId);
    const directUrl = process.env[`CAKTO_CHECKOUT_URL_${suffix}`] || process.env[`CHECKOUT_URL_${suffix}`];

    if (directUrl && /^https?:\/\//i.test(directUrl)) {
      return directUrl;
    }

    const rawMap = process.env.CAKTO_CREDIT_PACKAGES_JSON;
    if (!rawMap) return null;

    try {
      const map = JSON.parse(rawMap);
      const entry = map?.[packageId];
      const url = typeof entry === 'string'
        ? entry
        : entry?.checkoutUrl || entry?.checkout_url || entry?.url;
      return url && /^https?:\/\//i.test(url) ? url : null;
    } catch (error) {
      console.warn('[Billing:Cakto] CAKTO_CREDIT_PACKAGES_JSON inválido. Ignorando mapa de checkout.');
      return null;
    }
  }

  isPocInstantCreditAllowed(tenantId) {
    if (!this.pocInstantCreditEnabled) return false;
    return this.pocInstantCreditTenantIds.includes('*') || this.pocInstantCreditTenantIds.includes(tenantId);
  }

  newInternalPaymentId(prefix, tenantId, packageId) {
    const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${tenantId}-${packageId}-${randomPart}`.slice(0, 100);
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
    const pkg = this.getPackage(packageId);

    const orderId = `${tenantId}-${packageId}-${Date.now()}`;

    const caktoCheckoutUrl = this.getCaktoCheckoutUrl(packageId);
    if (caktoCheckoutUrl) {
      const paymentId = this.newInternalPaymentId('cakto', tenantId, packageId);

      if (this.supabase) {
        await this.supabase.from('payments').upsert({
          getnet_payment_id: paymentId,
          tenant_id: tenantId,
          status: 'INITIATED',
          status_detail: 'Aguardando confirmação do checkout externo',
          amount_cents: pkg.price_cents,
          payment_type: 'credit_purchase',
          credits_granted: pkg.credits,
          metadata: {
            order_id: orderId,
            package_id: packageId,
            provider: 'cakto',
            checkout_url_configured: true,
          },
        }, { onConflict: 'getnet_payment_id' });
      }

      return {
        paymentId,
        status: 'INITIATED',
        provider: 'cakto',
        checkoutUrl: caktoCheckoutUrl,
        redirect_url: caktoCheckoutUrl,
        amountCents: pkg.price_cents,
        credits: pkg.credits,
      };
    }

    if (this.isPocInstantCreditAllowed(tenantId)) {
      if (!this.supabase) throw new Error('Supabase client necessário para crédito PoC');

      const paymentId = this.newInternalPaymentId('poc-credit', tenantId, packageId);
      await this.supabase.from('payments').upsert({
        getnet_payment_id: paymentId,
        tenant_id: tenantId,
        status: 'APPROVED',
        status_detail: 'Crédito instantâneo habilitado para PoC/MVP',
        amount_cents: pkg.price_cents,
        payment_type: 'credit_purchase',
        credits_granted: pkg.credits,
        metadata: {
          order_id: orderId,
          package_id: packageId,
          provider: 'poc_instant',
          mvp_mode: true,
        },
      }, { onConflict: 'getnet_payment_id' });

      const wallet = await this.addCreditsToTenant(tenantId, pkg.credits, {
        source: 'purchase',
        reference_id: paymentId,
        reference_type: 'poc_instant_credit',
        description: `Compra PoC/MVP de ${pkg.credits} créditos`,
      });

      return {
        paymentId,
        status: 'APPROVED',
        provider: 'poc_instant',
        creditsAdded: pkg.credits,
        balance: wallet.balance,
        amountCents: pkg.price_cents,
      };
    }

    if (!this.hasGetnetCredentials()) {
      throw new Error(
        'Nenhum checkout de créditos está configurado. Configure links de checkout Cakto por pacote ou habilite o modo PoC para este tenant.'
      );
    }

    if (!cardData?.numberToken) {
      throw new Error(
        'Checkout Getnet direto exige tokenização de cartão. Para o MVP, configure um link de checkout Cakto ou habilite crédito PoC controlado.'
      );
    }

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
  //  Grace Period — Cancelamento com Período de Carência
  // ========================================================================

  /**
   * Cancelar assinatura com período de graça de 24h
   * Usuário pode desistir durante este período
   * @param {string} subscriptionId - ID da assinatura (getnet_subscription_id)
   * @param {string} reason - Motivo do cancelamento (opcional)
   */
  async cancelSubscriptionWithGracePeriod(subscriptionId, reason = 'User requested') {
    if (!this.supabase) throw new Error('Supabase client necessário');

    // Buscar assinatura (por getnet_subscription_id)
    const { data: dbSub, error: fetchError } = await this.supabase
      .from('subscriptions')
      .select('id, tenant_id, status')
      .eq('getnet_subscription_id', subscriptionId)
      .single();

    if (fetchError || !dbSub) {
      console.error('[Billing:GracePeriod] Subscription não encontrada:', subscriptionId);
      return {
        ok: false,
        action: 'subscription_not_found',
        subscriptionId,
      };
    }

    // Validar se não está já cancelled
    if (dbSub.status === 'cancelled') {
      return {
        ok: false,
        action: 'already_cancelled',
        subscriptionId,
      };
    }

    // Chamar função Supabase para marcar com grace period
    const { data: result, error: cancelError } = await this.supabase.rpc(
      'cancel_subscription_with_grace_period',
      {
        p_subscription_id: dbSub.id,
        p_reason: reason,
      }
    );

    if (cancelError) {
      console.error('[Billing:GracePeriod] Erro ao cancelar com grace period:', cancelError);
      return {
        ok: false,
        action: 'cancellation_failed',
        error: cancelError.message,
      };
    }

    console.log(`[Billing:GracePeriod] Cancelamento agendado: ${subscriptionId} (${dbSub.tenant_id})`);

    // Enviar email ao usuário notificando sobre grace period
    // TODO: Integrar com sistema de emails
    // await this.notifyUserGracePeriod(dbSub.tenant_id, result.grace_period_until);

    return {
      ok: true,
      action: 'cancellation_scheduled',
      subscriptionId,
      gracePeriodUntil: result.grace_period_until,
      canBeResumedUntil: result.can_be_resumed_until,
    };
  }

  /**
   * Resumir assinatura (desistir do cancelamento)
   * Só funciona durante o grace period
   * @param {string} subscriptionId - ID da assinatura (getnet_subscription_id)
   */
  async resumeSubscription(subscriptionId) {
    if (!this.supabase) throw new Error('Supabase client necessário');

    // Buscar assinatura
    const { data: dbSub, error: fetchError } = await this.supabase
      .from('subscriptions')
      .select('id, tenant_id, pending_cancellation, grace_period_until')
      .eq('getnet_subscription_id', subscriptionId)
      .single();

    if (fetchError || !dbSub) {
      console.error('[Billing:GracePeriod] Subscription não encontrada:', subscriptionId);
      return {
        ok: false,
        action: 'subscription_not_found',
        subscriptionId,
      };
    }

    // Validar se está com cancelamento pendente
    if (!dbSub.pending_cancellation) {
      return {
        ok: false,
        action: 'not_pending_cancellation',
        subscriptionId,
      };
    }

    // Validar se ainda está dentro do grace period
    const gracePeriodExpired = new Date(dbSub.grace_period_until) < new Date();
    if (gracePeriodExpired) {
      return {
        ok: false,
        action: 'grace_period_expired',
        subscriptionId,
      };
    }

    // Chamar função Supabase para resumir
    const { data: result, error: resumeError } = await this.supabase.rpc(
      'resume_subscription',
      { p_subscription_id: dbSub.id }
    );

    if (resumeError) {
      console.error('[Billing:GracePeriod] Erro ao resumir:', resumeError);
      return {
        ok: false,
        action: 'resume_failed',
        error: resumeError.message,
      };
    }

    console.log(`[Billing:GracePeriod] Assinatura resumida: ${subscriptionId} (${dbSub.tenant_id})`);

    // TODO: Enviar email confirmando resumo

    return {
      ok: true,
      action: 'subscription_resumed',
      subscriptionId,
    };
  }

  /**
   * Processar cancelamentos com grace period expirado
   * Deve ser chamado periodicamente (cron job a cada hora)
   */
  async processPendingCancellations() {
    if (!this.supabase) throw new Error('Supabase client necessário');

    try {
      console.log('[Billing:GracePeriod] Iniciando processamento de cancelamentos expirados...');

      // Chamar função Supabase que processa todos os grace periods expirados
      const { data: result, error } = await this.supabase.rpc(
        'process_expired_grace_periods'
      );

      if (error) {
        console.error('[Billing:GracePeriod] Erro ao processar:', error);
        return {
          ok: false,
          action: 'processing_failed',
          error: error.message,
        };
      }

      console.log(
        `[Billing:GracePeriod] Processamento completo: ${result.processed_count} processados, ${result.failed_count} erros`
      );

      return {
        ok: true,
        action: 'grace_periods_processed',
        processedCount: result.processed_count,
        failedCount: result.failed_count,
        details: result.details,
      };
    } catch (error) {
      console.error('[Billing:GracePeriod] Exceção ao processar:', error);
      return {
        ok: false,
        action: 'processing_exception',
        error: error.message,
      };
    }
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

  // ========================================================================
  //  Reconciliação Financeira
  // ========================================================================

  /**
   * Reconciliar pagamentos entre banco local e Getnet API
   * Compara status dos pagamentos e corrige discrepâncias
   * Deve rodar periodicamente (a cada 6h) via cron job
   *
   * @param {object} options
   *   - daysBack: quantos dias no passado procurar (padrão: 7)
   *   - autoFix: corrigir discrepâncias automaticamente (padrão: true)
   *   - notifyOnDifference: notificar admin se houver diff (padrão: true)
   */
  async reconcilePayments(options = {}) {
    if (!this.supabase) throw new Error('Supabase client necessário');

    const {
      daysBack = 7,
      autoFix = true,
      notifyOnDifference = true,
    } = options;

    console.log(`[Billing:Reconciliation] Iniciando reconciliação (últimos ${daysBack} dias)...`);

    const reconciliationResult = {
      totalPayments: 0,
      matchedPayments: 0,
      discrepancies: [],
      corrected: [],
      errors: [],
      startTime: new Date().toISOString(),
    };

    try {
      // 1. Buscar todos os pagamentos no banco dos últimos N dias
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const { data: localPayments, error: fetchError } = await this.supabase
        .from('payments')
        .select('id, getnet_payment_id, status, amount_cents, created_at, credits_granted')
        .gte('created_at', cutoffDate.toISOString())
        .eq('payment_type', 'credit_purchase');

      if (fetchError) {
        console.error('[Reconciliation] Erro ao buscar pagamentos:', fetchError);
        throw fetchError;
      }

      reconciliationResult.totalPayments = localPayments?.length || 0;

      // 2. Para cada pagamento, validar status na Getnet
      for (const localPayment of localPayments || []) {
        try {
          // Ignorar pagamentos iniciados há menos de 1h (podem estar em processamento)
          const ageMinutes = (Date.now() - new Date(localPayment.created_at).getTime()) / 60000;
          if (ageMinutes < 60) {
            reconciliationResult.matchedPayments++;
            continue;
          }

          // Buscar status na Getnet
          const getnetPayment = await this.getPaymentStatus(localPayment.getnet_payment_id);

          // Comparar status
          const localStatus = localPayment.status;
          const getnetStatus = getnetPayment.status;

          if (localStatus !== getnetStatus) {
            // 🚨 DISCREPÂNCIA ENCONTRADA
            console.warn(
              `[Reconciliation] ⚠️ Discrepância em ${localPayment.getnet_payment_id}: ` +
              `local=${localStatus}, getnet=${getnetStatus}`
            );

            const discrepancy = {
              paymentId: localPayment.getnet_payment_id,
              localStatus,
              getnetStatus,
              amount_cents: localPayment.amount_cents,
              creditsGranted: localPayment.credits_granted,
              detectedAt: new Date().toISOString(),
            };

            reconciliationResult.discrepancies.push(discrepancy);

            // Auto-correção se habilitada
            if (autoFix) {
              try {
                // Atualizar status local para corresponder à Getnet
                await this.supabase
                  .from('payments')
                  .update({ status: getnetStatus })
                  .eq('getnet_payment_id', localPayment.getnet_payment_id);

                // Se Getnet diz APPROVED mas localmente não creditou, adicionar créditos
                if (getnetStatus === 'APPROVED' && localStatus !== 'APPROVED' && localPayment.credits_granted > 0) {
                  const tenantId = (
                    await this.supabase
                      .from('payments')
                      .select('tenant_id')
                      .eq('getnet_payment_id', localPayment.getnet_payment_id)
                      .single()
                  ).data?.tenant_id;

                  if (tenantId) {
                    await this.addCreditsToTenant(tenantId, localPayment.credits_granted, {
                      source: 'reconciliation',
                      reference_id: localPayment.getnet_payment_id,
                      description: `Reconciliação: Créditos corrigidos (${localPayment.credits_granted} créditos)`,
                    });

                    console.log(
                      `[Reconciliation] ✅ Corrigido: ${localPayment.getnet_payment_id} ` +
                      `(${localPayment.credits_granted} créditos re-creditados)`
                    );
                  }
                }

                reconciliationResult.corrected.push({
                  paymentId: localPayment.getnet_payment_id,
                  action: 'status_updated',
                  from: localStatus,
                  to: getnetStatus,
                });
              } catch (fixError) {
                console.error('[Reconciliation] Erro ao corrigir:', fixError);
                reconciliationResult.errors.push({
                  paymentId: localPayment.getnet_payment_id,
                  error: fixError.message,
                });
              }
            }
          } else {
            // ✅ Status coincide
            reconciliationResult.matchedPayments++;
          }
        } catch (paymentError) {
          console.warn(`[Reconciliation] Erro ao validar ${localPayment.getnet_payment_id}:`, paymentError.message);
          reconciliationResult.errors.push({
            paymentId: localPayment.getnet_payment_id,
            error: paymentError.message,
          });
        }
      }

      // 3. Registrar resultado na auditoria
      await this.supabase.from('reconciliation_logs').insert({
        reconciled_at: new Date().toISOString(),
        days_back: daysBack,
        total_checked: reconciliationResult.totalPayments,
        matched_count: reconciliationResult.matchedPayments,
        discrepancy_count: reconciliationResult.discrepancies.length,
        corrected_count: reconciliationResult.corrected.length,
        error_count: reconciliationResult.errors.length,
        auto_fix_enabled: autoFix,
        details: reconciliationResult,
      }).catch(err => {
        console.warn('[Reconciliation] Aviso: Não consegui registrar log:', err.message);
      });

      reconciliationResult.endTime = new Date().toISOString();

      // 4. Notificar se houver discrepâncias e notifyOnDifference = true
      if (notifyOnDifference && reconciliationResult.discrepancies.length > 0) {
        console.error(
          `[Reconciliation] 🚨 ${reconciliationResult.discrepancies.length} discrepâncias encontradas! ` +
          `${reconciliationResult.corrected.length} corrigidas.`
        );
        // TODO: Integrar com Slack/email para notificação ao admin
      }

      console.log(
        `[Reconciliation] ✅ Completo: ${reconciliationResult.matchedPayments}/${reconciliationResult.totalPayments} ` +
        `combinaram, ${reconciliationResult.discrepancies.length} discrepâncias, ` +
        `${reconciliationResult.corrected.length} corrigidas`
      );

      return {
        ok: true,
        action: 'reconciliation_complete',
        ...reconciliationResult,
      };
    } catch (error) {
      console.error('[Reconciliation] Erro durante reconciliação:', error);
      return {
        ok: false,
        action: 'reconciliation_failed',
        error: error.message,
        ...reconciliationResult,
      };
    }
  }
}

export { BillingService, CREDIT_PACKAGES };
export default BillingService;
