import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader, AlertCircle, RefreshCw, ChevronUp } from 'lucide-react';
import './MessageThread.css';

/**
 * MessageThread — Componente de Exibição de Histórico de Mensagens
 *
 * Funcionalidades:
 * - Carrega histórico de mensagens com paginação
 * - Lazy-load para histórico longo
 * - Suporte a Pub/Sub para notificações em tempo real
 * - Status visual: enviado, entregue, lido
 * - Scroll automático para novas mensagens
 * - Indicadores de digitação
 */

const MessageThread = ({
  chatId,
  instanceId,
  tenantId,
  onNewMessage,
  pubSubClient,
}) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  /**
   * Carregar mensagens iniciais
   */
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/messages?chat_id=${chatId}&instance_id=${instanceId}&tenant_id=${tenantId}&limit=50&offset=0`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setMessages(data.messages || []);
      setHasMore(data.has_more || false);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('[MessageThread] Erro ao carregar mensagens:', err);
      setError(err.message || 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [chatId, instanceId, tenantId]);

  /**
   * Carregar mais mensagens (lazy-load)
   */
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    try {
      setIsLoadingMore(true);

      const offset = messages.length;
      const response = await fetch(
        `/api/messages?chat_id=${chatId}&instance_id=${instanceId}&tenant_id=${tenantId}&limit=50&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao carregar mais mensagens');
      }

      const data = await response.json();
      setMessages((prev) => [...(data.messages || []), ...prev]);
      setHasMore(data.has_more || false);
    } catch (err) {
      console.error('[MessageThread] Erro ao carregar mais:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, instanceId, tenantId, messages.length, hasMore, isLoadingMore]);

  /**
   * Auto-scroll para última mensagem
   */
  const scrollToBottom = useCallback(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  /**
   * Monitorar Pub/Sub para novos eventos
   */
  useEffect(() => {
    loadMessages();

    if (!pubSubClient) {
      return;
    }

    const handleNewMessage = (message) => {
      if (message.chat_id === chatId && message.instance_id === instanceId) {
        setMessages((prev) => [...prev, message]);
        shouldAutoScrollRef.current = true;
        scrollToBottom();
      }
    };

    const handleMessageStatus = (status) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === status.message_id
            ? { ...msg, status: status.status, updated_at: status.timestamp }
            : msg
        )
      );
    };

    const handleTypingStatus = (data) => {
      if (data.chat_id === chatId && data.instance_id === instanceId) {
        setIsTyping(data.is_typing);
        setTypingUser(data.user_name || 'Alguém');
      }
    };

    // Subscribe aos eventos
    pubSubClient.subscribe('messages.new', handleNewMessage);
    pubSubClient.subscribe('messages.status', handleMessageStatus);
    pubSubClient.subscribe('typing.status', handleTypingStatus);

    return () => {
      pubSubClient.unsubscribe('messages.new', handleNewMessage);
      pubSubClient.unsubscribe('messages.status', handleMessageStatus);
      pubSubClient.unsubscribe('typing.status', handleTypingStatus);
    };
  }, [chatId, instanceId, pubSubClient, loadMessages, scrollToBottom]);

  /**
   * Auto-scroll ao adicionar novos messages
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /**
   * Detectar scroll para carregar mais
   */
  const handleScroll = (e) => {
    const element = e.target;
    const isNearTop = element.scrollTop < 100;

    if (isNearTop && hasMore && !isLoadingMore) {
      loadMoreMessages();
    }

    // Desativar auto-scroll se usuário scrollar para cima
    const isAtBottom = element.scrollHeight - element.clientHeight - element.scrollTop < 50;
    shouldAutoScrollRef.current = isAtBottom;
  };

  /**
   * Formatar timestamp
   */
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
  };

  /**
   * Renderizar status de mensagem
   */
  const renderStatus = (status) => {
    switch (status) {
      case 'sent':
        return <span className="status-badge sent" title="Enviado">✓</span>;
      case 'delivered':
        return <span className="status-badge delivered" title="Entregue">✓✓</span>;
      case 'read':
        return <span className="status-badge read" title="Lido">✓✓</span>;
      case 'failed':
        return <span className="status-badge failed" title="Falha">✕</span>;
      default:
        return <span className="status-badge pending" title="Pendente">⏱</span>;
    }
  };

  if (loading) {
    return (
      <div className="message-thread loading">
        <div className="message-loading">
          <Loader size={40} className="spinner" />
          <p>Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-thread">
      {/* Erro */}
      {error && (
        <div className="message-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button
            className="retry-btn"
            onClick={() => loadMessages()}
            title="Tentar novamente"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      )}

      {/* Container de mensagens */}
      <div
        ref={messagesContainerRef}
        className="message-list"
        onScroll={handleScroll}
      >
        {/* Indicador de carregamento no topo */}
        {isLoadingMore && (
          <div className="load-more-indicator">
            <Loader size={16} className="spinner" />
            <span>Carregando histórico...</span>
          </div>
        )}

        {/* Mensagens */}
        {messages.length === 0 ? (
          <div className="message-empty">
            <p>Nenhuma mensagem ainda</p>
            <p className="empty-hint">Comece uma conversa enviando uma mensagem</p>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message) => {
              const isOutbound = message.direction === 'outbound';
              return (
                <div
                  key={message.id}
                  className={`message-item ${isOutbound ? 'outbound' : 'inbound'}`}
                >
                  {/* Avatar */}
                  {!isOutbound && message.contact_name && (
                    <div className="message-avatar">
                      {message.contact_name[0]?.toUpperCase()}
                    </div>
                  )}

                  {/* Bolha de mensagem */}
                  <div className="message-bubble">
                    {message.contact_name && !isOutbound && (
                      <div className="message-name">{message.contact_name}</div>
                    )}
                    <div className="message-body">{message.body}</div>
                    <div className="message-meta">
                      <span className="message-time">{formatTime(message.created_at)}</span>
                      {isOutbound && renderStatus(message.status)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Indicador de digitação */}
        {isTyping && (
          <div className="message-item inbound">
            <div className="message-avatar">?</div>
            <div className="message-bubble typing">
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span className="typing-text">{typingUser} está digitando...</span>
            </div>
          </div>
        )}

        {/* Referência de scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* Badge de não lidas */}
      {unreadCount > 0 && !shouldAutoScrollRef.current && (
        <button
          className="unread-badge"
          onClick={scrollToBottom}
          title={`${unreadCount} mensagem(ns) nova(s)`}
        >
          <ChevronUp size={16} />
          <span>{unreadCount}</span>
        </button>
      )}
    </div>
  );
};

export default MessageThread;
