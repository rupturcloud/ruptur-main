import { useState, useEffect, useRef } from 'react';
import { Loader, AlertCircle, RefreshCw, MessageSquare, Settings, Search, Phone, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

/**
 * Inbox — Integração com Bubble
 *
 * Carrega o inbox omnichannel do Bubble (uazapigo-multiatendimento.bubbleapps.io)
 * dentro de Ruptur de forma transparente para o usuário.
 *
 * Fluxo:
 * 1. Usuário acessa /inbox
 * 2. Componente chama /api/bubble/token
 * 3. Ruptur gera token JWT válido por 1h
 * 4. Bubble iframe carrega com token
 * 5. Bubble valida token chamando /api/bubble/validate
 * 6. Usuário vê conversas WhatsApp filtradas por tenant_id
 *
 * Nova interface:
 * - Sidebar com lista de chats
 * - Preview de mensagens
 * - Badge de não-lidas
 * - Status de presença
 * - Search / filters
 */
const Inbox = () => {
  const { session, isAuthenticated, loading: authLoading, tenantId } = useAuth();
  const [bubbleUrl, setBubbleUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [chatsLoading, setChatsLoading] = useState(false);
  const realtimeRef = useRef(null);

  // Buscar token Bubble ao montar
  useEffect(() => {
    async function fetchBubbleToken() {
      // Aguardar auth estar pronto
      if (authLoading) {
        return;
      }

      if (!isAuthenticated || !session?.access_token) {
        setError('Usuário não autenticado');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Chamar endpoint que gera token para Bubble
        const response = await fetch('/api/bubble/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setBubbleUrl(data.bubble_url);
      } catch (err) {
        console.error('[Inbox] Erro ao buscar token Bubble:', err);
        setError(err.message || 'Erro ao carregar inbox');
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchBubbleToken();
    }
  }, [session, isAuthenticated, authLoading]);

  // Carregar chats do Supabase (se tabela existir)
  useEffect(() => {
    async function loadChats() {
      if (!isAuthenticated || !tenantId) return;

      try {
        setChatsLoading(true);

        // Tentar carregar chats da tabela uazapi_chats
        const { data, error: err } = await supabase
          .from('uazapi_chats')
          .select(`
            id,
            chat_id,
            contact_phone,
            last_message,
            last_message_timestamp,
            unread_count,
            status,
            created_at
          `)
          .eq('tenant_id', tenantId)
          .order('last_message_timestamp', { ascending: false })
          .limit(50);

        if (err && err.code !== 'PGRST116') {
          // Se tabela não existe, não é erro crítico
          console.warn('[Inbox] Tabela uazapi_chats não encontrada, mostrando Bubble apenas');
          return;
        }

        if (data) {
          setChats(data);
        }
      } catch (err) {
        console.warn('[Inbox] Erro ao carregar chats:', err.message);
        // Não é erro crítico - Bubble ainda carrega
      } finally {
        setChatsLoading(false);
      }
    }

    const timeoutId = setTimeout(loadChats, 500);
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, tenantId]);

  // Subscribe a mudanças em tempo real (chats)
  useEffect(() => {
    if (!isAuthenticated || !tenantId) return;

    try {
      realtimeRef.current = supabase
        .channel(`chats:${tenantId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'uazapi_chats',
          filter: `tenant_id=eq.${tenantId}`
        }, (payload) => {
          console.log('[Inbox] Mudança em tempo real:', payload);
          // Recarregar chats ao receber atualização
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setChats(prev => {
              const updated = [...prev];
              const idx = updated.findIndex(c => c.id === payload.new?.id);
              if (idx >= 0) {
                updated[idx] = payload.new;
              } else {
                updated.unshift(payload.new);
              }
              return updated.sort((a, b) =>
                new Date(b.last_message_timestamp) - new Date(a.last_message_timestamp)
              );
            });
          }
        })
        .subscribe();
    } catch (err) {
      console.warn('[Inbox] Erro ao setup realtime:', err.message);
    }

    return () => {
      if (realtimeRef.current) {
        realtimeRef.current.unsubscribe();
      }
    };
  }, [isAuthenticated, tenantId]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setBubbleUrl(null);
    window.location.reload();
  };

  const filteredChats = chats.filter(chat =>
    (chat.contact_phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (chat.last_message || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="inbox-container">
      {loading && (
        <div className="inbox-loading">
          <Loader size={40} className="spinner" />
          <p>Carregando Inbox Omnichannel...</p>
        </div>
      )}

      {error && !loading && (
        <div className="inbox-error">
          <AlertCircle size={40} />
          <h3>Erro ao carregar Inbox</h3>
          <p>{error}</p>
          <button className="btn-retry" onClick={handleRetry}>
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      )}

      {bubbleUrl && !error && (
        <div className="inbox-layout">
          {/* Sidebar com lista de chats */}
          <div className="inbox-sidebar">
            <div className="sidebar-header">
              <h2>Conversas</h2>
              <button className="btn-icon" title="Configurações">
                <Settings size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="sidebar-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Chat list */}
            <div className="sidebar-chats">
              {chatsLoading ? (
                <div className="chat-loading">
                  <Loader size={20} className="spinner-small" />
                </div>
              ) : filteredChats.length > 0 ? (
                filteredChats.map(chat => (
                  <div
                    key={chat.id}
                    className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                    onClick={() => setSelectedChat(chat)}
                  >
                    <div className="chat-avatar">
                      <Phone size={16} />
                    </div>
                    <div className="chat-content">
                      <div className="chat-header">
                        <span className="chat-name">{chat.contact_phone || 'Desconhecido'}</span>
                        {chat.unread_count > 0 && (
                          <span className="unread-badge">{chat.unread_count}</span>
                        )}
                      </div>
                      <p className="chat-preview">{chat.last_message || '(sem mensagens)'}</p>
                      {chat.last_message_timestamp && (
                        <div className="chat-time">
                          <Clock size={12} />
                          {new Date(chat.last_message_timestamp).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-chats">
                  <MessageSquare size={24} />
                  <p>Nenhuma conversa encontrada</p>
                </div>
              )}
            </div>
          </div>

          {/* Main chat area (Bubble iframe) */}
          <iframe
            src={bubbleUrl}
            className="bubble-iframe"
            title="Ruptur Inbox (Powered by Bubble)"
            allow="camera;microphone;clipboard-read;clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      )}

      <style>{`
        .inbox-container {
          width: 100%;
          height: calc(100vh - 130px);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 18, 0.3);
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-glass);
          overflow: hidden;
        }

        .inbox-loading,
        .inbox-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 40px;
          text-align: center;
        }

        .inbox-loading .spinner {
          animation: spin 2s linear infinite;
          color: var(--primary);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .inbox-loading p {
          color: var(--text-muted);
          font-size: 0.95rem;
        }

        .inbox-error {
          color: var(--accent);
        }

        .inbox-error h3 {
          font-size: 1.2rem;
          font-weight: 600;
          margin: 8px 0;
        }

        .inbox-error p {
          color: var(--text-muted);
          font-size: 0.9rem;
          max-width: 400px;
        }

        .btn-retry {
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 10px;
          border: 1px solid var(--primary);
          background: rgba(0, 242, 255, 0.1);
          color: var(--primary);
          cursor: pointer;
          font-weight: 600;
          transition: 0.2s;
        }

        .btn-retry:hover {
          background: rgba(0, 242, 255, 0.2);
        }

        /* Novo layout com sidebar */
        .inbox-layout {
          width: 100%;
          height: 100%;
          display: flex;
          gap: 1px;
          background: var(--border-glass);
        }

        .inbox-sidebar {
          width: 320px;
          height: 100%;
          background: rgba(10, 10, 18, 0.5);
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-glass);
          overflow: hidden;
        }

        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-glass);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-header h2 {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0;
          color: var(--text-primary);
        }

        .btn-icon {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .btn-icon:hover {
          color: var(--text-primary);
        }

        .sidebar-search {
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 242, 255, 0.05);
          border-bottom: 1px solid var(--border-glass);
        }

        .sidebar-search input {
          flex: 1;
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 0.9rem;
          outline: none;
        }

        .sidebar-search input::placeholder {
          color: var(--text-muted);
        }

        .sidebar-search svg {
          color: var(--text-muted);
        }

        .sidebar-chats {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .sidebar-chats::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar-chats::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-chats::-webkit-scrollbar-thumb {
          background: rgba(0, 242, 255, 0.3);
          border-radius: 3px;
        }

        .sidebar-chats::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 242, 255, 0.5);
        }

        .chat-item {
          padding: 12px 8px;
          border-bottom: 1px solid rgba(0, 242, 255, 0.1);
          cursor: pointer;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          transition: background 0.2s;
          position: relative;
        }

        .chat-item:hover {
          background: rgba(0, 242, 255, 0.1);
        }

        .chat-item.active {
          background: rgba(0, 242, 255, 0.15);
          border-left: 3px solid var(--primary);
          padding-left: 5px;
        }

        .chat-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(0, 242, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          flex-shrink: 0;
        }

        .chat-content {
          flex: 1;
          min-width: 0;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          gap: 8px;
        }

        .chat-name {
          font-weight: 500;
          color: var(--text-primary);
          font-size: 0.9rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .unread-badge {
          background: var(--accent);
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

        .chat-preview {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.85rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chat-time {
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--text-muted);
          font-size: 0.75rem;
        }

        .chat-loading,
        .no-chats {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px 20px;
          color: var(--text-muted);
          text-align: center;
        }

        .spinner-small {
          animation: spin 2s linear infinite;
          color: var(--primary);
        }

        .no-chats svg {
          opacity: 0.5;
          margin-bottom: 8px;
        }

        .bubble-iframe {
          flex: 1;
          border: none;
          border-radius: 0;
        }

        @media (max-width: 768px) {
          .inbox-layout {
            flex-direction: column;
          }

          .inbox-sidebar {
            width: 100%;
            height: 200px;
            border-right: none;
            border-bottom: 1px solid var(--border-glass);
          }

          .bubble-iframe {
            flex: 1;
          }
        }

        @media (max-width: 640px) {
          .inbox-container {
            height: calc(100vh - 100px);
          }

          .inbox-sidebar {
            height: 150px;
          }

          .sidebar-header h2 {
            font-size: 1rem;
          }

          .chat-item {
            padding: 10px 6px;
          }

          .chat-avatar {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>
    </div>
  );
};

export default Inbox;
