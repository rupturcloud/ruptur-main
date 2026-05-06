import { buildInternalEvent, eventTypeFromPaymentStatus } from '../../contracts.js';

function pickFirst(payload, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce((acc, part) => acc?.[part], payload);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

export class GenericPaymentAdapter {
  constructor({ provider, statusKeys = [], idKeys = [], amountKeys = [], tenantKeys = [] } = {}) {
    if (!provider) throw new Error('provider é obrigatório');
    this.provider = provider;
    this.statusKeys = statusKeys.length ? statusKeys : ['status', 'payment.status', 'transaction.status', 'event.status'];
    this.idKeys = idKeys.length ? idKeys : ['event_id', 'id', 'payment_id', 'transaction_id', 'order.id', 'payment.id'];
    this.amountKeys = amountKeys.length ? amountKeys : ['amount', 'amount_cents', 'payment.amount', 'transaction.amount'];
    this.tenantKeys = tenantKeys.length ? tenantKeys : ['tenant_id', 'tenantId', 'metadata.tenant_id', 'metadata.tenantId'];
  }

  normalizeWebhook(payload = {}, context = {}) {
    const status = pickFirst(payload, this.statusKeys);
    const providerEventId = context.providerEventId || pickFirst(payload, this.idKeys);
    const externalReference = pickFirst(payload, ['external_reference', 'reference', 'order_id', 'order.id', 'payment.id', 'transaction_id']) || providerEventId;
    const amount = pickFirst(payload, this.amountKeys);
    const tenantId = context.tenantId || pickFirst(payload, this.tenantKeys);

    return buildInternalEvent({
      provider: this.provider,
      providerEventId,
      type: eventTypeFromPaymentStatus(status),
      resource: 'payment',
      externalReference,
      tenantId,
      amount: amount === null ? null : Number(amount),
      currency: pickFirst(payload, ['currency', 'payment.currency']) || 'BRL',
      occurredAt: pickFirst(payload, ['created_at', 'createdAt', 'event.created_at', 'date_created']) || new Date().toISOString(),
      rawPayload: payload,
      normalizedPayload: { status, externalReference, amount, tenantId },
      metadata: context.metadata || {},
    });
  }
}
