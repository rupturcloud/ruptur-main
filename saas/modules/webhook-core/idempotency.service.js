import crypto from 'node:crypto';

export function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');
}

export function buildWebhookIdempotencyKey({ provider, providerEventId, eventType, externalReference, payload }) {
  const safeProvider = String(provider || 'unknown').trim().toLowerCase();
  if (providerEventId) return `${safeProvider}:event:${providerEventId}`;
  if (eventType && externalReference) return `${safeProvider}:${eventType}:${externalReference}`;
  return `${safeProvider}:payload:${stableHash(payload)}`;
}

export class MemoryIdempotencyStore {
  constructor() {
    this.keys = new Map();
  }

  checkAndSet(key, value = {}) {
    if (this.keys.has(key)) return { isNew: false, existing: this.keys.get(key) };
    const record = { key, ...value, createdAt: new Date().toISOString() };
    this.keys.set(key, record);
    return { isNew: true, record };
  }
}
