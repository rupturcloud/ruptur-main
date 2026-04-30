/**
 * Inbox Module - Central message management
 * 
 * Handles inbox functionality for all WhatsApp instances
 * Integrates with UAZAPI for message retrieval and Bubble for storage
 */

import UaZAPIClient from '../../integrations/uazapi/client.js';
import BubbleClient from '../../integrations/bubble/client.js';

const uazapiClient = new UaZAPIClient();
const bubbleClient = new BubbleClient();

export class InboxManager {
  constructor() {
    this.instances = new Map();
    this.messages = new Map();
    this.unreadCounts = new Map();
  }

  /**
   * Initialize inbox for a specific instance
   */
  async initializeInstance(instanceId) {
    try {
      console.log(`[Inbox] Initializing instance: ${instanceId}`);
      
      // Get instance details from UAZAPI
      const instance = await uazapiClient.getInstance(instanceId);
      if (!instance || !instance.connected) {
        throw new Error(`Instance ${instanceId} not connected`);
      }

      // Initialize instance state
      this.instances.set(instanceId, {
        id: instanceId,
        name: instance.name || instanceId,
        phone: instance.phone,
        connected: true,
        lastSync: new Date(),
        unreadCount: 0
      });

      // Start message polling
      this.startMessagePolling(instanceId);
      
      console.log(`[Inbox] Instance ${instanceId} initialized successfully`);
      return true;
    } catch (error) {
      console.error(`[Inbox] Failed to initialize instance ${instanceId}:`, error.message);
      return false;
    }
  }

  /**
   * Start polling for new messages
   */
  startMessagePolling(instanceId) {
    const pollInterval = 30000; // 30 seconds
    
    setInterval(async () => {
      try {
        await this.syncMessages(instanceId);
      } catch (error) {
        console.error(`[Inbox] Error polling messages for ${instanceId}:`, error.message);
      }
    }, pollInterval);
  }

  /**
   * Sync messages from UAZAPI
   */
  async syncMessages(instanceId) {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance || !instance.connected) {
        return;
      }

      // Get messages from UAZAPI
      const messages = await uazapiClient.getMessages(instanceId, {
        limit: 50,
        since: instance.lastSync
      });

      // Process each message
      for (const message of messages) {
        await this.processMessage(instanceId, message);
      }

      // Update last sync time
      instance.lastSync = new Date();
      
      console.log(`[Inbox] Synced ${messages.length} messages for ${instanceId}`);
    } catch (error) {
      console.error(`[Inbox] Error syncing messages for ${instanceId}:`, error.message);
    }
  }

  /**
   * Process incoming message
   */
  async processMessage(instanceId, message) {
    try {
      const messageId = `${instanceId}_${message.id}`;
      
      // Check if message already exists
      if (this.messages.has(messageId)) {
        return;
      }

      // Store message locally
      this.messages.set(messageId, {
        id: messageId,
        instanceId,
        ...message,
        timestamp: new Date(message.timestamp),
        read: false
      });

      // Update unread count
      const currentCount = this.unreadCounts.get(instanceId) || 0;
      this.unreadCounts.set(instanceId, currentCount + 1);

      // Send to Bubble for storage
      await this.storeMessageInBubble(message);

      // Trigger webhook for real-time updates
      await this.triggerWebhook('message.received', {
        instanceId,
        message
      });

      console.log(`[Inbox] New message processed: ${messageId}`);
    } catch (error) {
      console.error(`[Inbox] Error processing message:`, error.message);
    }
  }

  /**
   * Store message in Bubble
   */
  async storeMessageInBubble(message) {
    try {
      await bubbleClient.createRecord('Message', {
        messageId: message.id,
        instanceId: message.instanceId,
        sender: message.sender,
        receiver: message.receiver,
        content: message.content,
        messageType: message.type,
        timestamp: message.timestamp,
        read: false
      });
    } catch (error) {
      console.error(`[Inbox] Error storing message in Bubble:`, error.message);
    }
  }

  /**
   * Get messages for an instance
   */
  async getMessages(instanceId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      since = null
    } = options;

    try {
      let messages = Array.from(this.messages.values())
        .filter(msg => msg.instanceId === instanceId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (unreadOnly) {
        messages = messages.filter(msg => !msg.read);
      }

      if (since) {
        messages = messages.filter(msg => new Date(msg.timestamp) >= new Date(since));
      }

      const total = messages.length;
      const paginatedMessages = messages.slice(offset, offset + limit);

      return {
        messages: paginatedMessages,
        total,
        unreadCount: this.unreadCounts.get(instanceId) || 0
      };
    } catch (error) {
      console.error(`[Inbox] Error getting messages for ${instanceId}:`, error.message);
      return { messages: [], total: 0, unreadCount: 0 };
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(instanceId, messageId) {
    try {
      const message = this.messages.get(messageId);
      if (message && message.instanceId === instanceId) {
        message.read = true;
        
        // Update unread count
        const currentCount = this.unreadCounts.get(instanceId) || 0;
        this.unreadCounts.set(instanceId, Math.max(0, currentCount - 1));

        // Update in Bubble
        await bubbleClient.updateRecord('Message', message.id, { read: true });

        console.log(`[Inbox] Message marked as read: ${messageId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[Inbox] Error marking message as read:`, error.message);
      return false;
    }
  }

  /**
   * Send message
   */
  async sendMessage(instanceId, recipient, content, type = 'text') {
    try {
      const instance = this.instances.get(instanceId);
      if (!instance || !instance.connected) {
        throw new Error(`Instance ${instanceId} not available`);
      }

      // Send via UAZAPI
      const result = await uazapiClient.sendMessage(instanceId, {
        to: recipient,
        content,
        type
      });

      // Store sent message
      const message = {
        id: result.messageId,
        instanceId,
        sender: instance.phone,
        receiver: recipient,
        content,
        type,
        timestamp: new Date(),
        direction: 'outgoing',
        read: true
      };

      this.messages.set(`${instanceId}_${result.messageId}`, message);
      await this.storeMessageInBubble(message);

      console.log(`[Inbox] Message sent: ${result.messageId}`);
      return result;
    } catch (error) {
      console.error(`[Inbox] Error sending message:`, error.message);
      throw error;
    }
  }

  /**
   * Get inbox summary
   */
  async getInboxSummary() {
    const summary = {
      totalInstances: this.instances.size,
      connectedInstances: 0,
      totalUnread: 0,
      instances: []
    };

    for (const [instanceId, instance] of this.instances) {
      if (instance.connected) {
        summary.connectedInstances++;
      }

      const unreadCount = this.unreadCounts.get(instanceId) || 0;
      summary.totalUnread += unreadCount;

      summary.instances.push({
        id: instanceId,
        name: instance.name,
        phone: instance.phone,
        connected: instance.connected,
        unreadCount,
        lastSync: instance.lastSync
      });
    }

    return summary;
  }

  /**
   * Trigger webhook for real-time events
   */
  async triggerWebhook(event, data) {
    try {
      // This would trigger webhooks configured in the system
      console.log(`[Inbox] Webhook triggered: ${event}`, data);
    } catch (error) {
      console.error(`[Inbox] Error triggering webhook:`, error.message);
    }
  }
}

// Export singleton instance
export const inboxManager = new InboxManager();
export default inboxManager;
