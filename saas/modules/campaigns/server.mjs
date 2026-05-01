/**
 * Campaigns Module - Server
 * 
 * API endpoints para campanhas de disparo
 * Composição de mensagens e agendamento
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { walletManager } from '../wallet/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Campaign states
const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// State management
const state = {
  campaigns: new Map(),      // campaignId -> campaign
  messages: new Map(),     // messageId -> message template
  recipients: new Map(),   // campaignId -> recipients[]
  queue: [],               // Pending sends
  stats: {
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    lastUpdate: null
  },
  scheduler: null
};

/**
 * Create a new campaign
 */
export async function createCampaign(campaignData) {
  const {
    name,
    description,
    messageId,
    messageText,
    instances = [],
    recipients = [],
    schedule = null,
    throttle = { minDelay: 5, maxDelay: 15 },
    variables = [],
    tenantId
  } = campaignData;

  if (!tenantId) {
    throw new Error('tenantId is required for creating a campaign');
  }

  const campaign = {
    id: crypto.randomUUID(),
    tenantId,
    name,
    description,
    messageId,
    messageText,
    instances,
    recipientCount: recipients.length,
    schedule,
    throttle,
    variables,
    status: CAMPAIGN_STATUS.DRAFT,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    progress: {
      sent: 0,
      delivered: 0,
      failed: 0,
      remaining: recipients.length
    }
  };

  state.campaigns.set(campaign.id, campaign);
  state.recipients.set(campaign.id, recipients);
  state.stats.totalCampaigns++;

  console.log(`[campaigns:create] Created campaign ${campaign.id}: ${name}`);

  return campaign;
}

/**
 * Get campaign by ID
 */
export async function getCampaign(campaignId) {
  const campaign = state.campaigns.get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  const recipients = state.recipients.get(campaignId) || [];
  
  return {
    ...campaign,
    recipients: recipients.slice(0, 100), // Limit for API response
    recipientCount: recipients.length
  };
}

/**
 * List all campaigns
 */
export async function listCampaigns(options = {}) {
  const { status, limit = 50, offset = 0 } = options;
  
  let campaigns = Array.from(state.campaigns.values());
  
  // Filter by tenantId
  if (options.tenantId) {
    campaigns = campaigns.filter(c => c.tenantId === options.tenantId);
  }
  
  if (status) {
    campaigns = campaigns.filter(c => c.status === status);
  }
  
  // Sort by createdAt descending
  campaigns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const paginated = campaigns.slice(offset, offset + limit);
  
  return {
    campaigns: paginated,
    total: campaigns.length,
    hasMore: campaigns.length > offset + limit,
    stats: state.stats
  };
}

/**
 * Update campaign
 */
export async function updateCampaign(campaignId, updates) {
  const campaign = state.campaigns.get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  // Only allow updates if not running
  if (campaign.status === CAMPAIGN_STATUS.RUNNING) {
    throw new Error('Cannot update running campaign');
  }

  const allowedUpdates = ['name', 'description', 'messageText', 'schedule', 'throttle'];
  
  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      campaign[key] = updates[key];
    }
  }

  campaign.updatedAt = new Date().toISOString();

  console.log(`[campaigns:update] Updated campaign ${campaignId}`);

  return campaign;
}

/**
 * Delete campaign
 */
export async function deleteCampaign(campaignId) {
  const campaign = state.campaigns.get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  if (campaign.status === CAMPAIGN_STATUS.RUNNING) {
    throw new Error('Cannot delete running campaign');
  }

  state.campaigns.delete(campaignId);
  state.recipients.delete(campaignId);
  state.stats.totalCampaigns--;

  console.log(`[campaigns:delete] Deleted campaign ${campaignId}`);

  return { success: true };
}

/**
 * Start campaign
 */
export async function startCampaign(campaignId) {
  const campaign = state.campaigns.get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  if (campaign.status !== CAMPAIGN_STATUS.DRAFT && 
      campaign.status !== CAMPAIGN_STATUS.PAUSED &&
      campaign.status !== CAMPAIGN_STATUS.SCHEDULED) {
    throw new Error(`Cannot start campaign with status: ${campaign.status}`);
  }

  campaign.status = CAMPAIGN_STATUS.RUNNING;
  campaign.startedAt = new Date().toISOString();
  campaign.updatedAt = new Date().toISOString();

  state.stats.activeCampaigns++;

  // Queue recipients for sending
  const recipients = state.recipients.get(campaignId) || [];
  for (const recipient of recipients) {
    if (!recipient.sentAt) {
      state.queue.push({
        campaignId,
        recipient,
        instanceToken: selectInstance(campaign),
        scheduledAt: calculateSendTime(campaign),
        attempts: 0
      });
    }
  }

  console.log(`[campaigns:start] Started campaign ${campaignId} with ${recipients.length} recipients`);

  return campaign;
}

/**
 * Pause campaign
 */
export async function pauseCampaign(campaignId) {
  const campaign = state.campaigns.get(campaignId);
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  if (campaign.status !== CAMPAIGN_STATUS.RUNNING) {
    throw new Error('Campaign is not running');
  }

  campaign.status = CAMPAIGN_STATUS.PAUSED;
  campaign.updatedAt = new Date().toISOString();
  state.stats.activeCampaigns--;

  console.log(`[campaigns:pause] Paused campaign ${campaignId}`);

  return campaign;
}

/**
 * Create message template
 */
