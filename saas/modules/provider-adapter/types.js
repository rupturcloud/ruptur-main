/**
 * Interface agnóstica para qualquer provider de WhatsApp
 * Implementações: UAZAPI, Evolution, etc
 */

export class ProviderAdapterError extends Error {
  constructor(message, code = 'PROVIDER_ERROR') {
    super(message);
    this.code = code;
    this.name = 'ProviderAdapterError';
  }
}

export class NotImplementedError extends ProviderAdapterError {
  constructor(method) {
    super(`Method ${method} not implemented`, 'NOT_IMPLEMENTED');
  }
}

/**
 * @typedef {Object} ProviderInstance
 * @property {string} id - ID único (token UAZAPI, etc)
 * @property {string} name - Nome/label da instância
 * @property {string} status - 'connected' | 'disconnected' | 'connecting'
 * @property {string} number - Número WhatsApp resolvido
 * @property {boolean} isBusiness - É conta business
 * @property {string} platform - 'Android' | 'iOS' | 'Web'
 * @property {Object} metadata - Dados específicos do provider
 */

/**
 * @typedef {Object} SendMessagePayload
 * @property {string} to - Número ou ID do destinatário
 * @property {string} type - 'text' | 'media' | 'audio'
 * @property {string} content - Conteúdo da mensagem
 * @property {string} [mediaUrl] - URL para media
 */

export class IProviderAdapter {
  constructor(credentials) {
    this.credentials = credentials;
  }

  async listInstances() {
    throw new NotImplementedError('listInstances');
  }

  async getInstance(instanceId) {
    throw new NotImplementedError('getInstance');
  }

  async sendMessage(instanceId, payload) {
    throw new NotImplementedError('sendMessage');
  }

  async updateInstancePresence(instanceId, presence) {
    throw new NotImplementedError('updateInstancePresence');
  }

  async getInstanceStatus(instanceId) {
    throw new NotImplementedError('getInstanceStatus');
  }

  normalizeInstance(rawInstance) {
    throw new NotImplementedError('normalizeInstance');
  }

  normalizeCredentials(rawCredentials) {
    throw new NotImplementedError('normalizeCredentials');
  }
}
