/**
 * Contratos canônicos compartilhados entre adapters externos e motores internos.
 */

export const INTERNAL_EVENT_TYPES = Object.freeze({
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_APPROVED: 'payment.approved',
  PAYMENT_DECLINED: 'payment.declined',
  PAYMENT_CANCELLED: 'payment.cancelled',
  PAYMENT_REFUNDED: 'payment.refunded',
  PAYMENT_CHARGEBACK: 'payment.chargeback',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  MESSAGE_RECEIVED: 'message.received',
});

export const PAYMENT_STATUS_MAP = Object.freeze({
  approved: INTERNAL_EVENT_TYPES.PAYMENT_APPROVED,
  paid: INTERNAL_EVENT_TYPES.PAYMENT_APPROVED,
  captured: INTERNAL_EVENT_TYPES.PAYMENT_APPROVED,
  confirmed: INTERNAL_EVENT_TYPES.PAYMENT_APPROVED,
  succeeded: INTERNAL_EVENT_TYPES.PAYMENT_APPROVED,
  denied: INTERNAL_EVENT_TYPES.PAYMENT_DECLINED,
  declined: INTERNAL_EVENT_TYPES.PAYMENT_DECLINED,
  failed: INTERNAL_EVENT_TYPES.PAYMENT_DECLINED,
  cancelled: INTERNAL_EVENT_TYPES.PAYMENT_CANCELLED,
  canceled: INTERNAL_EVENT_TYPES.PAYMENT_CANCELLED,
  refunded: INTERNAL_EVENT_TYPES.PAYMENT_REFUNDED,
  chargeback: INTERNAL_EVENT_TYPES.PAYMENT_CHARGEBACK,
  disputed: INTERNAL_EVENT_TYPES.PAYMENT_CHARGEBACK,
});

export function normalizeExternalStatus(status) {
  return String(status || '').trim().toLowerCase();
}

export function eventTypeFromPaymentStatus(status, fallback = INTERNAL_EVENT_TYPES.PAYMENT_CREATED) {
  return PAYMENT_STATUS_MAP[normalizeExternalStatus(status)] || fallback;
}

export function buildInternalEvent({
  provider,
  providerEventId,
  type,
  resource = 'unknown',
  externalReference,
  tenantId = null,
  amount = null,
  currency = 'BRL',
  occurredAt = new Date().toISOString(),
  rawPayload = {},
  normalizedPayload = {},
  metadata = {},
  eventVersion = 1,
}) {
  if (!provider) throw new Error('provider é obrigatório');
  if (!type) throw new Error('type é obrigatório');

  return {
    provider,
    providerEventId: providerEventId || externalReference || null,
    type,
    resource,
    externalReference: externalReference || providerEventId || null,
    tenantId,
    amount,
    currency,
    occurredAt,
    eventVersion,
    payload: {
      raw: rawPayload || {},
      normalized: normalizedPayload || {},
    },
    metadata: metadata || {},
  };
}
