/**
 * A2A Gateway Configuration
 * Initializes and configures Google Cloud Pub/Sub client
 * @module config
 */

import { PubSub } from '@google-cloud/pubsub';

/**
 * Pub/Sub Topic Names
 * @type {Object}
 */
export const TOPICS = {
  TASKS: 'ruptur-tasks',
  APPROVALS: 'ruptur-approvals',
  RESULTS: 'ruptur-results',
  VALIDATIONS: 'ruptur-validations',
  NOTIFICATIONS: 'notification-events'
};

/**
 * Pub/Sub Subscription Names
 * @type {Object}
 */
export const SUBSCRIPTIONS = {
  TASKS: 'ruptur-tasks-sub',
  APPROVALS: 'ruptur-approvals-sub',
  RESULTS: 'ruptur-results-sub',
  VALIDATIONS: 'ruptur-validations-sub',
  NOTIFICATIONS: 'notification-events-sub'
};

/**
 * Valid message sources
 * @type {Array<string>}
 */
export const VALID_SOURCES = ['jarvis', 'hermes', 'matuzas', 'operator'];

/**
 * Valid message targets
 * @type {Array<string>}
 */
export const VALID_TARGETS = ['jarvis', 'hermes', 'matuzas'];

/**
 * Valid message types
 * @type {Array<string>}
 */
export const MESSAGE_TYPES = ['task', 'approval', 'result', 'validation'];

/**
 * Priority levels
 * @type {Array<string>}
 */
export const PRIORITY_LEVELS = ['high', 'normal', 'low'];

/**
 * Google Cloud Pub/Sub client instance
 * Lazy-loaded on first use
 * @type {PubSub|null}
 */
let pubSubClient = null;

/**
 * Initialize and return Pub/Sub client
 * @returns {PubSub} Configured Pub/Sub client
 */
export function getPubSubClient() {
  if (!pubSubClient) {
    pubSubClient = new PubSub({
      projectId: process.env.GCP_PROJECT_ID || 'ruptur-cloud',
      keyFilename: process.env.GCP_KEY_FILE || undefined
    });
  }
  return pubSubClient;
}

/**
 * Get reference to a topic
 * @param {string} topicName - Name of the topic
 * @returns {Object} Topic reference
 */
export function getTopic(topicName) {
  const client = getPubSubClient();
  return client.topic(topicName);
}

/**
 * Get reference to a subscription
 * @param {string} subscriptionName - Name of the subscription
 * @returns {Object} Subscription reference
 */
export function getSubscription(subscriptionName) {
  const client = getPubSubClient();
  return client.subscription(subscriptionName);
}

/**
 * Configuration for retry logic
 * @type {Object}
 */
export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // ms
  maxDelay: 32000, // ms
  backoffMultiplier: 2
};

/**
 * Message timeout configuration (ms)
 * @type {Object}
 */
export const TIMEOUT_CONFIG = {
  ackDeadline: 60, // seconds
  streamTimeout: 30000 // ms
};

/**
 * Logging configuration
 * @type {Object}
 */
export const LOG_CONFIG = {
  enabled: process.env.LOG_ENABLED !== 'false',
  level: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  pretty: process.env.LOG_PRETTY === 'true'
};

export default {
  TOPICS,
  SUBSCRIPTIONS,
  VALID_SOURCES,
  VALID_TARGETS,
  MESSAGE_TYPES,
  PRIORITY_LEVELS,
  getPubSubClient,
  getTopic,
  getSubscription,
  RETRY_CONFIG,
  TIMEOUT_CONFIG,
  LOG_CONFIG
};
