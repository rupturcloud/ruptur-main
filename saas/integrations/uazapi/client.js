/**
 * UAZAPI Client Wrapper
 *
 * Provides a wrapper around the UAZAPI REST endpoints
 * Handles authentication and credential management
 * Supports all message types: text, media, menu, carousel, location, etc.
 */

class UaZAPIClient {
  /**
   * Initialize UAZAPI client with credentials from environment
   *
   * @param {Object} config Configuration object
   * @param {string} config.serverUrl Base URL for UAZAPI server
   * @param {string} config.adminToken Admin API token for authentication
   */
  constructor(config = {}) {
    this.serverUrl = config.serverUrl || process.env.WARMUP_SERVER_URL || 'https://tiatendeai.uazapi.com';
    this.adminToken = config.adminToken || process.env.WARMUP_ADMIN_TOKEN;

    if (!this.adminToken) {
      console.warn('UAZAPI: WARMUP_ADMIN_TOKEN not set in environment');
    }
  }

  /**
   * Make authenticated request to UAZAPI
   *
   * @param {string} endpoint API endpoint path
   * @param {Object} options Fetch options (method, body, headers, etc)
   * @returns {Promise<Object>} API response
   */
  async request(endpoint, options = {}) {
    const url = `${this.serverUrl}${endpoint}`;
    const { token, admin = false, headers: customHeaders = {}, ...fetchOptions } = options;
    const resolvedToken = token || options.instanceToken;

    const headers = {
      ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(admin || (!resolvedToken && this.adminToken) ? { admintoken: this.adminToken } : {}),
      ...(resolvedToken ? { token: resolvedToken } : {}),
      ...customHeaders,
    };

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`UAZAPI request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const text = await response.text();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        return { ok: true, raw: text };
      }
    } catch (error) {
      console.error(`UAZAPI request error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get instance details
   *
   * @param {string} instanceId Instance identifier
   * @returns {Promise<Object>} Instance data
   */
  async getInstance(instanceId) {
    return this.request('/instance/status', { token: instanceId });
  }

  /**
   * List all instances
   *
   * @returns {Promise<Array>} Array of instances
   */
  async listInstances() {
    return this.request('/instance/all', { admin: true });
  }

  // ==================== MESSAGE SENDING METHODS ====================

  /**
   * Send text message with optional buttons, mentions, reply, etc.
   * Endpoint: /send/text
   *
   * @param {string} instanceId Instance identifier (or use 'token' in data)
   * @param {Object} messageData Message payload
   * @param {string} messageData.number Phone number, chat JID, or newsletter ID
   * @param {string} messageData.text Text message (supports placeholders like {{name}})
   * @param {string} [messageData.buttonOrListId] ID of button/list item selected (for replies)
   * @param {number} [messageData.delay] Delay in ms before sending
   * @param {boolean} [messageData.readchat] Mark chat as read after sending
   * @param {boolean} [messageData.readmessages] Mark last received messages as read
   * @param {string} [messageData.replyid] Message ID to reply to
   * @param {string} [messageData.mentions] Mentioned numbers (comma-separated or "all")
   * @param {boolean} [messageData.forward] Mark as forwarded
   * @param {string} [messageData.track_source] Tracking source identifier
   * @param {string} [messageData.track_id] Tracking ID
   * @param {boolean} [messageData.async] Use async queue (don't wait for result)
   * @param {boolean} [messageData.linkPreview] Enable link preview
   * @param {string} [messageData.linkPreviewTitle] Custom link preview title
   * @param {string} [messageData.linkPreviewDescription] Custom link preview description
   * @param {string} [messageData.linkPreviewImage] Custom link preview image URL
   * @param {boolean} [messageData.linkPreviewLarge] Use large preview
   * @returns {Promise<Object>} Message response with message ID
   */
  async sendText(instanceId, messageData) {
    return this.request('/send/text', {
      method: 'POST',
      token: instanceId,
      body: JSON.stringify(messageData),
    });
  }

  /**
   * Send media message (image, video, audio, document, sticker)
   * Endpoint: /send/media
   *
   * @param {string} instanceId Instance identifier
   * @param {Object} mediaData Media payload
   * @param {string} mediaData.number Phone number, chat JID, or newsletter ID
   * @param {string} mediaData.type Media type: 'image', 'video', 'videoplay', 'document', 'audio', 'myaudio', 'ptt', 'ptv', 'sticker'
   * @param {string} mediaData.file File URL or base64 data
   * @param {string} [mediaData.text] Caption text (supports placeholders)
   * @param {string} [mediaData.docName] Custom document name
   * @param {number} [mediaData.delay] Delay in ms before sending
   * @param {boolean} [mediaData.viewOnce] One-time view (recommended for compatible types)
   * @param {boolean} [mediaData.readchat] Mark chat as read after sending
   * @param {string} [mediaData.replyid] Message ID to reply to
   * @param {string} [mediaData.track_source] Tracking source
   * @param {string} [mediaData.track_id] Tracking ID
   * @param {boolean} [mediaData.async] Use async queue
   * @returns {Promise<Object>} Message response
   */
  async sendMedia(instanceId, mediaData) {
    return this.request('/send/media', {
      method: 'POST',
      token: instanceId,
      body: JSON.stringify(mediaData),
    });
  }

  /**
   * Send interactive menu, button, or list message
   * Endpoint: /send/menu
   *
   * @param {string} instanceId Instance identifier
   * @param {Object} menuData Menu payload
   * @param {string} menuData.number Phone number or chat JID
   * @param {string} menuData.type Menu type: 'button', 'list'
   * @param {string} menuData.text Message text
   * @param {Array} menuData.buttons Array of button objects {buttonId, buttonText}
   * @param {Array} [menuData.sections] Array of sections (for list type) {title, rows: [{title, description, rowId}]}
   * @param {string} [menuData.footerText] Footer text
   * @param {number} [menuData.delay] Delay in ms
   * @param {boolean} [menuData.viewOnce] One-time view
   * @returns {Promise<Object>} Message response
   */
  async sendMenu(instanceId, menuData) {
    return this.request('/send/menu', {
      method: 'POST',
      token: instanceId,
      body: JSON.stringify(menuData),
    });
  }

  /**
   * Send carousel message with multiple items
   * Endpoint: /send/carousel
   *
   * @param {string} instanceId Instance identifier
   * @param {Object} carouselData Carousel payload
   * @param {string} carouselData.number Phone number or chat JID
   * @param {Array} carouselData.cards Array of card objects
   * @param {string} [carouselData.text] Message text
   * @param {string} [carouselData.footerText] Footer text
   * @param {number} [carouselData.delay] Delay in ms
   * @returns {Promise<Object>} Message response
   */
  async sendCarousel(instanceId, carouselData) {
    return this.request('/send/carousel', {
      method: 'POST',
      token: instanceId,
      body: JSON.stringify(carouselData),
    });
  }

  /**
   * Send location with button
   * Endpoint: /send/location-button
   *
   * @param {string} instanceId Instance identifier
   * @param {Object} locationData Location payload
   * @param {string} locationData.number Phone number or chat JID
   * @param {number} locationData.latitude Latitude
   * @param {number} locationData.longitude Longitude
   * @param {string} [locationData.name] Location name
   * @param {string} [locationData.address] Address text
   * @param {string} [locationData.buttonText] Button text
   * @param {number} [locationData.delay] Delay in ms
   * @returns {Promise<Object>} Message response
   */
  async sendLocationButton(instanceId, locationData) {
    return this.request('/send/location-button', {
      method: 'POST',
      token: instanceId,
      body: JSON.stringify(locationData),
    });
  }

  /**
   * Send contact card(s)
   * Endpoint: /send/contact
   *
   * @param {string} instanceId Instance identifier
   * @param {Object} contactData Contact payload
   * @param {string} contactData.number Phone number or chat JID to send to
   * @param {string|Array} contactData.contacts Contact number(s) to share (single or array)
   * @param {number} [contactData.delay] Delay in ms
   * @returns {Promise<Object>} Message response
   */
  async sendContact(instanceId, contactData) {
    return this.request('/send/contact', {
      method: 'POST',
      token: instanceId,
      body: JSON.stringify(contactData),
    });
  }

  /**
   * Send presence status (typing, recording, etc.)
   * Endpoint: /send/status
   *
   * @param {string} instanceId Instance identifier
   * @param {Object} statusData Status payload
   * @param {string} statusData.number Phone number or chat JID
   * @param {string} statusData.status Presence type: 'available', 'unavailable', 'composing', 'recording', 'paused'
   * @returns {Promise<Object>} Response
   */
  async sendStatus(instanceId, statusData) {
    return this.request('/send/status', {
      method: 'POST',
      token: instanceId,
      body: JSON.stringify(statusData),
    });
  }

  /**
   * Método compatível com o ProviderAdapter usado por Inbox/Campaigns.
   */
  async sendMessage(instanceId, messageData = {}) {
    const { to, type = 'text', content, mediaUrl, ...rest } = messageData;
    const number = messageData.number || to;

    if (type === 'text') {
      return this.sendText(instanceId, { number, text: messageData.text || content, ...rest });
    }

    if (type === 'media' || ['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {
      return this.sendMedia(instanceId, {
        number,
        type: messageData.mediaType || (type === 'media' ? 'image' : type),
        file: messageData.file || mediaUrl || messageData.url,
        text: messageData.text || content,
        ...rest,
      });
    }

    if (type === 'menu') return this.sendMenu(instanceId, { number, text: messageData.text || content, ...rest });
    if (type === 'carousel') return this.sendCarousel(instanceId, { number, text: messageData.text || content, ...rest });
    if (type === 'contact') return this.sendContact(instanceId, { number, ...rest });

    throw new Error(`Tipo de mensagem UAZAPI não suportado: ${type}`);
  }

  // ==================== CAMPAIGN/SENDER METHODS ====================

  /**
   * Send message via sender queue (advanced mass messaging)
   * Endpoint: /sender/advanced
   *
   * @param {Object} senderData Sender payload
   * @param {string} senderData.token Instance token
   * @param {string} senderData.number Target phone number
   * @param {string} senderData.text Message text (supports spintext)
   * @param {string} [senderData.type] Message type: 'text', 'image', 'video', etc.
   * @param {string} [senderData.file] Media file URL/base64
   * @param {string} [senderData.folder_id] Folder ID for organization
   * @param {number} [senderData.delayMin] Minimum delay between messages in ms
   * @param {number} [senderData.delayMax] Maximum delay between messages in ms
   * @returns {Promise<Object>} Queue response
   */
  async sendViaSender(senderData) {
    return this.request(`/sender/advanced`, {
      method: 'POST',
      body: JSON.stringify(senderData),
    });
  }

  /**
   * List sender folders
   * Endpoint: /sender/listfolders
   */
  async listSenderFolders() {
    return this.request(`/sender/listfolders`);
  }

  /**
   * List messages in sender folder
   * Endpoint: /sender/listmessages
   *
   * @param {string} folderId Folder ID
   */
  async listSenderMessages(folderId) {
    return this.request(`/sender/listmessages?folder_id=${folderId}`);
  }

  /**
   * Clear done messages from folder
   * Endpoint: /sender/cleardone
   */
  async clearDoneMessages(folderId) {
    return this.request(`/sender/cleardone`, {
      method: 'POST',
      body: JSON.stringify({ folder_id: folderId }),
    });
  }

  /**
   * Clear all messages from all folders
   * Endpoint: /sender/clearall
   */
  async clearAllMessages() {
    return this.request('/sender/clearall', {
      method: 'DELETE',
      admin: true,
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Process spintext syntax and return a random variation
   * Syntax: {option1|option2|option3}
   *
   * @param {string} text Text possibly containing spintext syntax
   * @returns {string} Text with one random option selected
   */
  processSpinText(text) {
    if (!text || typeof text !== 'string') return text;

    // Regex to match spintext patterns: {option1|option2|option3}
    const spinRegex = /\{([^{}]*)\}/g;
    
    return text.replace(spinRegex, (match, options) => {
      if (!options) return match;
      
      const choices = options.split('|').map(s => s.trim()).filter(Boolean);
      if (choices.length === 0) return match;
      
      const randomIndex = Math.floor(Math.random() * choices.length);
      return choices[randomIndex];
    });
  }

  /**
   * Process message text with all placeholder and spintext replacements
   *
   * @param {string} text Original message text
   * @param {Object} placeholders Key-value pairs for placeholders like {{name}}
   * @param {boolean} [enableSpinText=true] Whether to process spintext syntax
   * @returns {string} Processed message text
   */
  processMessageText(text, placeholders = {}, enableSpinText = true) {
    let processed = text;

    // Replace placeholders like {{name}}, {{wa_name}}, etc.
    for (const [key, value] of Object.entries(placeholders)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processed = processed.replace(regex, value || '');
    }

    // Process spintext syntax: {option1|option2|option3}
    if (enableSpinText) {
      processed = this.processSpinText(processed);
    }

    return processed;
  }

  /**
   * Get campaign details
   *
   * @param {string} campaignId Campaign identifier
   * @returns {Promise<Object>} Campaign data
   */
  async getCampaign(campaignId) {
    return this.request(`/campaigns/${campaignId}`);
  }

  /**
   * List campaigns
   *
   * @returns {Promise<Array>} Array of campaigns
   */
  async listCampaigns() {
    return this.request('/campaigns');
  }

  /**
   * Get warmup support status
   *
   * @param {string} instanceId Instance identifier
   * @returns {Promise<Object>} Warmup support data
   */
  async getWarmupStatus(instanceId) {
    // A OpenAPI oficial não expõe /instance/:id/warmup-status.
    // Mantemos compatibilidade retornando o status oficial da instância.
    return this.getInstance(instanceId);
  }
}

export default UaZAPIClient;
