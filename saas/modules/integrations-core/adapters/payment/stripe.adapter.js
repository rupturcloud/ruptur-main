import crypto from 'node:crypto';
import { GenericPaymentAdapter } from './generic-payment.adapter.js';

/**
 * Stripe Payment Adapter
 *
 * Integra Stripe como payment provider agnóstico.
 * Normaliza webhooks Stripe para formato interno genérico.
 *
 * Webhooks mapeados:
 * - payment_intent.succeeded → APPROVED
 * - payment_intent.payment_failed → DENIED
 * - customer.subscription.updated → subscription_updated
 * - invoice.payment_succeeded → subscription_payment
 */
export class StripePaymentAdapter extends GenericPaymentAdapter {
  constructor(credentials = {}) {
    super({
      provider: 'stripe',
      statusKeys: [
        'status',
        'payment_intent.status',
        'data.object.status'
      ],
      idKeys: [
        'id',
        'event_id',
        'payment_intent_id',
        'data.object.id',
        'data.object.payment_intent'
      ],
      amountKeys: [
        'amount',
        'amount_received',
        'data.object.amount',
        'data.object.amount_received'
      ],
      tenantKeys: [
        'metadata.tenant_id',
        'data.object.metadata.tenant_id'
      ]
    });

    this.secretKey = credentials.secretKey || process.env.STRIPE_SECRET_KEY;
    this.publishableKey = credentials.publishableKey || process.env.STRIPE_PUBLISHABLE_KEY;
    this.webhookSecret = credentials.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Valida assinatura webhook Stripe
   *
   * Stripe envia:
   * - body (raw)
   * - stripe-signature header (t=timestamp,v1=signature)
   */
  validateWebhookSignature(rawBody, stripeSignature) {
    if (!this.webhookSecret) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET não configurado');
      return false;
    }

    try {
      const signature = stripeSignature.split(',').reduce((obj, pair) => {
        const [key, value] = pair.split('=');
        obj[key] = value;
        return obj;
      }, {});

      const { t: timestamp, v1: signatureProvided } = signature;

      if (!timestamp || !signatureProvided) {
        console.error('❌ Signature inválida: faltam timestamp ou v1');
        return false;
      }

      // Calcula HMAC-SHA256
      const signedContent = `${timestamp}.${rawBody}`;
      const computedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(signedContent)
        .digest('hex');

      // Verifica match
      const isValid = computedSignature === signatureProvided;

      if (!isValid) {
        console.error('❌ Signature mismatch');
        return false;
      }

      // Verifica timestamp (máx 5min de diferença)
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTime - parseInt(timestamp));

      if (timeDiff > 300) {
        console.warn(`⚠️ Webhook timestamp muito antigo: ${timeDiff}s atrás`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Erro validando webhook Stripe:', error.message);
      return false;
    }
  }

  /**
   * Normaliza eventos Stripe para formato interno
   *
   * Stripe envia:
   * {
   *   "id": "evt_1234",
   *   "type": "payment_intent.succeeded",
   *   "data": {
   *     "object": {
   *       "id": "pi_1234",
   *       "status": "succeeded",
   *       "amount": 99900,
   *       "metadata": { "tenant_id": "..." }
   *     }
   *   }
   * }
   */
  normalizeWebhook(payload, context = {}) {
    const { type, id: eventId, data = {} } = payload;
    const { object = {} } = data;

    // Mapeia tipo Stripe para status interno
    let internalStatus = 'unknown';
    let internalType = 'payment';

    switch (type) {
      case 'payment_intent.succeeded':
        internalStatus = 'APPROVED';
        internalType = 'payment';
        break;
      case 'payment_intent.payment_failed':
        internalStatus = 'DENIED';
        internalType = 'payment';
        break;
      case 'charge.refunded':
        internalStatus = 'REFUNDED';
        internalType = 'refund';
        break;
      case 'customer.subscription.updated':
        internalStatus = object.status || 'unknown';
        internalType = 'subscription_update';
        break;
      case 'customer.subscription.deleted':
        internalStatus = 'CANCELLED';
        internalType = 'subscription_update';
        break;
      case 'invoice.payment_succeeded':
        internalStatus = 'APPROVED';
        internalType = 'subscription_payment';
        break;
      case 'invoice.payment_failed':
        internalStatus = 'DENIED';
        internalType = 'subscription_payment';
        break;
      default:
        console.warn(`⚠️ Tipo Stripe não mapeado: ${type}`);
        internalStatus = 'unknown';
    }

    // Extrai IDs
    const providerEventId = context.providerEventId || eventId;
    const externalReference =
      context.externalReference ||
      object.id ||
      object.payment_intent ||
      object.invoice ||
      providerEventId;

    // Extrai amount (Stripe usa cents)
    const amount = object.amount || object.amount_received || null;

    // Extrai tenant
    const tenantId =
      context.tenantId ||
      object.metadata?.tenant_id ||
      null;

    // Chama parent para construir evento normalizado
    return super.normalizeWebhook(
      {
        ...payload,
        status: internalStatus,
        event_id: eventId,
        payment_id: object.id,
        amount: amount,
        currency: object.currency || 'brl',
        created_at: object.created
          ? new Date(object.created * 1000).toISOString()
          : new Date().toISOString(),
        metadata: object.metadata || {}
      },
      {
        ...context,
        providerEventId,
        externalReference,
        tenantId
      }
    );
  }

  /**
   * Cria cobrança via Stripe (implementado no billingService)
   * Este é um placeholder para documentação
   */
  async createCharge(amount, tenantId, paymentMethodId) {
    if (!this.secretKey) {
      throw new Error('STRIPE_SECRET_KEY não configurado');
    }

    // Nota: Implementação real usa library @stripe/stripe-js
    // Aqui apenas documentamos a interface esperada

    throw new Error(
      'createCharge deve ser chamado via billingService, não diretamente'
    );
  }

  /**
   * Cria subscription via Stripe
   */
  async createSubscription(customerId, priceId, metadata) {
    if (!this.secretKey) {
      throw new Error('STRIPE_SECRET_KEY não configurado');
    }

    throw new Error(
      'createSubscription deve ser chamado via billingService, não diretamente'
    );
  }

  /**
   * Processa refund
   */
  async createRefund(chargeId, amount) {
    if (!this.secretKey) {
      throw new Error('STRIPE_SECRET_KEY não configurado');
    }

    throw new Error(
      'createRefund deve ser chamado via billingService, não diretamente'
    );
  }

  /**
   * Getter: Stripe provider name
   */
  get provider() {
    return 'stripe';
  }

  /**
   * Getter: Credenciais (sans secretKey)
   */
  getPublicConfig() {
    return {
      provider: 'stripe',
      publishableKey: this.publishableKey,
      webhookSecret: this.webhookSecret ? '***' : null
    };
  }
}

export default StripePaymentAdapter;
