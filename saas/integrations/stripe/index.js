/**
 * Stripe Integration - Main Export
 *
 * Exports the Stripe client and payment flow handlers
 */

import StripeClient from './client.js';
import * as checkoutFlow from './checkout.js';

// Initialize default client
const stripeClient = new StripeClient();

/**
 * Get Stripe client instance
 *
 * @param {Object} config Optional configuration override
 * @returns {StripeClient} Stripe client instance
 */
export function getClient(config) {
  return config ? new StripeClient(config) : stripeClient;
}

/**
 * Get checkout flow helpers
 *
 * @returns {Object} Checkout operations
 */
export function checkout() {
  return {
    initialize: (opts) => checkoutFlow.initializeCheckout(stripeClient, opts),
    status: (sessionId) => checkoutFlow.getCheckoutStatus(stripeClient, sessionId),
    confirm: (sessionId) => checkoutFlow.confirmCheckoutPayment(stripeClient, sessionId),
    createLink: (opts) => checkoutFlow.createPaymentLink(stripeClient, opts),
    handleSuccess: (sessionId) => checkoutFlow.handlePaymentSuccess(sessionId),
    handleCancelled: (sessionId) => checkoutFlow.handlePaymentCancelled(sessionId),
  };
}

/**
 * Export client class for instantiation
 */
export { StripeClient };

/**
 * Export checkout operations directly
 */
export { checkoutFlow as checkoutOperations };

export default {
  getClient,
  checkout,
  StripeClient,
};
