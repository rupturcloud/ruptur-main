/**
 * Bubble Integration - Main Export
 *
 * Exports the Bubble client and webhook handlers
 */

import BubbleClient from './client.js';
import { handleWebhook, handleInboxMessage } from './webhooks.js';

// Initialize default client
const bubbleClient = new BubbleClient();

/**
 * Get Bubble client instance
 *
 * @param {Object} config Optional configuration override
 * @returns {BubbleClient} Bubble client instance
 */
export function getClient(config) {
  return config ? new BubbleClient(config) : bubbleClient;
}

/**
 * Webhook endpoint handlers
 */
export { handleWebhook, handleInboxMessage };

/**
 * Export client class for instantiation
 */
export { BubbleClient };

export default {
  getClient,
  handleWebhook,
  handleInboxMessage,
  BubbleClient,
};
