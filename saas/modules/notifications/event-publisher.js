/**
 * Event Publisher Helper
 * Integra Pub/Sub com NotificationService
 */

import { v4 as uuidv4 } from 'uuid';
import { getTopic } from '../a2a-gateway/config.js';

export class EventPublisher {
  constructor(publisher = null, logger = console) {
    // Se não houver publisher, usar getTopic do A2A Gateway como fallback
    this.publisher = publisher || {
      publish: async (topic, event) => {
        const topicRef = getTopic(topic);
        const buffer = Buffer.from(JSON.stringify(event));
        await topicRef.publish(buffer);
      }
    };
    this.logger = logger;
  }

  /**
   * Publicar evento de campanha disparada
   */
  async campaignLaunched(tenantId, campaign, user) {
    return this.publish({
      type: 'campaign_launched',
      payload: {
        tenantId,
        userId: user.id,
        email: user.email,
        userName: user.name || 'Usuário',
        campaignId: campaign.id,
        campaignName: campaign.name,
        count: campaign.progress?.sent || campaign.recipientCount || 0,
      },
    });
  }

  /**
   * Publicar evento de créditos baixos
   */
  async creditsLow(tenantId, user, balance, threshold = 50) {
    if (balance >= threshold) return null; // Só publica se abaixo do limiar

    return this.publish({
      type: 'credits_low',
      payload: {
        tenantId,
        userId: user.id,
        email: user.email,
        userName: user.name || 'Usuário',
        balance,
        threshold,
      },
    });
  }

  /**
   * Publicar evento de pagamento falhou
   */
  async paymentFailed(tenantId, user, reason, paymentId) {
    return this.publish({
      type: 'payment_failed',
      payload: {
        tenantId,
        userId: user.id,
        email: user.email,
        userName: user.name || 'Usuário',
        reason,
        paymentId,
      },
    });
  }

  /**
   * Publicar evento de instância desconectada
   */
  async instanceDisconnected(tenantId, user, instance) {
    return this.publish({
      type: 'instance_disconnected',
      payload: {
        tenantId,
        userId: user.id,
        email: user.email,
        userName: user.name || 'Usuário',
        instanceName: instance.name || instance.id,
        instanceId: instance.id,
      },
    });
  }

  /**
   * Publicar evento genérico
   */
  async publish({ type, payload, priority = 'normal' }) {
    const eventId = uuidv4();

    try {
      if (!this.publisher) {
        this.logger.warn('[EventPublisher] Publisher not configured, skipping');
        return { eventId, status: 'skipped' };
      }

      const event = {
        eventId,
        source: 'campaigns|wallet|billing|instances', // Será preenchido por quem chama
        target: 'notifications',
        type,
        payload,
        timestamp: new Date().toISOString(),
        metadata: {
          priority,
          retryCount: 0,
        },
      };

      // Se for usar A2A Gateway (Pub/Sub)
      if (this.publisher.publish) {
        await this.publisher.publish('notification-events', event);
        this.logger.log(`[EventPublisher] Event published: ${type}:${eventId}`);
        return { eventId, status: 'published' };
      }

      // Fallback: log apenas (útil para development)
      this.logger.log('[EventPublisher] Event (no publisher configured):', event);
      return { eventId, status: 'logged' };
    } catch (err) {
      this.logger.error('[EventPublisher] Error publishing event:', err);
      throw err;
    }
  }
}

export default EventPublisher;
