import {
  getIntegrationPreset,
  listIntegrationPresets,
  normalizeProviderKey,
} from './provider-presets.js';

/**
 * Registry de integrações.
 * Mantém adapters plugáveis e presets conhecidos sem acoplar motores internos
 * aos detalhes de cada API externa.
 */
export class IntegrationRegistry {
  constructor({ presets = listIntegrationPresets(), adapters = {} } = {}) {
    this.presets = new Map(presets.map((preset) => [normalizeProviderKey(preset.key), preset]));
    this.adapters = new Map();

    for (const [provider, adapter] of Object.entries(adapters)) {
      this.registerAdapter(provider, adapter);
    }
  }

  registerAdapter(provider, adapter) {
    const key = normalizeProviderKey(provider);
    if (!key) throw new Error('Provider obrigatório para registrar adapter');
    if (!adapter) throw new Error(`Adapter inválido para ${provider}`);
    this.adapters.set(key, adapter);
    return this;
  }

  getPreset(provider) {
    const key = normalizeProviderKey(provider);
    return this.presets.get(key) || getIntegrationPreset(key);
  }

  getAdapter(provider) {
    return this.adapters.get(normalizeProviderKey(provider)) || null;
  }

  requireAdapter(provider) {
    const adapter = this.getAdapter(provider);
    if (!adapter) throw new Error(`Adapter não registrado para ${provider}`);
    return adapter;
  }

  list({ kind } = {}) {
    return Array.from(this.presets.values()).filter((preset) => !kind || preset.kind === kind);
  }
}

export const integrationRegistry = new IntegrationRegistry();
