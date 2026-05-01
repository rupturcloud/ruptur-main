/**
 * Campaigns API Endpoints
 * 
 * REST API endpoints for campaign functionality
 */

import { campaignManager } from './index.js';

export function setupCampaignRoutes(app) {
  // Create campaign
  app.post('/api/campaigns', async (req, res) => {
    try {
      const campaign = await campaignManager.createCampaign(req.body);
      res.json(campaign);
    } catch (error) {
      console.error('[API] Error creating campaign:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all campaigns
  app.get('/api/campaigns', async (req, res) => {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      
      // This would typically query from Bubble
      const campaigns = await campaignManager.getAllCampaigns({
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json(campaigns);
    } catch (error) {
      console.error('[API] Error getting campaigns:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific campaign
  app.get('/api/campaigns/:campaignId', async (req, res) => {
    try {
      const { campaignId } = req.params;
      const campaign = await campaignManager.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error('[API] Error getting campaign:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Launch campaign
  app.post('/api/campaigns/:campaignId/launch', async (req, res) => {
    try {
      const { campaignId } = req.params;
      const success = await campaignManager.launchCampaign(campaignId);
      
      res.json({ success, campaignId });
    } catch (error) {
      console.error('[API] Error launching campaign:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Pause campaign
  app.post('/api/campaigns/:campaignId/pause', async (req, res) => {
    try {
      const { campaignId } = req.params;
      const success = await campaignManager.pauseCampaign(campaignId);
      
      res.json({ success, campaignId });
    } catch (error) {
      console.error('[API] Error pausing campaign:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Stop campaign
  app.post('/api/campaigns/:campaignId/stop', async (req, res) => {
    try {
      const { campaignId } = req.params;
      const success = await campaignManager.stopCampaign(campaignId);
      
      res.json({ success, campaignId });
    } catch (error) {
      console.error('[API] Error stopping campaign:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get campaign statistics
  app.get('/api/campaigns/:campaignId/stats', async (req, res) => {
    try {
      const { campaignId } = req.params;
      const stats = await campaignManager.getCampaignStats(campaignId);
      
      if (!stats) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json(stats);
    } catch (error) {
      console.error('[API] Error getting campaign stats:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get campaign messages
  app.get('/api/campaigns/:campaignId/messages', async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { limit = 50, offset = 0, status } = req.query;
      
      const messages = await campaignManager.getCampaignMessages(campaignId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status
      });
      
      res.json(messages);
    } catch (error) {
      console.error('[API] Error getting campaign messages:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Test campaign (send to test numbers)
  app.post('/api/campaigns/:campaignId/test', async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { testNumbers } = req.body;
      
      if (!testNumbers || !Array.isArray(testNumbers) || testNumbers.length === 0) {
        return res.status(400).json({ error: 'Test numbers are required' });
      }
      
      const results = await campaignManager.testCampaign(campaignId, testNumbers);
      res.json(results);
    } catch (error) {
      console.error('[API] Error testing campaign:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Duplicate campaign
  app.post('/api/campaigns/:campaignId/duplicate', async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { name } = req.body;
      
      const duplicatedCampaign = await campaignManager.duplicateCampaign(campaignId, name);
      res.json(duplicatedCampaign);
    } catch (error) {
      console.error('[API] Error duplicating campaign:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

// Get campaign templates
app.get('/api/campaigns/templates', async (req, res) => {
  try {
    const templates = await campaignManager.getCampaignTemplates();
    res.json(templates);
  } catch (error) {
    console.error('[API] Error getting campaign templates:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create campaign from template
app.post('/api/campaigns/from-template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, customizations } = req.body;
    
    const campaign = await campaignManager.createCampaignFromTemplate(templateId, name, customizations);
    res.json(campaign);
  } catch (error) {
    console.error('[API] Error creating campaign from template:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Upload contacts CSV
app.post('/api/campaigns/upload-contacts', async (req, res) => {
  try {
    // This would typically handle multipart/form-data
    // For simplicity, we'll expect a base64 encoded file in the body
    const { fileBuffer, fileName } = req.body;
    
    if (!fileBuffer || !fileName) {
      return res.status(400).json({ error: 'File buffer and file name are required' });
    }
    
    // Decode base64 buffer
    const buffer = Buffer.from(fileBuffer, 'base64');
    
    // Process CSV
    const contacts = await campaignManager.processCsvFile(buffer);
    
    res.json({
      success: true,
      contacts,
      count: contacts.length,
      message: `Processed ${contacts.length} valid contacts from CSV`
    });
  } catch (error) {
    console.error('[API] Error uploading contacts:', error.message);
    res.status(500).json({ error: error.message });
  }
});

  console.log('[API] Campaign routes registered');
}
