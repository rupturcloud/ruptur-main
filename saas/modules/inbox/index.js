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
<<<<<<< HEAD
    this.instances = new Map();
    this.messages = new Map();
    this.unreadCounts = new Map();
=======
    this.instances = new Map(); // instanceId -> { ..., tenantId }
    this.messages = new Map(); // messageId -> { ..., tenantId }
    this.unreadCounts = new Map(); // instanceId -> count
>>>>>>> codex/getnet-prod-fix
  }

  /**
   * Initialize inbox for a specific instance
   */
<<<<<<< HEAD
  async initializeInstance(instanceId) {
    try {
      console.log(`[Inbox] Initializing instance: ${instanceId}`);
=======
  async initializeInstance(instanceId, tenantId) {
    try {
      console.log(`[Inbox] Initializing instance: ${instanceId} for tenant: ${tenantId}`);
>>>>>>> codex/getnet-prod-fix
      
      // Get instance details from UAZAPI
      const instance = await uazapiClient.getInstance(instanceId);
      if (!instance || !instance.connected) {
        throw new Error(`Instance ${instanceId} not connected`);
      }
<<<<<<< HEAD
=======
      if (!tenantId) {
        throw new Error(`Tenant ID required for instance ${instanceId}`);
      }
>>>>>>> codex/getnet-prod-fix

      // Initialize instance state
      this.instances.set(instanceId, {
        id: instanceId,
<<<<<<< HEAD
=======
        tenantId: tenantId,
>>>>>>> codex/getnet-prod-fix
        name: instance.name || instanceId,
        phone: instance.phone,
        connected: true,
        lastSync: new Date(),
        unreadCount: 0
      });

<<<<<<< HEAD
      // Start message polling
      this.startMessagePolling(instanceId);
      
      console.log(`[Inbox] Instance ${instanceId} initialized successfully`);
=======
      // Load existing messages for this instance from Bubble
      await this.loadMessagesFromBubble(instanceId, tenantId);

      // Start message polling
      this.startMessagePolling(instanceId);
      
      console.log(`[Inbox] Instance ${instanceId} initialized successfully for tenant ${tenantId}`);
>>>>>>> codex/getnet-prod-fix
      return true;
    } catch (error) {
      console.error(`[Inbox] Failed to initialize instance ${instanceId}:`, error.message);
      return false;
    }
  }

  /**
<<<<<<< HEAD
=======
   * Load messages from Bubble for an instance
   */
  async loadMessagesFromBubble(instanceId, tenantId) {
    try {
      const messages = await bubbleClient.getThings('Message', {
        constraints: [
          { key: 'instanceId', constraint_type: 'equals', value: instanceId },
          { key: 'tenantId', constraint_type: 'equals', value: tenantId }
        ],
        limit: 100
      });

      if (messages && messages.length > 0) {
        for (const msg of messages) {
          const messageId = `${instanceId}_${msg.messageId || msg.id}`;
          this.messages.set(messageId, {
            ...msg,
            id: messageId,
            instanceId,
            tenantId,
            timestamp: new Date(msg.timestamp || msg.CreatedDate),
            read: msg.read || false
          });
        }
        
        // Update unread count based on loaded messages
        const unreadCount = messages.filter(m => !m.read).length;
        this.unreadCounts.set(instanceId, unreadCount);
      }
    } catch (error) {
      console.error(`[Inbox] Error loading messages from Bubble for ${instanceId}:`, error.message);
    }
  }

  /**
>>>>>>> codex/getnet-prod-fix
   * Start polling for new messages
   */
  startMessagePolling(instanceId) {
    const pollInterval = 30000; // 30 seconds
    
<<<<<<< HEAD
    setInterval(async () => {
=======
    // Clear existing interval if any
    const existing = this.instances.get(instanceId);
    if (existing?.pollTimer) {
      clearInterval(existing.pollTimer);
    }

    const timer = setInterval(async () => {
>>>>>>> codex/getnet-prod-fix
      try {
        await this.syncMessages(instanceId);
      } catch (error) {
        console.error(`[Inbox] Error polling messages for ${instanceId}:`, error.message);
      }
    }, pollInterval);
<<<<<<< HEAD
=======

    if (existing) {
      existing.pollTimer = timer;
    }
>>>>>>> codex/getnet-prod-fix
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
<<<<<<< HEAD
        await this.processMessage(instanceId, message);
=======
        await this.processMessage(instanceId, instance.tenantId, message);
>>>>>>> codex/getnet-prod-fix
      }

      // Update last sync time
      instance.lastSync = new Date();
<<<<<<< HEAD
      
      console.log(`[Inbox] Synced ${messages.length} messages for ${instanceId}`);
=======
>>>>>>> codex/getnet-prod-fix
    } catch (error) {
      console.error(`[Inbox] Error syncing messages for ${instanceId}:`, error.message);
    }
  }

  /**
   * Process incoming message
   */
<<<<<<< HEAD
  async processMessage(instanceId, message) {
=======
  async processMessage(instanceId, tenantId, message) {
>>>>>>> codex/getnet-prod-fix
    try {
      const messageId = `${instanceId}_${message.id}`;
      
      // Check if message already exists
      if (this.messages.has(messageId)) {
        return;
      }

      // Store message locally
<<<<<<< HEAD
      this.messages.set(messageId, {
        id: messageId,
        instanceId,
        ...message,
        timestamp: new Date(message.timestamp),
        read: false
      });
=======
      const messageData = {
        id: messageId,
        instanceId,
        tenantId,
        ...message,
        timestamp: new Date(message.timestamp),
        read: false
      };
      
      this.messages.set(messageId, messageData);
>>>>>>> codex/getnet-prod-fix

      // Update unread count
      const currentCount = this.unreadCounts.get(instanceId) || 0;
      this.unreadCounts.set(instanceId, currentCount + 1);

      // Send to Bubble for storage
<<<<<<< HEAD
      await this.storeMessageInBubble(message);
=======
      await this.storeMessageInBubble(messageData);
>>>>>>> codex/getnet-prod-fix

      // Trigger webhook for real-time updates
      await this.triggerWebhook('message.received', {
        instanceId,
<<<<<<< HEAD
        message
      });

      console.log(`[Inbox] New message processed: ${messageId}`);
=======
        tenantId,
        message: messageData
      });

      console.log(`[Inbox] New message processed: ${messageId} (Tenant: ${tenantId})`);
>>>>>>> codex/getnet-prod-fix
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
<<<<<<< HEAD
        sender: message.sender,
        receiver: message.receiver,
        content: message.content,
        messageType: message.type,
        timestamp: message.timestamp,
        read: false
=======
        tenantId: message.tenantId,
        sender: message.sender,
        receiver: message.receiver,
        content: message.content,
        messageType: message.type || 'text',
        timestamp: message.timestamp,
        read: message.read || false
>>>>>>> codex/getnet-prod-fix
      });
    } catch (error) {
      console.error(`[Inbox] Error storing message in Bubble:`, error.message);
    }
  }

  /**
<<<<<<< HEAD
   * Get messages for an instance
   */
  async getMessages(instanceId, options = {}) {
=======
   * Get messages for an instance (Tenant filtered)
   */
  async getMessages(instanceId, tenantId, options = {}) {
>>>>>>> codex/getnet-prod-fix
    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      since = null
    } = options;

    try {
<<<<<<< HEAD
      let messages = Array.from(this.messages.values())
        .filter(msg => msg.instanceId === instanceId)
=======
      const instance = this.instances.get(instanceId);
      if (instance && instance.tenantId !== tenantId) {
        throw new Error('Unauthorized access to instance inbox');
      }

      let messages = Array.from(this.messages.values())
        .filter(msg => msg.instanceId === instanceId && msg.tenantId === tenantId)
>>>>>>> codex/getnet-prod-fix
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
<<<<<<< HEAD
  async markAsRead(instanceId, messageId) {
    try {
      const message = this.messages.get(messageId);
      if (message && message.instanceId === instanceId) {
=======
  async markAsRead(instanceId, tenantId, messageId) {
    try {
      const message = this.messages.get(messageId);
      if (message && message.instanceId === instanceId && message.tenantId === tenantId) {
>>>>>>> codex/getnet-prod-fix
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
<<<<<<< HEAD
  async sendMessage(instanceId, recipient, content, type = 'text') {
=======
  async sendMessage(instanceId, tenantId, recipient, content, type = 'text') {
>>>>>>> codex/getnet-prod-fix
    try {
      const instance = this.instances.get(instanceId);
      if (!instance || !instance.connected) {
        throw new Error(`Instance ${instanceId} not available`);
      }
<<<<<<< HEAD
=======
      if (instance.tenantId !== tenantId) {
        throw new Error('Unauthorized access to instance');
      }
>>>>>>> codex/getnet-prod-fix

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
<<<<<<< HEAD
=======
        tenantId,
>>>>>>> codex/getnet-prod-fix
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

<<<<<<< HEAD
      console.log(`[Inbox] Message sent: ${result.messageId}`);
=======
      console.log(`[Inbox] Message sent: ${result.messageId} (Tenant: ${tenantId})`);
>>>>>>> codex/getnet-prod-fix
      return result;
    } catch (error) {
      console.error(`[Inbox] Error sending message:`, error.message);
      throw error;
    }
  }

  /**
<<<<<<< HEAD
   * Get inbox summary
   */
  async getInboxSummary() {
    const summary = {
      totalInstances: this.instances.size,
=======
   * Get inbox summary for a tenant
   */
  async getInboxSummary(tenantId) {
    const summary = {
      totalInstances: 0,
>>>>>>> codex/getnet-prod-fix
      connectedInstances: 0,
      totalUnread: 0,
      instances: []
    };

    for (const [instanceId, instance] of this.instances) {
<<<<<<< HEAD
=======
      if (instance.tenantId !== tenantId) continue;

      summary.totalInstances++;
>>>>>>> codex/getnet-prod-fix
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
<<<<<<< HEAD
=======

>>>>>>> codex/getnet-prod-fix
