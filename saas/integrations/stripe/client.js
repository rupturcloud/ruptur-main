/**
 * Stripe Client Wrapper
 *
 * Provides a wrapper around the Stripe SDK
 * Handles authentication and payment operations
 */

import Stripe from 'stripe';

class StripeClient {
  /**
   * Initialize Stripe client with credentials from environment
   *
   * @param {Object} config Configuration object
   * @param {string} config.apiKey Stripe Secret API key
   * @param {string} config.version API version (optional)
   */
  constructor(config = {}) {
    const apiKey = config.apiKey || process.env.STRIPE_API_KEY;

    if (!apiKey) {
      console.warn('Stripe: STRIPE_API_KEY not set in environment');
    }

    const options = {
      apiVersion: config.version || process.env.STRIPE_API_VERSION || '2024-04-10',
    };

    this.client = new Stripe(apiKey, options);
    this.apiKey = apiKey;
  }

  /**
   * Get the underlying Stripe client
   *
   * @returns {Object} Stripe client instance
   */
  getClient() {
    return this.client;
  }

  /**
   * Test connection to Stripe
   *
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      await this.client.charges.list({ limit: 1 });
      return true;
    } catch (error) {
      console.error('Stripe connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Create a payment intent
   *
   * @param {Object} options Intent options
   * @returns {Promise<Object>} Payment intent
   */
  async createPaymentIntent(options) {
    try {
      const intent = await this.client.paymentIntents.create({
        amount: options.amount,
        currency: options.currency || 'usd',
        metadata: options.metadata || {},
        description: options.description || '',
        ...options,
      });

      return intent;
    } catch (error) {
      console.error('Failed to create payment intent:', error.message);
      throw error;
    }
  }

  /**
   * Retrieve payment intent
   *
   * @param {string} intentId Payment intent ID
   * @returns {Promise<Object>} Payment intent
   */
  async getPaymentIntent(intentId) {
    try {
      return await this.client.paymentIntents.retrieve(intentId);
    } catch (error) {
      console.error('Failed to retrieve payment intent:', error.message);
      throw error;
    }
  }

  /**
   * Create a Checkout session
   *
   * @param {Object} options Session options
   * @returns {Promise<Object>} Checkout session
   */
  async createCheckoutSession(options) {
    try {
      const session = await this.client.checkout.sessions.create({
        line_items: options.lineItems || [],
        mode: options.mode || 'payment',
        success_url: options.successUrl || '',
        cancel_url: options.cancelUrl || '',
        customer_email: options.customerEmail || '',
        metadata: options.metadata || {},
        ...options,
      });

      return session;
    } catch (error) {
      console.error('Failed to create checkout session:', error.message);
      throw error;
    }
  }

  /**
   * Retrieve Checkout session
   *
   * @param {string} sessionId Session ID
   * @returns {Promise<Object>} Checkout session
   */
  async getCheckoutSession(sessionId) {
    try {
      return await this.client.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error('Failed to retrieve checkout session:', error.message);
      throw error;
    }
  }

  /**
   * Create a subscription
   *
   * @param {Object} options Subscription options
   * @returns {Promise<Object>} Subscription
   */
  async createSubscription(options) {
    try {
      const subscription = await this.client.subscriptions.create({
        customer: options.customerId || '',
        items: options.items || [],
        metadata: options.metadata || {},
        ...options,
      });

      return subscription;
    } catch (error) {
      console.error('Failed to create subscription:', error.message);
      throw error;
    }
  }

  /**
   * Retrieve subscription
   *
   * @param {string} subscriptionId Subscription ID
   * @returns {Promise<Object>} Subscription
   */
  async getSubscription(subscriptionId) {
    try {
      return await this.client.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error('Failed to retrieve subscription:', error.message);
      throw error;
    }
  }

  /**
   * Cancel subscription
   *
   * @param {string} subscriptionId Subscription ID
   * @returns {Promise<Object>} Cancelled subscription
   */
  async cancelSubscription(subscriptionId) {
    try {
      return await this.client.subscriptions.del(subscriptionId);
    } catch (error) {
      console.error('Failed to cancel subscription:', error.message);
      throw error;
    }
  }

  /**
   * Create a customer
   *
   * @param {Object} options Customer options
   * @returns {Promise<Object>} Customer
   */
  async createCustomer(options) {
    try {
      return await this.client.customers.create(options);
    } catch (error) {
      console.error('Failed to create customer:', error.message);
      throw error;
    }
  }

  /**
   * Get customer by ID
   *
   * @param {string} customerId Customer ID
   * @returns {Promise<Object>} Customer
   */
  async getCustomer(customerId) {
    try {
      return await this.client.customers.retrieve(customerId);
    } catch (error) {
      console.error('Failed to retrieve customer:', error.message);
      throw error;
    }
  }

  /**
   * Construct Webhook Event from raw body and signature
   *
   * @param {string} rawBody Raw request body
   * @param {string} signature Stripe signature header
   * @param {string} webhookSecret Webhook signing secret
   * @returns {Object} Event object
   */
  constructWebhookEvent(rawBody, signature, webhookSecret) {
    try {
      return this.client.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      console.error('Failed to construct webhook event:', error.message);
      throw error;
    }
  }
}

export default StripeClient;
