/**
 * UAZAPI Integration - Main Export
 *
 * Exports the UAZAPI client and webhook handlers
 */

import UaZAPIClient from './client.js';
import { handleWebhook } from './webhooks.js';

// Initialize default client
const uazapiClient = new UaZAPIClient();

/**
 * Get UAZAPI client instance
 *
 * @param {Object} config Optional configuration override
 * @returns {UaZAPIClient} UAZAPI client instance
 */
export function getClient(config) {
  return config ? new UaZAPIClient(config) : uazapiClient;
}

/**
 * Webhook endpoint handler
 */
export { handleWebhook };

/**
 * Export client class for instantiation
 */
export { UaZAPIClient };

export default {
  getClient,
  handleWebhook,
  UaZAPIClient,
};
