/**
 * Campaigns Module - Mass messaging campaigns
 * 
 * Handles creation, management, and execution of WhatsApp campaigns
 * Integrates with UAZAPI for sending and Bubble for storage
 */

import UaZAPIClient from '../../integrations/uazapi/client.js';
import BubbleClient from '../../integrations/bubble/client.js';
import { inboxManager } from '../inbox/index.js';
import { getWalletManager } from '../wallet/index.js';

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
        createdBy: campaignData.createdBy,
        tenantId: campaignData.tenantId
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
      
      // Multi-tenant check: Check if tenant has enough credits
      const walletManager = getWalletManager();
      const hasCredits = await walletManager.hasEnoughCredits(campaign.tenantId, 1);
      if (!hasCredits) {
        throw new Error(`Insufficient credits for tenant ${campaign.tenantId} to launch campaign`);
      }

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
      const campaign = this.activeCampaigns.get(item.campaignId) || item.campaign;

      if (!campaign || campaign.status === 'stopped' || campaign.status === 'cancelled') {
        continue;
      }

      if (campaign.status === 'paused') {
        this.sendingQueue.unshift(item);
        break;
      }

      if (campaign.status !== 'active' && campaign.status !== 'running') {
        continue;
      }
      
      try {
        await this.sendCampaignMessage(item);
      } catch (error) {
        console.error(`[Campaigns] Error sending message:`, error.message);
        
        // Retry logic
        if ((this.activeCampaigns.get(item.campaignId)?.status || item.campaign.status) === 'active' && item.retryCount < item.campaign.settings.maxRetries) {
          item.retryCount++;
          this.sendingQueue.push(item); // Re-queue for retry
          await this.delay(5000, item.campaignId); // Wait before retry
        } else {
          // Mark as failed
          item.campaign.metrics.failedCount++;
          await this.updateCampaignMetrics(item.campaignId);
        }
      }

      // Delay between messages
      if (this.sendingQueue.length > 0) {
        await this.delay(item.campaign.settings.delayBetweenMessages, item.campaignId);
      }
    }

    this.isProcessing = false;

    if (this.sendingQueue.some((item) => {
      const campaign = this.activeCampaigns.get(item.campaignId);
      return campaign?.status === 'active' || campaign?.status === 'running';
    })) {
      this.processSendingQueue();
    }
  }

  /**
   * Send individual campaign message
   */
  async sendCampaignMessage(item) {
    const { campaign, recipient, senderInstances } = item;

    const liveCampaign = this.activeCampaigns.get(campaign.id);
    if (!liveCampaign || liveCampaign.status !== 'active') {
      throw new Error(`Campanha ${campaign.id} não está ativa`);
    }

    // Select sender instance (round-robin)
    const senderInstance = senderInstances[campaign.metrics.sentCount % senderInstances.length];

    // Process message with spintext and variables
    const messageText = this.personalizeMessage(
      campaign.content.message || campaign.messageText,
      recipient,
      campaign.content.variables || campaign.variables || []
    );

    // Determine media type for this recipient
    const mediaType = recipient.mediaType || campaign.content.mediaType || 'text';
    const mediaUrl = recipient.mediaUrl || (campaign.content.media && campaign.content.media[0]);

    // 1. Verify and deduct credit BEFORE sending
    try {
      const liveBeforeDebit = this.activeCampaigns.get(campaign.id);
      if (!liveBeforeDebit || liveBeforeDebit.status !== 'active') {
        throw new Error(`Campanha ${campaign.id} foi pausada/parada antes do débito`);
      }
      const walletManager = getWalletManager();
      await walletManager.deductCredit(campaign.tenantId, 1, {
        campaignId: campaign.id,
        description: `Campaign message to ${recipient.phone}`
      });
    } catch (walletError) {
      console.error(`[Campaigns] Message blocked due to credit failure:`, walletError.message);
      throw new Error(`Credit deduction failed: ${walletError.message}`);
    }

    // 2. Send message based on type
    let result;
    try {
      const liveBeforeSend = this.activeCampaigns.get(campaign.id);
      if (!liveBeforeSend || liveBeforeSend.status !== 'active') {
        throw new Error(`Campanha ${campaign.id} foi pausada/parada antes do envio`);
      }

      if (mediaType !== 'text') {
        // Media message (image, video, videoplay, audio, myaudio, ptt, pttv, document, sticker)
        result = await uazapiClient.sendMedia(senderInstance.token || senderInstance.id, {
          number: recipient.phone,
          type: mediaType,
          file: mediaUrl,
          text: messageText, // Caption
          viewOnce: mediaType === 'image' || mediaType === 'video' || mediaType === 'ptv',
          replyid: recipient.replyTo
        });
      } else if (recipient.menuType && (recipient.buttons || recipient.sections)) {
        // Interactive menu/button message
        result = await uazapiClient.sendMenu(senderInstance.token || senderInstance.id, {
          number: recipient.phone,
          type: recipient.menuType, // 'button' or 'list'
          text: messageText,
          buttons: recipient.buttons, // For button type: [{buttonId, buttonText}]
          sections: recipient.sections, // For list type: [{title, rows: [{title, description, rowId}]}]
          footerText: recipient.footerText,
          replyid: recipient.replyTo
        });
      } else if (recipient.latitude && recipient.longitude) {
        // Location with button
        result = await uazapiClient.sendLocationButton(senderInstance.token || senderInstance.id, {
          number: recipient.phone,
          latitude: recipient.latitude,
          longitude: recipient.longitude,
          name: recipient.locationName || '',
          address: recipient.address || '',
          replyid: recipient.replyTo
        });
      } else {
        // Regular text message (supports placeholders and spintext)
        result = await uazapiClient.sendText(senderInstance.token || senderInstance.id, {
          number: recipient.phone,
          text: messageText,
          replyid: recipient.replyTo,
          linkPreview: true
        });
      }

      // Update metrics
      const liveAfterSend = this.activeCampaigns.get(campaign.id);
      if (!liveAfterSend || liveAfterSend.status !== 'active') {
        return;
      }

      campaign.metrics.sentCount++;
      await this.updateCampaignMetrics(campaign.id);

      // Store sent message record
      await bubbleClient.createRecord('CampaignMessage', {
        campaignId: campaign.id,
        tenantId: campaign.tenantId,
        recipientPhone: recipient.phone,
        senderInstanceId: senderInstance.id,
        message: messageText,
        messageId: result.id || result.messageId,
        sentAt: new Date(),
        status: 'sent',
        mediaType: mediaType
      });

      console.log(`[Campaigns] Message sent to ${recipient.phone} via ${senderInstance.id} (type: ${mediaType})`);
    } catch (sendError) {
      console.error(`[Campaigns] Failed to send message:`, sendError.message);
      throw sendError; // Re-throw for retry logic
    }
  }

  /**
   * Personalize message with variables and spintext
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

    // Process spintext syntax: {option1|option2|option3}
    const spinRegex = /\{([^{}]*)\}/g;
    message = message.replace(spinRegex, (match, options) => {
      if (!options) return match;
      
      const choices = options.split('|').map(s => s.trim()).filter(Boolean);
      if (choices.length === 0) return match;
      
      const randomIndex = Math.floor(Math.random() * choices.length);
      return choices[randomIndex];
    });

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
        // Use pool of available instances for this tenant
        const inboxSummary = await inboxManager.getInboxSummary(campaign.tenantId);
        return inboxSummary.instances
          .filter(instance => instance.connected)
          .slice(0, 10);
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
    * Process CSV file for contacts
    */
   async processCsvFile(fileBuffer) {
     try {
       // Convert buffer to string
       const csvContent = fileBuffer.toString('utf8');
       
       // Parse CSV (simple implementation - can be enhanced with proper CSV parser)
       const lines = csvContent.trim().split('\n');
       if (lines.length === 0) return [];
       
       // Assume first line is header
       const headers = lines[0].split(',').map(h => h.trim());
       const contacts = [];
       
       // Process each line
       for (let i = 1; i < lines.length; i++) {
         const values = lines[i].split(',').map(v => v.trim());
         const contact = {};
         
         // Map values to headers
         headers.forEach((header, index) => {
           contact[header] = values[index] || '';
         });
         
         // Standardize phone field (support different column names)
         const phoneFields = ['phone', 'number', 'telefone', 'celular', 'whatsapp'];
         let phoneNumber = '';
         
         for (const field of phoneFields) {
           if (contact[field]) {
             phoneNumber = contact[field];
             break;
           }
         }
         
         if (phoneNumber && this.isValidPhoneNumber(phoneNumber)) {
           contacts.push({
             phone: phoneNumber,
             name: contact.name || contact.Nome || contact.nome || phoneNumber,
             email: contact.email || contact.Email || contact.email || '',
             // Preserve any additional fields as variables
             ...Object.keys(contact)
               .filter(key => !phoneFields.includes(key.toLowerCase()) && 
                           !['name', 'email'].includes(key.toLowerCase()))
               .reduce((obj, key) => {
                 obj[key] = contact[key];
                 return obj;
               }, {})
           });
         }
       }
       
       console.log(`[Campaigns] Processed CSV: ${contacts.length} valid contacts found`);
       return contacts;
     } catch (error) {
       console.error(`[Campaigns] Error processing CSV file:`, error.message);
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

  async delay(ms, campaignId) {
    const step = 250;
    let elapsed = 0;
    while (elapsed < ms) {
      const campaign = campaignId ? this.activeCampaigns.get(campaignId) : null;
      if (campaignId && (!campaign || campaign.status !== 'active')) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(step, ms - elapsed)));
      elapsed += step;
    }
  }

  async updateCampaignStatus(campaignId, status) {
    const campaign = this.campaigns.get(campaignId) || this.activeCampaigns.get(campaignId) || await this.getCampaign(campaignId);
    if (!campaign) return false;

    campaign.status = status;
    campaign.updatedAt = new Date();
    this.campaigns.set(campaignId, campaign);

    try {
      await bubbleClient.updateRecord('Campaign', campaignId, {
        status,
        updatedAt: campaign.updatedAt,
        metrics: campaign.metrics
      });
    } catch (error) {
      console.error(`[Campaigns] Error updating status for ${campaignId}:`, error.message);
    }

    return true;
  }

  async getAllCampaigns(options = {}) {
    try {
      const { status, tenantId, limit = 50, offset = 0 } = options;
      
      // Get campaigns from Bubble
      const constraints = [];
      if (status) {
        constraints.push({
          key: 'status',
          constraint_type: 'equals',
          value: status
        });
      }

      if (tenantId) {
        constraints.push({
          key: 'tenantId',
          constraint_type: 'equals',
          value: tenantId
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
      
      const campaignFromStore = campaigns?.[0] || null;
      if (campaignFromStore?.id) {
        this.campaigns.set(campaignFromStore.id, campaignFromStore);
      }
      return campaignFromStore;
    } catch (error) {
      console.error('[Campaigns] Error getting campaign:', error.message);
      return null;
    }
  }

  async pauseCampaign(campaignId) {
    try {
      const updated = await this.updateCampaignStatus(campaignId, 'paused');
      return updated;
    } catch (error) {
      console.error('[Campaigns] Error pausing campaign:', error.message);
      return false;
    }
  }

  async stopCampaign(campaignId) {
    try {
      const updated = await this.updateCampaignStatus(campaignId, 'stopped');
      this.activeCampaigns.delete(campaignId);
      this.sendingQueue = this.sendingQueue.filter((item) => item.campaignId !== campaignId);
      return updated;
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
