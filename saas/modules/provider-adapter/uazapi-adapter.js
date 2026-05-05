import { IProviderAdapter, ProviderAdapterError } from './types.js';

export class UazapiAdapter extends IProviderAdapter {
  constructor(credentials) {
    super(credentials);
    // credentials = { adminToken, serverUrl }
    this.serverUrl = credentials.serverUrl || 'https://tiatendeai.uazapi.com';
    this.adminToken = credentials.adminToken;
    this.instanceToken = credentials.instanceToken;
  }

  async fetchJson(url, init = {}, fallbackMessage = 'Request failed') {
    const response = await fetch(url, init);
    if (!response.ok) {
      let message = `${fallbackMessage}: ${response.status}`;
      try {
        const payload = await response.json();
        if (typeof payload?.error === 'string') {
          message = payload.error;
        }
      } catch {}
      throw new ProviderAdapterError(message, 'UAZAPI_ERROR');
    }
    return response.json();
  }

  async listInstances() {
    if (!this.adminToken) {
      throw new ProviderAdapterError('Admin token required', 'MISSING_CREDENTIALS');
    }

    const instances = await this.fetchJson(
      `${this.serverUrl}/instance/all`,
      {
        headers: { admintoken: this.adminToken },
      },
      'Failed to fetch instances'
    );

    return Array.isArray(instances) ? instances.map(i => this.normalizeInstance(i)) : [];
  }

  async createInstance({ name, systemName = 'ruptur-cloud', adminField01, adminField02 } = {}) {
    if (!this.adminToken) {
      throw new ProviderAdapterError('Admin token required', 'MISSING_CREDENTIALS');
    }
    if (!name) {
      throw new ProviderAdapterError('Instance name required', 'INVALID_PAYLOAD');
    }

    return this.fetchJson(
      `${this.serverUrl}/instance/create`,
      {
        method: 'POST',
        headers: {
          admintoken: this.adminToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          systemName,
          ...(adminField01 ? { adminField01 } : {}),
          ...(adminField02 ? { adminField02 } : {}),
        }),
      },
      'Failed to create instance'
    );
  }

  async getInstance(instanceId) {
    const instance = await this.fetchJson(
      `${this.serverUrl}/instance/status`,
      {
        headers: { token: instanceId },
      },
      'Failed to fetch instance'
    );

    return this.normalizeInstance(instance);
  }

  async sendMessage(instanceId, payload) {
    const { to, type, content, mediaUrl } = payload;

    if (type === 'text') {
      return this.fetchJson(
        `${this.serverUrl}/send/text`,
        {
          method: 'POST',
          headers: {
            token: instanceId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: to,
            text: content,
          }),
        },
        'Failed to send text message'
      );
    }

    if (type === 'media') {
      return this.fetchJson(
        `${this.serverUrl}/send/media`,
        {
          method: 'POST',
          headers: {
            token: instanceId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: to,
            url: mediaUrl,
          }),
        },
        'Failed to send media message'
      );
    }

    throw new ProviderAdapterError(`Unsupported message type: ${type}`, 'INVALID_MESSAGE_TYPE');
  }

  async updateInstancePresence(instanceId, presence) {
    return this.fetchJson(
      `${this.serverUrl}/instance/presence`,
      {
        method: 'POST',
        headers: {
          token: instanceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ presence }),
      },
      'Failed to update presence'
    );
  }

  async getInstanceStatus(instanceId) {
    return this.fetchJson(
      `${this.serverUrl}/instance/status`,
      {
        headers: { token: instanceId },
      },
      'Failed to get instance status'
    );
  }

  async connectInstance(instanceId, { phone } = {}) {
    return this.fetchJson(
      `${this.serverUrl}/instance/connect`,
      {
        method: 'POST',
        headers: {
          token: instanceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(phone ? { phone } : {}),
      },
      'Failed to connect instance'
    );
  }

  async disconnectInstance(instanceId) {
    return this.fetchJson(
      `${this.serverUrl}/instance/disconnect`,
      {
        method: 'POST',
        headers: { token: instanceId },
      },
      'Failed to disconnect instance'
    );
  }

  async deleteInstance(instanceId) {
    return this.fetchJson(
      `${this.serverUrl}/instance`,
      {
        method: 'DELETE',
        headers: { token: instanceId },
      },
      'Failed to delete instance'
    );
  }

  async updateAdminFields({ id, adminField01, adminField02 } = {}) {
    if (!this.adminToken) {
      throw new ProviderAdapterError('Admin token required', 'MISSING_CREDENTIALS');
    }
    if (!id) {
      throw new ProviderAdapterError('Instance id required', 'INVALID_PAYLOAD');
    }

    return this.fetchJson(
      `${this.serverUrl}/instance/updateAdminFields`,
      {
        method: 'POST',
        headers: {
          admintoken: this.adminToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, adminField01, adminField02 }),
      },
      'Failed to update admin fields'
    );
  }

  normalizeInstance(raw) {
    return {
      id: raw.token || raw.id,
      name: raw.name || raw.profileName || 'Unknown',
      status: raw.status || 'disconnected',
      number: raw.status?.status?.jid?.user || raw.owner || null,
      isBusiness: raw.isBusiness ?? false,
      platform: raw.platform || raw.plataform || 'Unknown',
      metadata: {
        id: raw.id,
        token: raw.token,
        systemName: raw.systemName,
        paircode: raw.paircode,
        qrcode: raw.qrcode,
        profileName: raw.profileName,
        profilePicUrl: raw.profilePicUrl,
        adminField01: raw.adminField01,
        adminField02: raw.adminField02,
        lastDisconnect: raw.lastDisconnect,
        lastDisconnectReason: raw.lastDisconnectReason,
        raw,
      },
    };
  }

  normalizeCredentials(raw) {
    return {
      serverUrl: raw.serverUrl || 'https://tiatendeai.uazapi.com',
      adminToken: raw.adminToken,
      instanceToken: raw.instanceToken,
    };
  }
}

export function createUazapiAdapter(credentials) {
  return new UazapiAdapter(credentials);
}
