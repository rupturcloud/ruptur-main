/**
 * Inbox API Endpoints
 * 
 * REST API endpoints for inbox functionality
 */

import { inboxManager } from './index.js';

export function setupInboxRoutes(app) {
  // Initialize instance
  app.post('/api/inbox/initialize/:instanceId', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const success = await inboxManager.initializeInstance(instanceId);
      
      res.json({ success, instanceId });
    } catch (error) {
      console.error('[API] Error initializing instance:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get messages for instance
  app.get('/api/inbox/messages/:instanceId', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { limit = 50, offset = 0, unreadOnly, since } = req.query;
      
      const options = {
        limit: parseInt(limit),
        offset: parseInt(offset),
        unreadOnly: unreadOnly === 'true',
        since
      };
      
      const result = await inboxManager.getMessages(instanceId, options);
      res.json(result);
    } catch (error) {
      console.error('[API] Error getting messages:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark message as read
  app.put('/api/inbox/messages/:instanceId/:messageId/read', async (req, res) => {
    try {
      const { instanceId, messageId } = req.params;
      const success = await inboxManager.markAsRead(instanceId, messageId);
      
      res.json({ success });
    } catch (error) {
      console.error('[API] Error marking message as read:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Send message
  app.post('/api/inbox/send/:instanceId', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { recipient, content, type = 'text' } = req.body;
      
      if (!recipient || !content) {
        return res.status(400).json({ error: 'Recipient and content are required' });
      }
      
      const result = await inboxManager.sendMessage(instanceId, recipient, content, type);
      res.json(result);
    } catch (error) {
      console.error('[API] Error sending message:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get inbox summary
  app.get('/api/inbox/summary', async (req, res) => {
    try {
      const summary = await inboxManager.getInboxSummary();
      res.json(summary);
    } catch (error) {
      console.error('[API] Error getting inbox summary:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get instance details
  app.get('/api/inbox/instance/:instanceId', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const messages = await inboxManager.getMessages(instanceId, { limit: 1 });
      
      res.json({
        instanceId,
        exists: messages.total >= 0,
        unreadCount: messages.unreadCount
      });
    } catch (error) {
      console.error('[API] Error getting instance details:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk mark as read
  app.put('/api/inbox/messages/:instanceId/read-all', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const messages = await inboxManager.getMessages(instanceId, { unreadOnly: true });
      
      let markedCount = 0;
      for (const message of messages.messages) {
        const success = await inboxManager.markAsRead(instanceId, message.id);
        if (success) markedCount++;
      }
      
      res.json({ markedCount });
    } catch (error) {
      console.error('[API] Error marking all messages as read:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[API] Inbox routes registered');
}
