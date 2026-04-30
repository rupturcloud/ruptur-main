/**
 * Inbox Module - Server
 * 
 * API endpoints para gerenciamento de conversas e mensagens
 * Integração com Bubble para inbox unificado
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// State management
const state = {
  conversations: new Map(), // instanceToken -> conversations[]
  messages: new Map(),      // conversationId -> messages[]
  lastSync: new Map(),      // instanceToken -> timestamp
  stats: {
    totalConversations: 0,
    totalMessages: 0,
    unreadCount: 0,
    lastUpdate: null
  }
};

/**
 * Get conversations for a specific instance
 */
export async function getConversations(instanceToken, options = {}) {
  const { limit = 50, offset = 0, unreadOnly = false } = options;
  
  const conversations = state.conversations.get(instanceToken) || [];
  
  let filtered = conversations;
  if (unreadOnly) {
    filtered = conversations.filter(c => c.unreadCount > 0);
  }
  
  const paginated = filtered.slice(offset, offset + limit);
  
  return {
    conversations: paginated,
    total: filtered.length,
    hasMore: filtered.length > offset + limit,
    lastSync: state.lastSync.get(instanceToken)
  };
}

/**
 * Get messages for a specific conversation
 */
export async function getMessages(conversationId, options = {}) {
  const { limit = 100, before = null, after = null } = options;
  
  const messages = state.messages.get(conversationId) || [];
  
  let filtered = messages;
  if (before) {
    filtered = filtered.filter(m => new Date(m.timestamp) < new Date(before));
  }
  if (after) {
    filtered = filtered.filter(m => new Date(m.timestamp) > new Date(after));
  }
  
  // Sort by timestamp descending (newest first)
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  const paginated = filtered.slice(0, limit);
  
  return {
    messages: paginated,
    hasMore: filtered.length > limit
  };
}

/**
 * Send a message from inbox
 */
export async function sendMessage(instanceToken, conversationId, messageData) {
  const { text, mediaUrl, mediaType, replyTo } = messageData;
  
  // TODO: Integrate with UAZAPI to send message
  console.log(`[inbox:send] Sending message from ${instanceToken} to conversation ${conversationId}`);
  
  const message = {
    id: crypto.randomUUID(),
    conversationId,
    instanceToken,
    direction: 'outbound',
    text,
    mediaUrl,
    mediaType,
    replyTo,
    status: 'pending',
    timestamp: new Date().toISOString(),
    sentAt: null,
    deliveredAt: null,
    readAt: null
  };
  
  // Add to messages
  const messages = state.messages.get(conversationId) || [];
  messages.unshift(message);
  state.messages.set(conversationId, messages);
  
  // Update conversation last message
  const conversations = state.conversations.get(instanceToken) || [];
  const conv = conversations.find(c => c.id === conversationId);
  if (conv) {
    conv.lastMessage = message;
    conv.lastMessageAt = message.timestamp;
  }
  
  return message;
}

/**
 * Mark conversation as read
 */
export async function markAsRead(instanceToken, conversationId) {
  const conversations = state.conversations.get(instanceToken) || [];
  const conv = conversations.find(c => c.id === conversationId);
  
  if (conv) {
    conv.unreadCount = 0;
    conv.isRead = true;
    state.stats.unreadCount = Math.max(0, state.stats.unreadCount - (conv.unreadCount || 0));
  }
  
  return { success: true };
}

/**
 * Process incoming message from Bubble webhook
 */
export async function processIncomingMessage(instanceToken, messageData) {
  const { 
    messageId, 
    from, 
    to, 
    text, 
    mediaUrl, 
    mediaType, 
    timestamp,
    contactName,
    contactNumber
  } = messageData;
  
  // Find or create conversation
  let conversationId = findConversationByContact(instanceToken, from);
  
  if (!conversationId) {
    conversationId = crypto.randomUUID();
    createConversation(instanceToken, {
      id: conversationId,
      contactNumber: from,
      contactName: contactName || from,
      instanceToken,
      unreadCount: 1,
      isRead: false,
      createdAt: timestamp,
      lastMessageAt: timestamp,
      lastMessage: null
    });
  }
  
  // Create message
  const message = {
    id: messageId || crypto.randomUUID(),
    conversationId,
    instanceToken,
    direction: 'inbound',
    from,
    to,
    text,
    mediaUrl,
    mediaType,
    timestamp,
    status: 'received'
  };
  
  // Add to messages
  const messages = state.messages.get(conversationId) || [];
  messages.push(message);
  state.messages.set(conversationId, messages);
  
  // Update conversation
  const conversations = state.conversations.get(instanceToken) || [];
  const conv = conversations.find(c => c.id === conversationId);
  if (conv) {
    conv.lastMessage = message;
    conv.lastMessageAt = timestamp;
    conv.unreadCount = (conv.unreadCount || 0) + 1;
    state.stats.unreadCount++;
  }
  
  state.stats.totalMessages++;
  
  console.log(`[inbox:receive] Processed message ${message.id} for conversation ${conversationId}`);
  
  return message;
}

/**
 * Helper: Find conversation by contact number
 */
function findConversationByContact(instanceToken, contactNumber) {
  const conversations = state.conversations.get(instanceToken) || [];
  const conv = conversations.find(c => c.contactNumber === contactNumber);
  return conv ? conv.id : null;
}

/**
 * Helper: Create new conversation
 */
function createConversation(instanceToken, conversation) {
  const conversations = state.conversations.get(instanceToken) || [];
  conversations.unshift(conversation);
  state.conversations.set(instanceToken, conversations);
  state.stats.totalConversations++;
}

/**
 * Get inbox statistics
 */
export function getStats() {
  return {
    ...state.stats,
    conversationsByInstance: Array.from(state.conversations.keys()).length,
    lastUpdate: new Date().toISOString()
  };
}

/**
 * Initialize inbox module
 */
export function initialize() {
  console.log('[inbox] Module initialized');
  return {
    state,
    getConversations,
    getMessages,
    sendMessage,
    markAsRead,
    processIncomingMessage,
    getStats
  };
}

export default { initialize, getConversations, getMessages, sendMessage, markAsRead, processIncomingMessage, getStats };