export async function createMessageTemplate(templateData) {
  const { name, text, category, variables = [], tenantId } = templateData;

  if (!tenantId) {
    throw new Error('tenantId is required for creating a template');
  }

  const template = {
    id: crypto.randomUUID(),
    tenantId,
    name,
    text,
    category,
    variables,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.messages.set(template.id, template);

  console.log(`[campaigns:template] Created template ${template.id}: ${name}`);

  return template;
}

/**
 * List message templates
 */
export async function listMessageTemplates(options = {}) {
  const { category, limit = 50, offset = 0 } = options;
  
  let templates = Array.from(state.messages.values());
  
  // Filter by tenantId
  if (options.tenantId) {
    templates = templates.filter(t => t.tenantId === options.tenantId);
  }

  if (category) {
    templates = templates.filter(t => t.category === category);
  }
  
  templates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const paginated = templates.slice(offset, offset + limit);
  
  return {
    templates: paginated,
    total: templates.length,
    hasMore: templates.length > offset + limit
  };
}

/**
 * Compose message with variables
 */
export function composeMessage(templateText, variables = {}, recipientData = {}) {
  let composed = templateText;
  
  // Replace template variables
  for (const [key, value] of Object.entries(variables)) {
    composed = composed.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  
  // Replace recipient data variables
  for (const [key, value] of Object.entries(recipientData)) {
    composed = composed.replace(new RegExp(`{{recipient.${key}}}`, 'g'), value || '');
  }
  
  return composed;
}

/**
 * Get campaign statistics
 */
export function getStats() {
  return {
    ...state.stats,
    queueSize: state.queue.length,
    lastUpdate: new Date().toISOString()
  };
}

// Helper functions
function selectInstance(campaign) {
  // Round-robin instance selection
  const instances = campaign.instances;
  if (!instances || instances.length === 0) {
    throw new Error('No instances available for campaign');
  }
  
  const index = Math.floor(Math.random() * instances.length);
  return instances[index];
}

function calculateSendTime(campaign) {
  const now = new Date();
  const throttle = campaign.throttle;
  
  // Add random delay between min and max
  const delayMs = (throttle.minDelay + Math.random() * (throttle.maxDelay - throttle.minDelay)) * 1000;
  
  return new Date(now.getTime() + delayMs);
}

/**
 * Initialize campaigns module
 */
export function initialize() {
  console.log('[campaigns] Module initialized');
  
  // Start scheduler loop
  startScheduler();
  
  return {
    state,
    CAMPAIGN_STATUS,
    createCampaign,
    getCampaign,
    listCampaigns,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    pauseCampaign,
    createMessageTemplate,
    listMessageTemplates,
    composeMessage,
    getStats
  };
}

/**
 * Scheduler loop for processing queue
 */
function startScheduler() {
  if (state.scheduler) {
    clearInterval(state.scheduler);
  }
  
  state.scheduler = setInterval(async () => {
    await processQueue();
  }, 5000); // Check every 5 seconds
  
  console.log('[campaigns:scheduler] Started');
}

/**
 * Process send queue
 */
async function processQueue() {
  const now = new Date();
  const toProcess = state.queue.filter(item => 
    item.scheduledAt <= now && 
    item.attempts < 3
  ).slice(0, 10); // Process max 10 at a time
  
  for (const item of toProcess) {
      // 1. Verify credits before sending
      const campaign = state.campaigns.get(item.campaignId);
      if (!campaign) throw new Error(`Campaign not found: ${item.campaignId}`);

      const hasCredits = await walletManager.hasEnoughCredits(campaign.tenantId, 1);
      if (!hasCredits) {
        console.warn(`[campaigns:send] Tenant ${campaign.tenantId} has insufficient credits. Pausing campaign.`);
        await pauseCampaign(item.campaignId);
        continue; 
      }

      // 2. Deduct credit
      await walletManager.deductCredit(campaign.tenantId, 1, {
        description: `Disparo da campanha: ${campaign.name}`,
        campaignId: campaign.id
      });

      // 3. TODO: Integrate with UAZAPI to send message
      // Actually, let's implement the send logic here if we have access to UAZAPI config
      // For now, let's simulate and log
      console.log(`[campaigns:send] Sending to ${item.recipient.number} via ${item.instanceToken} for Tenant ${campaign.tenantId}`);
      
      // Mark as sent
      item.recipient.sentAt = now.toISOString();
      item.recipient.status = 'sent';
      
      // Update campaign progress
      campaign.progress.sent++;
      campaign.progress.remaining--;
      
      state.stats.totalSent++;
      
      // Remove from queue
      const index = state.queue.indexOf(item);
      if (index > -1) {
        state.queue.splice(index, 1);
      }
    } catch (error) {
      console.error(`[campaigns:send] Failed to send: ${error.message}`);
      item.attempts++;
      
      if (item.attempts >= 3) {
        item.recipient.status = 'failed';
        item.recipient.error = error.message;
        
        const campaign = state.campaigns.get(item.campaignId);
        if (campaign) {
          campaign.progress.failed++;
          campaign.progress.remaining--;
        }
        
        state.stats.totalFailed++;
        
        // Remove from queue
        const index = state.queue.indexOf(item);
        if (index > -1) {
          state.queue.splice(index, 1);
        }
      }
    }
  }
  
  // Check for completed campaigns
  for (const campaign of state.campaigns.values()) {
    if (campaign.status === CAMPAIGN_STATUS.RUNNING && campaign.progress.remaining === 0) {
      campaign.status = CAMPAIGN_STATUS.COMPLETED;
      campaign.completedAt = new Date().toISOString();
      state.stats.activeCampaigns--;
      
      console.log(`[campaigns:complete] Campaign ${campaign.id} completed`);
    }
  }
}

export default { 
  initialize, 
  CAMPAIGN_STATUS,
  createCampaign, 
  getCampaign, 
  listCampaigns, 
  updateCampaign, 
  deleteCampaign, 
  startCampaign, 
  pauseCampaign,
  createMessageTemplate,
  listMessageTemplates,
  composeMessage,
  getStats 
};
