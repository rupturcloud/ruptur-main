/**
 * UAZAPI Client Wrapper
 *
 * Provides a wrapper around the UAZAPI REST endpoints
 * Handles authentication and credential management
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

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.adminToken}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`UAZAPI request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
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
    return this.request(`/instances/${instanceId}`);
  }

  /**
   * List all instances
   *
   * @returns {Promise<Array>} Array of instances
   */
  async listInstances() {
    return this.request('/instances');
  }

  /**
   * Send message through instance
   *
   * @param {string} instanceId Instance identifier
   * @param {Object} messageData Message payload
   * @returns {Promise<Object>} Message response
   */
  async sendMessage(instanceId, messageData) {
    return this.request(`/instances/${instanceId}/send`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
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
    return this.request(`/instances/${instanceId}/warmup-status`);
  }
}

export default UaZAPIClient;
