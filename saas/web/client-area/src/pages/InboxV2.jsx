import { useState, useEffect } from 'react';
import { Loader, AlertCircle, RefreshCw, MessageSquare, Settings, Search, Phone, Clock, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import MessageComposer from '../components/MessageComposer';
import MessageThread from '../components/MessageThread';
import { usePubSub } from '../hooks/usePubSub';

/**
 * InboxV2 — Novo sistema de mensageria nativo com Supabase + Pub/Sub
 *
 * Funcionalidades:
 * - Sidebar com lista de chats e busca
 * - Thread de mensagens com scroll infinito
 * - Composer com suporte a emoji e templates
 * - Notificações em tempo real via Pub/Sub
 * - Status visual de entrega
 * - Paginação de histórico
 */

const InboxV2 = () => {
  const { session, isAuthenticated, loading: authLoading, tenantId } = useAuth();
  const pubSub = usePubSub();

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatsLoading, setChatsLoading] = useState(false);

  // Carregar chats ao montar
  useEffect(() => {
    async function loadChats() {
      if (!isAuthenticated || !tenantId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .from('uazapi_chats')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (err) {
          if (err.code === 'PGRST116') {
            // Tabela não existe ainda - é ok
            console.warn('[InboxV2] Tabela uazapi_chats não existe ainda');
            setChats([]);
          } else {
            throw err;
          }
        } else {
          setChats(data || []);
        }
      } catch (err) {
        console.error('[InboxV2] Erro ao carregar chats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(loadChats, 300);
    return () => clearTimeout(timer);
  }, [isAuthenticated, tenantId]);

  // Subscribe a mudanças em tempo real
  useEffect(() => {
    if (!isAuthenticated || !tenantId) return;

    try {
      const subscription = supabase
        .channel(`chats:${tenantId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'uazapi_chats',
          filter: `tenant_id=eq.${tenantId}`
        }, (payload) => {
          console.log('[InboxV2] Realtime update:', payload);

          if (payload.eventType === 'INSERT') {
            setChats(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setChats(prev =>
              prev.map(chat => chat.id === payload.new.id ? payload.new : chat)
                .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
            );
          } else if (payload.eventType === 'DELETE') {
            setChats(prev => prev.filter(chat => chat.id !== payload.old.id));
          }
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    } catch (err) {
      console.warn('[InboxV2] Erro ao setup realtime:', err.message);
    }
  }, [isAuthenticated, tenantId]);

  const filteredChats = chats.filter(chat =>
    (chat.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (chat.phone_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (chat.last_message_body || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRetry = () => {
    setError(null);
    window.location.reload();
  };

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    // Marcar como lido
    supabase
      .from('uazapi_chats')
      .update({ unread_count: 0 })
      .eq('id', chat.id)
      .catch(err => console.warn('[InboxV2] Erro ao marcar como lido:', err.message));
  };

  const handleMessageSent = (message) => {
    console.log('[InboxV2] Mensagem enviada:', message);
    // Atualizar última mensagem do chat
    if (selectedChat) {
      setSelectedChat(prev => ({
        ...prev,
        last_message_body: message.body || 'Mensagem de mídia',
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    }
  };

  if (!isAuthenticated && !authLoading) {
    return (
      <div className="inbox-v2-error">
        <AlertCircle size={40} />
        <p>Por favor, autentique-se para acessar o inbox</p>
      </div>
    );
  }

  return (
    <div className="inbox-v2-container">
      {loading ? (
        <div className="loading-state">
          <Loader size={40} className="spinner" />
          <p>Carregando inbox...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <AlertCircle size={40} />
          <h3>Erro ao carregar</h3>
          <p>{error}</p>
          <button className="btn-retry" onClick={handleRetry}>
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="inbox-layout">
          {/* Sidebar com lista de chats */}
          <div className="chats-sidebar">
            <div className="sidebar-header">
              <h2>Conversas</h2>
              <button className="btn-icon" title="Configurações">
                <Settings size={18} />
              </button>
            </div>

            <div className="sidebar-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="chats-list">
              {chatsLoading ? (
                <div className="list-loading">
                  <Loader size={20} className="spinner" />
                </div>
              ) : filteredChats.length > 0 ? (
                filteredChats.map(chat => (
                  <div
                    key={chat.id}
                    className={`chat-list-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                    onClick={() => handleChatSelect(chat)}
                  >
                    <div className="chat-avatar">{(chat.contact_name || 'C')[0]?.toUpperCase()}</div>
                    <div className="chat-info">
                      <div className="chat-header-row">
                        <span className="chat-name">{chat.contact_name || chat.phone_number || 'Desconhecido'}</span>
                        {chat.unread_count > 0 && (
                          <span className="unread-badge">{chat.unread_count}</span>
                        )}
                      </div>
                      <p className="chat-last-msg">{chat.last_message_body || '(sem mensagens)'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <MessageSquare size={24} />
                  <p>Nenhuma conversa encontrada</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat principal */}
          <div className="chat-main">
            {!selectedChat ? (
              <div className="no-chat-selected">
                <MessageSquare size={48} />
                <h2>Selecione uma conversa</h2>
                <p>Escolha um chat da lista para começar</p>
              </div>
            ) : (
              <>
                {/* Header do chat */}
                <div className="chat-header">
                  <div className="chat-header-info">
                    <button className="btn-close" onClick={() => setSelectedChat(null)} title="Fechar chat">
                      <X size={20} />
                    </button>
                    <div className="header-text">
                      <h3>{selectedChat.contact_name || selectedChat.phone_number || 'Chat'}</h3>
                      {selectedChat.is_group && <span className="badge-group">Grupo</span>}
                    </div>
                  </div>
                  <button className="btn-icon" title="Informações">
                    <Phone size={18} />
                  </button>
                </div>

                {/* Thread de mensagens */}
                <MessageThread
                  chatId={selectedChat.chat_id}
                  instanceId={selectedChat.instance_id}
                  tenantId={tenantId}
                  pubSubClient={pubSub}
                  onNewMessage={(msg) => console.log('[InboxV2] Nova mensagem:', msg)}
                />

                {/* Composer */}
                <MessageComposer
                  chatId={selectedChat.chat_id}
                  instanceId={selectedChat.instance_id}
                  tenantId={tenantId}
                  onMessageSent={handleMessageSent}
                  placeholder="Escreva uma mensagem..."
                />
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .inbox-v2-container {
          width: 100%;
          height: calc(100vh - 130px);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 18, 0.3);
          border-radius: var(--radius-xl, 12px);
          border: 1px solid var(--border-glass, rgba(0, 242, 255, 0.1));
          overflow: hidden;
        }

        .loading-state,
        .error-state,
        .no-chat-selected {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 40px;
          text-align: center;
          color: rgba(255, 255, 255, 0.7);
        }

        .spinner {
          animation: spin 1s linear infinite;
          color: rgba(0, 242, 255, 0.8);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .btn-retry {
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 10px;
          border: 1px solid rgba(0, 242, 255, 0.5);
          background: rgba(0, 242, 255, 0.1);
          color: rgba(0, 242, 255, 0.8);
          cursor: pointer;
          font-weight: 600;
          transition: 0.2s;
        }

        .btn-retry:hover {
          background: rgba(0, 242, 255, 0.2);
        }

        /* Layout */
        .inbox-layout {
          width: 100%;
          height: 100%;
          display: flex;
          gap: 1px;
          background: var(--border-glass, rgba(0, 242, 255, 0.1));
        }

        /* Sidebar */
        .chats-sidebar {
          width: 300px;
          height: 100%;
          background: rgba(10, 10, 18, 0.5);
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-glass, rgba(0, 242, 255, 0.1));
          overflow: hidden;
        }

        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-glass, rgba(0, 242, 255, 0.1));
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-header h2 {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0;
          color: rgba(255, 255, 255, 0.9);
        }

        .sidebar-search {
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 242, 255, 0.05);
          border-bottom: 1px solid var(--border-glass, rgba(0, 242, 255, 0.1));
        }

        .sidebar-search input {
          flex: 1;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.9rem;
          outline: none;
        }

        .sidebar-search input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .sidebar-search svg {
          color: rgba(0, 242, 255, 0.5);
        }

        .chats-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .chats-list::-webkit-scrollbar {
          width: 6px;
        }

        .chats-list::-webkit-scrollbar-thumb {
          background: rgba(0, 242, 255, 0.3);
          border-radius: 3px;
        }

        .chat-list-item {
          padding: 12px;
          border-bottom: 1px solid rgba(0, 242, 255, 0.05);
          cursor: pointer;
          display: flex;
          gap: 12px;
          transition: background 0.2s;
        }

        .chat-list-item:hover {
          background: rgba(0, 242, 255, 0.1);
        }

        .chat-list-item.active {
          background: rgba(0, 242, 255, 0.15);
          border-left: 3px solid rgba(0, 242, 255, 0.8);
          padding-left: 9px;
        }

        .chat-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0, 242, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(0, 242, 255, 0.8);
          font-weight: 600;
          flex-shrink: 0;
        }

        .chat-info {
          flex: 1;
          min-width: 0;
        }

        .chat-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .chat-name {
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.9rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .unread-badge {
          background: rgba(255, 59, 48, 0.8);
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
          flex-shrink: 0;
        }

        .chat-last-msg {
          margin: 0;
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.85rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .empty-state,
        .list-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px 20px;
          color: rgba(255, 255, 255, 0.5);
          text-align: center;
          height: 100%;
        }

        .list-loading .spinner {
          animation: spin 1s linear infinite;
        }

        /* Chat principal */
        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #000;
        }

        .chat-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-glass, rgba(0, 242, 255, 0.1));
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(10, 10, 18, 0.5);
        }

        .chat-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-header-info h3 {
          margin: 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: 1rem;
        }

        .header-text {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .badge-group {
          font-size: 0.75rem;
          background: rgba(0, 242, 255, 0.2);
          color: rgba(0, 242, 255, 0.8);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .btn-icon {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .btn-icon:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .btn-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }

        .btn-close:hover {
          color: rgba(255, 255, 255, 0.9);
        }

        @media (max-width: 768px) {
          .inbox-layout {
            flex-direction: column;
          }

          .chats-sidebar {
            width: 100%;
            height: 250px;
            border-right: none;
            border-bottom: 1px solid var(--border-glass, rgba(0, 242, 255, 0.1));
          }

          .chat-main {
            flex: 1;
          }
        }

        @media (max-width: 640px) {
          .inbox-v2-container {
            height: calc(100vh - 100px);
          }

          .sidebar-header h2 {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default InboxV2;
