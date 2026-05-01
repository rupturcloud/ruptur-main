/**
 * Inbox Module - Server
 * 
 * API endpoints para gerenciamento de conversas e mensagens
 * Integração com Bubble para inbox unificado
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import UaZAPIClient from '../../integrations/uazapi/client.js';

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

// UAZAPI Client
const uazapiClient = new UaZAPIClient();

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
   
  // Tentativa de buscar mensagens frescas do UAZAPI se tivermos o instanceToken
  // Isso seria chamado quando houver uma conversa específica
  
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
 * Sync messages from UAZAPI for a specific instance
 * Isso seria chamado periodicamente ou via webhook
 */
export async function syncMessagesFromUazapi(instanceToken) {
  try {
    // Busca instância no UAZAPI para obter detalhes
    const instance = await uazapiClient.getInstance(instanceToken);
    
    // Busca mensagens recentes (últimas 24h ou desde a última sync)
    const lastSync = state.lastSync.get(instanceToken) || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h atrás como padrão
    
    // Nota: O UAZAPI pode ter um endpoint específico para buscar mensagens
    // Por enquanto, vamos simular ou depender do webhook para atualização em tempo real
    // Em uma implementação real, seria algo como:
    // const messages = await uazapiClient.getMessages(instanceToken, { since: lastSync });
    
    // Por enquanto, vamos atualizar apenas o timestamp de última sync
    state.lastSync.set(instanceToken, new Date().toISOString());
    
    console.log(`[inbox:sync] Synced messages for instance ${instanceToken}`);
    return { success: true, instance };
  } catch (error) {
    console.error(`[inbox:sync] Failed to sync messages for instance ${instanceToken}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Send a message from inbox
 * Supports: text, media (image/video/audio), buttons, menus, spintext
 */
export async function sendMessage(instanceToken, conversationId, messageData) {
  const { 
    text, 
    mediaUrl, 
    mediaType = 'text', 
    replyTo,
    to,
    buttons,
    menuType,
    sections,
    footerText,
    latitude,
    longitude,
    address,
    contactName,
    spinTextEnabled = true
  } = messageData;
   
  try {
    let result;
    let processedText = text;
   
    // Process spintext if enabled
    if (spinTextEnabled && text) {
      processedText = uazapiClient.processSpinText(text);
    }
   
    // Determine message type and send accordingly
    if (mediaType !== 'text') {
      // Media message (image, video, videoplay, audio, myaudio, ptt, ptv, document, sticker)
      const mediaOptions = {
        number: to || '',
        type: mediaType,
        file: mediaUrl,
        text: processedText, // Caption
        replyid: replyTo,
        viewOnce: mediaType === 'image' || mediaType === 'video' || mediaType === 'ptv'
      };
     
      result = await uazapiClient.sendMedia(instanceToken, mediaOptions);
     
    } else if (menuType && (buttons || sections)) {
      // Interactive menu/button message
      const menuOptions = {
        number: to || '',
        type: menuType, // 'button' or 'list'
        text: processedText,
        buttons: buttons, // For button type: [{buttonId, buttonText}]
        sections: sections, // For list type: [{title, rows: [{title, description, rowId}]}]
        footerText,
        replyid: replyTo
      };
     
      result = await uazapiClient.sendMenu(instanceToken, menuOptions);
     
    } else if (latitude && longitude) {
      // Location with button
      const locationOptions = {
        number: to || '',
        latitude,
        longitude,
        name: contactName || '',
        address: address || '',
        replyid: replyTo
      };
     
      result = await uazapiClient.sendLocationButton(instanceToken, locationOptions);
     
    } else if (to && (to.includes('@g.us') || to.includes('@newsletter'))) {
      // Contact card(s)
      result = await uazapiClient.sendContact(instanceToken, {
        number: messageData.from || '',
        contacts: to // Can be string or array
      });
     
    } else {
      // Regular text message (supports placeholders and spintext)
      const textOptions = {
        number: to || '',
        text: processedText,
        replyid: replyTo,
        linkPreview: true
      };
     
      result = await uazapiClient.sendText(instanceToken, textOptions);
    }
   
    const message = {
      id: result.id || result.messageId || crypto.randomUUID(),
      conversationId,
      instanceToken,
      direction: 'outbound',
      text: processedText,
      mediaUrl,
      mediaType,
      replyTo,
      status: 'sent',
      timestamp: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
      uazapiId: result.id || result.messageId
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
   
    console.log(`[inbox:send] Message sent successfully via UAZAPI: ${message.id} (type: ${mediaType})`);
    return message;
  } catch (error) {
    console.error(`[inbox:send] Failed to send message: ${error.message}`);
   
    // Fallback para comportamento anterior em caso de falha
    const message = {
      id: crypto.randomUUID(),
      conversationId,
      instanceToken,
      direction: 'outbound',
      text: processedText || text,
      mediaUrl,
      mediaType,
      replyTo,
      status: 'failed',
      timestamp: new Date().toISOString(),
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      error: error.message
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
