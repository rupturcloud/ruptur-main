export class WebhookNormalizerService {
  constructor(registry) {
    this.registry = registry;
  }

  normalize(provider, payload, context = {}) {
    const adapter = this.registry?.getAdapter(provider);
    if (!adapter?.normalizeWebhook) {
      throw new Error(`Adapter de webhook não registrado para ${provider}`);
    }
    return adapter.normalizeWebhook(payload, context);
  }
}
