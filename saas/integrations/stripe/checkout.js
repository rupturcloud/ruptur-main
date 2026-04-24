/**
 * Stripe Checkout Payment Flow Handler
 *
 * Manages payment checkout sessions and flows
 * Handles session creation and payment processing
 */

/**
 * Initialize a checkout session
 *
 * @param {Object} client Stripe client instance
 * @param {Object} options Checkout options
 * @returns {Promise<Object>} Checkout session
 */
export async function initializeCheckout(client, options) {
  const {
    lineItems,
    successUrl,
    cancelUrl,
    customerEmail,
    metadata = {},
    mode = 'payment',
  } = options;

  try {
    if (!lineItems || lineItems.length === 0) {
      throw new Error('LineItems is required and must not be empty');
    }

    if (!successUrl || !cancelUrl) {
      throw new Error('successUrl and cancelUrl are required');
    }

    const session = await client.createCheckoutSession({
      lineItems,
      successUrl,
      cancelUrl,
      customerEmail,
      metadata,
      mode,
    });

    console.log(`[Stripe Checkout] Session created: ${session.id}`);
    return session;
  } catch (error) {
    console.error('[Stripe Checkout] Initialization error:', error.message);
    throw error;
  }
}

/**
 * Get checkout session details
 *
 * @param {Object} client Stripe client instance
 * @param {string} sessionId Session ID
 * @returns {Promise<Object>} Session details
 */
export async function getCheckoutStatus(client, sessionId) {
  try {
    const session = await client.getCheckoutSession(sessionId);

    return {
      id: session.id,
      status: session.payment_status,
      paymentIntent: session.payment_intent,
      customer: session.customer,
      customerEmail: session.customer_email,
      lineItems: session.line_items,
      amountTotal: session.amount_total,
      amountSubtotal: session.amount_subtotal,
      currency: session.currency,
      metadata: session.metadata,
    };
  } catch (error) {
    console.error('[Stripe Checkout] Status retrieval error:', error.message);
    throw error;
  }
}

/**
 * Confirm payment from checkout session
 *
 * @param {Object} client Stripe client instance
 * @param {string} sessionId Session ID
 * @returns {Promise<Object>} Confirmation result
 */
export async function confirmCheckoutPayment(client, sessionId) {
  try {
    const session = await client.getCheckoutSession(sessionId);

    if (session.payment_status === 'paid') {
      console.log(`[Stripe Checkout] Payment confirmed: ${sessionId}`);
      return {
        success: true,
        sessionId,
        paymentIntentId: session.payment_intent,
        status: 'paid',
      };
    }

    if (session.payment_status === 'unpaid') {
      return {
        success: false,
        sessionId,
        status: 'unpaid',
        message: 'Payment has not been completed',
      };
    }

    return {
      success: false,
      sessionId,
      status: session.payment_status,
      message: `Unexpected payment status: ${session.payment_status}`,
    };
  } catch (error) {
    console.error('[Stripe Checkout] Payment confirmation error:', error.message);
    throw error;
  }
}

/**
 * Create a one-time payment link
 *
 * @param {Object} client Stripe client instance
 * @param {Object} options Payment link options
 * @returns {Promise<string>} Payment link URL
 */
export async function createPaymentLink(client, options) {
  const {
    amount,
    currency = 'usd',
    description = '',
    customerEmail = '',
    metadata = {},
  } = options;

  try {
    if (!amount || amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Create payment intent for the link
    const intent = await client.createPaymentIntent({
      amount,
      currency,
      description,
      metadata,
    });

    // Return client secret for frontend integration
    return {
      intentId: intent.id,
      clientSecret: intent.client_secret,
      amount: intent.amount,
      currency: intent.currency,
    };
  } catch (error) {
    console.error('[Stripe Checkout] Payment link creation error:', error.message);
    throw error;
  }
}

/**
 * Handle successful payment completion
 *
 * @param {Object} sessionId Checkout session ID
 * @returns {Promise<Object>} Completion result
 */
export async function handlePaymentSuccess(sessionId) {
  console.log(`[Stripe Checkout] Payment success: ${sessionId}`);

  // TODO: Implement success handling
  // - Update order status in database
  // - Send confirmation email
  // - Trigger fulfillment process
  // - Log transaction

  return {
    success: true,
    sessionId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Handle payment cancellation
 *
 * @param {Object} sessionId Checkout session ID
 * @returns {Promise<Object>} Cancellation result
 */
export async function handlePaymentCancelled(sessionId) {
  console.log(`[Stripe Checkout] Payment cancelled: ${sessionId}`);

  // TODO: Implement cancellation handling
  // - Log cancellation
  // - Notify user if needed
  // - Clean up temporary orders

  return {
    success: true,
    sessionId,
    timestamp: new Date().toISOString(),
  };
}

export default {
  initializeCheckout,
  getCheckoutStatus,
  confirmCheckoutPayment,
  createPaymentLink,
  handlePaymentSuccess,
  handlePaymentCancelled,
};
