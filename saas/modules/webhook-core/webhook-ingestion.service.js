import { buildWebhookIdempotencyKey } from './idempotency.service.js';

export class WebhookIngestionService {
  constructor({ normalizer, idempotencyStore, dispatcher = null } = {}) {
    this.normalizer = normalizer;
    this.idempotencyStore = idempotencyStore;
    this.dispatcher = dispatcher;
  }

  async ingest({ provider, payload, headers = {}, context = {} }) {
    if (!provider) throw new Error('provider é obrigatório');
    if (!payload || typeof payload !== 'object') throw new Error('payload inválido');

    const normalizedEvent = this.normalizer.normalize(provider, payload, { ...context, headers });
    const idempotencyKey = buildWebhookIdempotencyKey({
      provider,
      providerEventId: normalizedEvent.providerEventId,
      eventType: normalizedEvent.type,
      externalReference: normalizedEvent.externalReference,
      payload,
    });

    const idempotency = this.idempotencyStore?.checkAndSet(idempotencyKey, {
      provider,
      eventType: normalizedEvent.type,
      externalReference: normalizedEvent.externalReference,
    }) || { isNew: true };

    if (!idempotency.isNew) {
      return { accepted: true, duplicate: true, idempotencyKey, event: normalizedEvent };
    }

    if (this.dispatcher?.dispatch) {
      await this.dispatcher.dispatch(normalizedEvent);
    }

    return { accepted: true, duplicate: false, idempotencyKey, event: normalizedEvent };
  }
}
