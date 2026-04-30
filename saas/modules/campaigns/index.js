/**
 * Campaigns Module - Mass messaging campaigns
 * 
 * Handles creation, management, and execution of WhatsApp campaigns
 * Integrates with UAZAPI for sending and Bubble for storage
 */

import UaZAPIClient from '../../integrations/uazapi/client.js';
import BubbleClient from '../../integrations/bubble/client.js';
import { inboxManager } from '../inbox/index.js';

const uazapiClient = new UaZAPIClient();
const bubbleClient = new BubbleClient();

export class CampaignManager {
  constructor() {
    this.campaigns = new Map();
    this.activeCampaigns = new Map();
    this.sendingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Create a new campaign
   */
  async createCampaign(campaignData) {
    try {
      const campaign = {
        id: this.generateId(),
        name: campaignData.name,
        description: campaignData.description,
        type: campaignData.type || 'broadcast', // broadcast, sequence, trigger
        status: 'draft',
        settings: {
          delayBetweenMessages: campaignData.delayBetweenMessages || 5000,
          maxRetries: campaignData.maxRetries || 3,
          scheduleType: campaignData.scheduleType || 'immediate', // immediate, scheduled, recurring
          scheduledAt: campaignData.scheduledAt,
          timezone: campaignData.timezone || 'America/Sao_Paulo'
        },
        content: {
          message: campaignData.message,
          media: campaignData.media || [],
          variables: campaignData.variables || []
        },
        recipients: {
          type: campaignData.recipientType || 'list', // list, segment, all
          listId: campaignData.listId,
          segmentId: campaignData.segmentId,
          customNumbers: campaignData.customNumbers || []
        },
        sender: {
          type: campaignData.senderType || 'pool', // pool, specific, rotation
          instanceIds: campaignData.instanceIds || [],
          maxMessagesPerInstance: campaignData.maxMessagesPerInstance || 50
        },
        metrics: {
          totalRecipients: 0,
          sentCount: 0,
          deliveredCount: 0,
          readCount: 0,
          failedCount: 0,
          replyCount: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: campaignData.createdBy
      };

      // Store in local cache
      this.campaigns.set(campaign.id, campaign);

      // Store in Bubble
      await bubbleClient.createRecord('Campaign', campaign);

      console.log(`[Campaigns] Campaign created: ${campaign.id} - ${campaign.name}`);
      return campaign;
    } catch (error) {
      console.error(`[Campaigns] Error creating campaign:`, error.message);
      throw error;
    }
  }

  /**
   * Launch campaign
   */
  async launchCampaign(campaignId) {
    try {
      const campaign = this.campaigns.get(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      if (campaign.status !== 'draft') {
        throw new Error(`Campaign ${campaignId} is not in draft status`);
      }

      // Get recipients
      const recipients = await this.getRecipients(campaign);
      campaign.metrics.totalRecipients = recipients.length;

      if (recipients.length === 0) {
        throw new Error('No recipients found for campaign');
      }

      // Update campaign status
      campaign.status = 'active';
      campaign.launchedAt = new Date();
      campaign.updatedAt = new Date();

      // Store in active campaigns
      this.activeCampaigns.set(campaignId, campaign);

      // Update in Bubble
      await bubbleClient.updateRecord('Campaign', campaignId, {
        status: 'active',
        launchedAt: campaign.launchedAt,
        metrics: campaign.metrics
      });

      // Start sending based on schedule
      if (campaign.settings.scheduleType === 'immediate') {
        await this.startSending(campaignId, recipients);
      } else {
        this.scheduleCampaign(campaignId, recipients);
      }

      console.log(`[Campaigns] Campaign launched: ${campaignId} with ${recipients.length} recipients`);
      return true;
    } catch (error) {
      console.error(`[Campaigns] Error launching campaign ${campaignId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get recipients for campaign
   */
  async getRecipients(campaign) {
    try {
      let recipients = [];

      switch (campaign.recipients.type) {
        case 'list':
          recipients = await this.getContactsFromList(campaign.recipients.listId);
          break;
        case 'segment':
          recipients = await this.getContactsFromSegment(campaign.recipients.segmentId);
          break;
        case 'all':
          recipients = await this.getAllContacts();
          break;
        case 'custom':
          recipients = campaign.recipients.customNumbers.map(number => ({
            phone: number,
            name: number
          }));
          break;
      }

      // Filter valid numbers
      return recipients.filter(contact => 
        contact.phone && this.isValidPhoneNumber(contact.phone)
      );
    } catch (error) {
      console.error(`[Campaigns] Error getting recipients:`, error.message);
      return [];
    }
  }

  /**
   * Start sending campaign messages
   */
  async startSending(campaignId, recipients) {
    try {
      const campaign = this.activeCampaigns.get(campaignId);
      if (!campaign) return;

      // Get available sender instances
      const senderInstances = await this.getSenderInstances(campaign);
      if (senderInstances.length === 0) {
        throw new Error('No sender instances available');
      }

      console.log(`[Campaigns] Starting to send campaign ${campaignId} to ${recipients.length} recipients`);

      // Add to sending queue
      for (const recipient of recipients) {
        this.sendingQueue.push({
          campaignId,
          recipient,
          campaign,
          senderInstances,
          retryCount: 0
        });
      }

      // Start processing queue if not already running
      if (!this.isProcessing) {
        this.processSendingQueue();
      }
    } catch (error) {
      console.error(`[Campaigns] Error starting campaign sending:`, error.message);
    }
  }

  /**
   * Process sending queue
   */
  async processSendingQueue() {
    if (this.isProcessing || this.sendingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.sendingQueue.length > 0) {
      const item = this.sendingQueue.shift();
      
      try {
        await this.sendCampaignMessage(item);
      } catch (error) {
        console.error(`[Campaigns] Error sending message:`, error.message);
        
        // Retry logic
        if (item.retryCount < item.campaign.settings.maxRetries) {
          item.retryCount++;
          this.sendingQueue.push(item); // Re-queue for retry
          await this.delay(5000); // Wait before retry
        } else {
          // Mark as failed
          item.campaign.metrics.failedCount++;
          await this.updateCampaignMetrics(item.campaignId);
        }
      }

      // Delay between messages
      if (this.sendingQueue.length > 0) {
        await this.delay(item.campaign.settings.delayBetweenMessages);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Send individual campaign message
   */
  async sendCampaignMessage(item) {
    const { campaign, recipient, senderInstances } = item;

    // Select sender instance (round-robin)
    const senderInstance = senderInstances[campaign.metrics.sentCount % senderInstances.length];

    // Personalize message
    const personalizedMessage = this.personalizeMessage(
      campaign.content.message,
      recipient,
      campaign.content.variables
    );

    // Send message
    const result = await inboxManager.sendMessage(
      senderInstance.id,
      recipient.phone,
      personalizedMessage,
      campaign.content.media.length > 0 ? 'media' : 'text'
    );

    // Update metrics
    campaign.metrics.sentCount++;
    await this.updateCampaignMetrics(campaign.id);

    // Store sent message record
    await bubbleClient.createRecord('CampaignMessage', {
      campaignId: campaign.id,
      recipientPhone: recipient.phone,
      senderInstanceId: senderInstance.id,
      message: personalizedMessage,
      messageId: result.messageId,
      sentAt: new Date(),
      status: 'sent'
    });

    console.log(`[Campaigns] Message sent to ${recipient.phone} via ${senderInstance.id}`);
  }

  /**
   * Personalize message with variables
   */
  personalizeMessage(template, recipient, variables) {
    let message = template;

    // Replace common variables
    message = message.replace(/\{name\}/g, recipient.name || '');
    message = message.replace(/\{phone\}/g, recipient.phone || '');
    message = message.replace(/\{email\}/g, recipient.email || '');

    // Replace custom variables
    for (const variable of variables) {
      const value = recipient.variables?.[variable.name] || variable.defaultValue || '';
      message = message.replace(new RegExp(`\\{${variable.name}\\}`, 'g'), value);
    }

    return message;
  }

  /**
   * Get available sender instances
   */
  async getSenderInstances(campaign) {
    try {
      if (campaign.sender.type === 'specific') {
        // Use specific instances
        const instances = [];
        for (const instanceId of campaign.sender.instanceIds) {
          const instance = await uazapiClient.getInstance(instanceId);
          if (instance && instance.connected) {
            instances.push(instance);
          }
        }
        return instances;
      } else {
        // Use pool of available instances
        const allInstances = await uazapiClient.getInstances();
        return allInstances
          .filter(instance => instance.connected)
          .slice(0, 10); // Limit to 10 instances
      }
    } catch (error) {
      console.error(`[Campaigns] Error getting sender instances:`, error.message);
      return [];
    }
  }

  /**
   * Get contacts from list
   */
  async getContactsFromList(listId) {
    try {
      // This would integrate with Bubble or your contact management system
      const contacts = await bubbleClient.getRecords('Contact', { listId });
      return contacts;
    } catch (error) {
      console.error(`[Campaigns] Error getting contacts from list ${listId}:`, error.message);
      return [];
    }
  }

  /**
   * Update campaign metrics
   */
  async updateCampaignMetrics(campaignId) {
    try {
      const campaign = this.campaigns.get(campaignId);
      if (!campaign) return;

      // Update in Bubble
      await bubbleClient.updateRecord('Campaign', campaignId, {
        metrics: campaign.metrics
      });
    } catch (error) {
      console.error(`[Campaigns] Error updating metrics:`, error.message);
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId) {
    try {
      const campaign = this.campaigns.get(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Get detailed stats from Bubble
      const messages = await bubbleClient.getRecords('CampaignMessage', { campaignId });
      
      const stats = {
        ...campaign.metrics,
        deliveryRate: campaign.metrics.totalRecipients > 0 
          ? (campaign.metrics.deliveredCount / campaign.metrics.totalRecipients) * 100 
          : 0,
        readRate: campaign.metrics.sentCount > 0 
          ? (campaign.metrics.readCount / campaign.metrics.sentCount) * 100 
          : 0,
        replyRate: campaign.metrics.deliveredCount > 0 
          ? (campaign.metrics.replyCount / campaign.metrics.deliveredCount) * 100 
          : 0
      };

      return stats;
    } catch (error) {
      console.error(`[Campaigns] Error getting campaign stats:`, error.message);
      return null;
    }
  }

  /**
   * Utility functions
   */
  generateId() {
    return `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  isValidPhoneNumber(phone) {
    // Basic validation - can be enhanced
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getAllCampaigns(options = {}) {
    try {
      const { status, limit = 50, offset = 0 } = options;
      
      // Get campaigns from Bubble
      const constraints = [];
      if (status) {
        constraints.push({
          key: 'status',
          constraint_type: 'equals',
          value: status
        });
      }
      
      const campaigns = await bubbleClient.getThings('Campaign', {
        constraints,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      return {
        campaigns: campaigns || [],
        total: campaigns?.length || 0
      };
    } catch (error) {
      console.error('[Campaigns] Error getting all campaigns:', error.message);
      return { campaigns: [], total: 0 };
    }
  }

  async getContactsFromSegment(segmentId) {
    // Implementation would depend on your segmentation system
    return [];
  }

  async getCampaign(campaignId) {
    try {
      const campaign = this.campaigns.get(campaignId);
      if (campaign) return campaign;
      
      // Try to get from Bubble
      const campaigns = await bubbleClient.getThings('Campaign', {
        constraints: [{ key: 'id', constraint_type: 'equals', value: campaignId }]
      });
      
      return campaigns?.[0] || null;
    } catch (error) {
      console.error('[Campaigns] Error getting campaign:', error.message);
      return null;
    }
  }

  async pauseCampaign(campaignId) {
    try {
      const campaign = this.activeCampaigns.get(campaignId);
      if (campaign) {
        campaign.status = 'paused';
        campaign.updatedAt = new Date();
        await this.updateCampaignMetrics(campaignId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Campaigns] Error pausing campaign:', error.message);
      return false;
    }
  }

  async stopCampaign(campaignId) {
    try {
      const campaign = this.activeCampaigns.get(campaignId);
      if (campaign) {
        campaign.status = 'stopped';
        campaign.updatedAt = new Date();
        this.activeCampaigns.delete(campaignId);
        await this.updateCampaignMetrics(campaignId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[Campaigns] Error stopping campaign:', error.message);
      return false;
    }
  }

  async getCampaignMessages(campaignId, options = {}) {
    try {
      const messages = await bubbleClient.getThings('CampaignMessage', {
        constraints: [{ key: 'campaignId', constraint_type: 'equals', value: campaignId }],
        limit: options.limit || 50,
        offset: options.offset || 0
      });
      
      return {
        messages: messages || [],
        total: messages?.length || 0
      };
    } catch (error) {
      console.error('[Campaigns] Error getting campaign messages:', error.message);
      return { messages: [], total: 0 };
    }
  }

  async testCampaign(campaignId, testNumbers) {
    try {
      const campaign = this.campaigns.get(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const results = [];
      for (const number of testNumbers) {
        try {
          const result = await inboxManager.sendMessage(
            campaign.sender.instanceIds[0],
            number,
            campaign.content.message,
            campaign.content.media.length > 0 ? 'media' : 'text'
          );
          results.push({ number, success: true, messageId: result.messageId });
        } catch (error) {
          results.push({ number, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error('[Campaigns] Error testing campaign:', error.message);
      throw error;
    }
  }

  async duplicateCampaign(campaignId, name) {
    try {
      const original = await this.getCampaign(campaignId);
      if (!original) {
        throw new Error('Original campaign not found');
      }

      const duplicated = {
        ...original,
        id: this.generateId(),
        name: name || `${original.name} (Copy)`,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.campaigns.set(duplicated.id, duplicated);
      await bubbleClient.createRecord('Campaign', duplicated);

      return duplicated;
    } catch (error) {
      console.error('[Campaigns] Error duplicating campaign:', error.message);
      throw error;
    }
  }

  async getCampaignTemplates() {
    try {
      const templates = await bubbleClient.getThings('CampaignTemplate');
      return templates || [];
    } catch (error) {
      console.error('[Campaigns] Error getting campaign templates:', error.message);
      return [];
    }
  }

  async createCampaignFromTemplate(templateId, name, customizations) {
    try {
      const templates = await bubbleClient.getThings('CampaignTemplate', {
        constraints: [{ key: 'id', constraint_type: 'equals', value: templateId }]
      });
      
      const template = templates?.[0];
      if (!template) {
        throw new Error('Template not found');
      }

      const campaign = {
        ...template,
        id: this.generateId(),
        name: name || template.name,
        ...customizations,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.campaigns.set(campaign.id, campaign);
      await bubbleClient.createRecord('Campaign', campaign);

      return campaign;
    } catch (error) {
      console.error('[Campaigns] Error creating campaign from template:', error.message);
      throw error;
    }
  }

  scheduleCampaign(campaignId, recipients) {
    // Implementation for scheduled campaigns
    console.log(`[Campaigns] Campaign ${campaignId} scheduled`);
  }
}

// Export singleton instance
export const campaignManager = new CampaignManager();
export default campaignManager;
