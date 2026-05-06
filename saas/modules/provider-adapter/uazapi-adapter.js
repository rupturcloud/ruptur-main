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
        if (typeof payload?.error === 'string') message = payload.error;
        else if (typeof payload?.message === 'string') message = payload.message;
      } catch {}
      throw new ProviderAdapterError(message, 'UAZAPI_ERROR');
    }

    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { ok: true, raw: text };
    }
  }

  async adminRequest(path, { method = 'GET', body, headers = {} } = {}, fallbackMessage) {
    if (!this.adminToken) {
      throw new ProviderAdapterError('Admin token required', 'MISSING_CREDENTIALS');
    }

    return this.fetchJson(
      `${this.serverUrl}${path}`,
      {
        method,
        headers: {
          admintoken: this.adminToken,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
      fallbackMessage
    );
  }

  async instanceRequest(instanceId, path, { method = 'GET', body, headers = {} } = {}, fallbackMessage) {
    if (!instanceId) {
      throw new ProviderAdapterError('Instance token required', 'MISSING_CREDENTIALS');
    }

    return this.fetchJson(
      `${this.serverUrl}${path}`,
      {
        method,
        headers: {
          token: instanceId,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
      fallbackMessage
    );
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

  async sendMessage(instanceId, payload = {}) {
    const { to, type = 'text', content, mediaUrl, ...rest } = payload;
    const number = payload.number || to;

    if (type === 'text') {
      return this.sendText(instanceId, { number, text: payload.text || content, ...rest });
    }

    if (type === 'media' || ['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {
      return this.sendMedia(instanceId, {
        number,
        type: payload.mediaType || (type === 'media' ? payload.typeMedia || 'image' : type),
        file: payload.file || mediaUrl || payload.url,
        text: payload.text || content,
        ...rest,
      });
    }

    if (type === 'contact') return this.sendContact(instanceId, { number, ...rest });
    if (type === 'location') return this.sendLocation(instanceId, { number, ...rest });
    if (type === 'menu') return this.sendMenu(instanceId, { number, text: payload.text || content, ...rest });
    if (type === 'carousel') return this.sendCarousel(instanceId, { number, text: payload.text || content, ...rest });

    throw new ProviderAdapterError(`Unsupported message type: ${type}`, 'INVALID_MESSAGE_TYPE');
  }

  async sendText(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/send/text', {
      method: 'POST',
      body: payload,
    }, 'Failed to send text message');
  }

  async sendMedia(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/send/media', {
      method: 'POST',
      body: payload,
    }, 'Failed to send media message');
  }

  async sendContact(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/send/contact', {
      method: 'POST',
      body: payload,
    }, 'Failed to send contact message');
  }

  async sendLocation(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/send/location', {
      method: 'POST',
      body: payload,
    }, 'Failed to send location message');
  }

  async sendMenu(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/send/menu', {
      method: 'POST',
      body: payload,
    }, 'Failed to send menu message');
  }

  async sendCarousel(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/send/carousel', {
      method: 'POST',
      body: payload,
    }, 'Failed to send carousel message');
  }

  async sendPixButton(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/send/pix-button', {
      method: 'POST',
      body: payload,
    }, 'Failed to send PIX button');
  }

  async sendRequestPayment(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/send/request-payment', {
      method: 'POST',
      body: payload,
    }, 'Failed to send payment request');
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
    return this.instanceRequest(instanceId, '/instance', { method: 'DELETE' }, 'Failed to delete instance');
  }

  async resetInstance(instanceId) {
    return this.instanceRequest(instanceId, '/instance/reset', { method: 'POST' }, 'Failed to reset instance');
  }

  async updateInstanceName(instanceId, name) {
    return this.instanceRequest(instanceId, '/instance/updateInstanceName', {
      method: 'POST',
      body: { name },
    }, 'Failed to update instance name');
  }

  async getWAMessageLimits(instanceId) {
    return this.instanceRequest(instanceId, '/instance/wa_messages_limits', {}, 'Failed to get WhatsApp message limits');
  }

  async updateDelaySettings(instanceId, settings = {}) {
    return this.instanceRequest(instanceId, '/instance/updateDelaySettings', {
      method: 'POST',
      body: settings,
    }, 'Failed to update delay settings');
  }

  async getProxyConfig(instanceId) {
    return this.instanceRequest(instanceId, '/instance/proxy', {}, 'Failed to get proxy config');
  }

  async updateProxyConfig(instanceId, proxyConfig = {}) {
    return this.instanceRequest(instanceId, '/instance/proxy', {
      method: 'POST',
      body: proxyConfig,
    }, 'Failed to update proxy config');
  }

  async deleteProxyConfig(instanceId) {
    return this.instanceRequest(instanceId, '/instance/proxy', { method: 'DELETE' }, 'Failed to delete proxy config');
  }

  async getWebhook(instanceId) {
    return this.instanceRequest(instanceId, '/webhook', {}, 'Failed to get webhook');
  }

  async updateWebhook(instanceId, webhookConfig = {}) {
    return this.instanceRequest(instanceId, '/webhook', {
      method: 'POST',
      body: webhookConfig,
    }, 'Failed to update webhook');
  }

  async getWebhookErrors(instanceId) {
    return this.instanceRequest(instanceId, '/webhook/errors', {}, 'Failed to get webhook errors');
  }

  async getInstancePrivacy(instanceId) {
    return this.instanceRequest(instanceId, '/instance/privacy', {}, 'Failed to get privacy settings');
  }

  async setPrivacySetting(instanceId, privacySettings = {}) {
    return this.instanceRequest(instanceId, '/instance/privacy', {
      method: 'POST',
      body: privacySettings,
    }, 'Failed to update privacy settings');
  }

  async updateProfileName(instanceId, name) {
    return this.instanceRequest(instanceId, '/profile/name', {
      method: 'POST',
      body: { name },
    }, 'Failed to update profile name');
  }

  async updateProfileImage(instanceId, imagePayload = {}) {
    return this.instanceRequest(instanceId, '/profile/image', {
      method: 'POST',
      body: imagePayload,
    }, 'Failed to update profile image');
  }

  async getAsyncQueueStatus(instanceId) {
    return this.instanceRequest(instanceId, '/message/async', {}, 'Failed to get async queue');
  }

  async clearAsyncQueue(instanceId) {
    return this.instanceRequest(instanceId, '/message/async', { method: 'DELETE' }, 'Failed to clear async queue');
  }

  async downloadMessage(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/message/download', { method: 'POST', body: payload }, 'Failed to download message');
  }

  async findMessages(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/message/find', { method: 'POST', body: payload }, 'Failed to find messages');
  }

  async requestHistorySync(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/message/history-sync', { method: 'POST', body: payload }, 'Failed to request history sync');
  }

  async markMessageRead(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/message/markread', { method: 'POST', body: payload }, 'Failed to mark message as read');
  }

  async reactToMessage(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/message/react', { method: 'POST', body: payload }, 'Failed to react to message');
  }

  async deleteMessage(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/message/delete', { method: 'POST', body: payload }, 'Failed to delete message');
  }

  async editMessage(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/message/edit', { method: 'POST', body: payload }, 'Failed to edit message');
  }

  async pinMessage(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/message/pin', { method: 'POST', body: payload }, 'Failed to pin message');
  }

  async checkContacts(instanceId) {
    return this.instanceRequest(instanceId, '/contacts', {}, 'Failed to check contacts');
  }

  async listContacts(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/contacts/list', { method: 'POST', body: payload }, 'Failed to list contacts');
  }

  async addContact(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/contact/add', { method: 'POST', body: payload }, 'Failed to add contact');
  }

  async removeContact(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/contact/remove', { method: 'POST', body: payload }, 'Failed to remove contact');
  }

  async checkChat(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/chat/check', { method: 'POST', body: payload }, 'Failed to check chat');
  }

  async findChats(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/chat/find', { method: 'POST', body: payload }, 'Failed to find chats');
  }

  async getChatDetails(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/chat/details', { method: 'POST', body: payload }, 'Failed to get chat details');
  }

  async markChatRead(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/chat/read', { method: 'POST', body: payload }, 'Failed to mark chat read');
  }

  async archiveChat(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/chat/archive', { method: 'POST', body: payload }, 'Failed to archive chat');
  }

  async muteChat(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/chat/mute', { method: 'POST', body: payload }, 'Failed to mute chat');
  }

  async pinChat(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/chat/pin', { method: 'POST', body: payload }, 'Failed to pin chat');
  }

  async listLabels(instanceId) {
    return this.instanceRequest(instanceId, '/labels', {}, 'Failed to list labels');
  }

  async refreshLabels(instanceId) {
    return this.instanceRequest(instanceId, '/labels/refresh', { method: 'POST', body: {} }, 'Failed to refresh labels');
  }

  async editLabel(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/label/edit', { method: 'POST', body: payload }, 'Failed to edit label');
  }

  async getBusinessProfile(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/business/get/profile', { method: 'POST', body: payload }, 'Failed to get business profile');
  }

  async getBusinessCategories(instanceId) {
    return this.instanceRequest(instanceId, '/business/get/categories', {}, 'Failed to get business categories');
  }

  async updateBusinessProfile(instanceId, payload = {}) {
    return this.instanceRequest(instanceId, '/business/update/profile', { method: 'POST', body: payload }, 'Failed to update business profile');
  }

  async getGlobalWebhook() {
    return this.adminRequest('/globalwebhook', {}, 'Failed to get global webhook');
  }

  async updateGlobalWebhook(webhookConfig = {}) {
    return this.adminRequest('/globalwebhook', {
      method: 'POST',
      body: webhookConfig,
    }, 'Failed to update global webhook');
  }

  async getGlobalWebhookErrors() {
    return this.adminRequest('/globalwebhook/errors', {}, 'Failed to get global webhook errors');
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
