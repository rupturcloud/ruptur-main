/**
 * Cloud Function: Notification Dispatcher
 * Triggered by: Cloud Pub/Sub topic 'notification-events'
 *
 * Deploy:
 * gcloud functions deploy notification-dispatcher \
 *   --runtime nodejs20 \
 *   --trigger-topic notification-events \
 *   --entry-point notificationDispatcher \
 *   --set-env-vars SENDGRID_API_KEY=...,SUPABASE_URL=...,SUPABASE_KEY=...
 */

import { createClient } from '@supabase/supabase-js';
import { NotificationService } from '../../modules/notifications/service.js';

let notificationService = null;

function getService() {
  if (!notificationService) {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    notificationService = new NotificationService(supabase);
  }
  return notificationService;
}

/**
 * Main handler for Pub/Sub events
 */
export async function notificationDispatcher(pubsubMessage, context) {
  const service = getService();

  try {
    // Decode Pub/Sub message
    const eventData = JSON.parse(
      Buffer.from(pubsubMessage.data, 'base64').toString('utf-8')
    );

    console.log(`[Dispatcher] Received event: ${eventData.type}:${eventData.eventId}`);

    // Process notification
    const result = await service.processEvent(eventData);

    console.log(`[Dispatcher] Event processed:`, result);

    return result;
  } catch (error) {
    console.error('[Dispatcher] Error processing notification:', error);

    // Log error but don't throw - Cloud Functions will retry on error
    // We want to ack (acknowledge) on any error to avoid infinite loops
    // unless it's a transient error (network, etc)

    if (error.message?.includes('ECONNREFUSED') || error.code === 'ENOTFOUND') {
      // Network error - let it retry
      throw error;
    }

    // Application errors - don't retry, just log and return
    return {
      status: 'error',
      message: error.message,
    };
  }
}

/**
 * Health check endpoint (optional, for monitoring)
 */
export function health(req, res) {
  res.json({
    status: 'ok',
    service: 'notification-dispatcher',
    timestamp: new Date().toISOString(),
  });
}
