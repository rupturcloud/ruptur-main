import { createUazapiAdapter } from './uazapi-adapter.js';

/**
 * Gerencia múltiplos provedores WhatsApp
 * Agnóstico: UAZAPI, Evolution, etc
 */
export class ProviderManager {
  constructor() {
    this.adapters = new Map();
    this.registerAdapter('uazapi', createUazapiAdapter);
  }

  registerAdapter(name, factory) {
    this.adapters.set(name, factory);
  }

  createAdapter(providerName, credentials) {
    const factory = this.adapters.get(providerName);
    if (!factory) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    return factory(credentials);
  }

  async listInstances(providerName, credentials) {
    const adapter = this.createAdapter(providerName, credentials);
    return adapter.listInstances();
  }

  async getInstance(providerName, credentials, instanceId) {
    const adapter = this.createAdapter(providerName, credentials);
    return adapter.getInstance(instanceId);
  }

  async sendMessage(providerName, credentials, instanceId, payload) {
    const adapter = this.createAdapter(providerName, credentials);
    return adapter.sendMessage(instanceId, payload);
  }

  async updatePresence(providerName, credentials, instanceId, presence) {
    const adapter = this.createAdapter(providerName, credentials);
    return adapter.updateInstancePresence(instanceId, presence);
  }
}

export function createProviderManager() {
  return new ProviderManager();
}
