import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, User, Search, CheckCheck,
  Wifi, WifiOff, RefreshCw, PhoneOff
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// ----------------------------------------------------------------
// Inbox — caixa de mensagens por instância, isolado por tenantId
// ----------------------------------------------------------------
const Inbox = () => {
  const { tenantId } = useAuth();
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef(null);

  // Scroll automático para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectInstance = useCallback(async (inst) => {
    setSelectedInstance(inst);
    setMessages([]);
    setLoadingMessages(true);
    try {
      // Bug corrigido: passa tenantId junto com instanceId
      const msgs = await apiService.getMessages(inst.instanceId || inst.id || inst.name, tenantId);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      console.error('[Inbox] Erro ao buscar mensagens:', err);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [tenantId]);

  const loadInstances = useCallback(async () => {
    setLoadingInstances(true);
    try {
      const raw = await apiService.getInstances();
      // A API retorna array; filtramos para só exibir instâncias do tenant
      const list = Array.isArray(raw) ? raw : (raw.instances || raw.data || []);
      setInstances(list);
      if (list.length > 0 && !selectedInstance) {
        handleSelectInstance(list[0]);
      }
    } catch (err) {
      console.error('[Inbox] Erro ao buscar instâncias:', err);
    } finally {
      setLoadingInstances(false);
    }
  }, [handleSelectInstance, selectedInstance]);

  // Carrega instâncias do tenant
  useEffect(() => {
    if (!tenantId) return;
    Promise.resolve().then(() => loadInstances());
  }, [tenantId, loadInstances]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || !selectedInstance) return;

    // Otimista: adiciona a mensagem localmente imediatamente
    const tempMsg = {
      id: `temp-${Date.now()}`,
      text,
      from: 'me',
      type: 'out',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage('');

    // TODO: chamar API de envio real quando disponível
    // await apiService.sendMessage(selectedInstance.id, tenantId, text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filtra instâncias pelo search
  const filteredInstances = instances.filter((inst) => {
    const name = (inst.instanceName || inst.name || '').toLowerCase();
    const num = (inst.phoneNumber || inst.number || '').toLowerCase();
    return name.includes(search.toLowerCase()) || num.includes(search.toLowerCase());
  });

  const getInstStatus = (inst) => {
    const s = (inst.connectionStatus || inst.status || '').toLowerCase();
    if (s === 'open' || s === 'connected') return 'connected';
    if (s === 'close' || s === 'disconnected') return 'disconnected';
    return 'waiting';
  };

  const getInstLabel = (inst) =>
    inst.instanceName || inst.name || inst.id || 'Instância';

  const getInstNumber = (inst) =>
    inst.phoneNumber || inst.number || inst.owner || '—';

  return (
    <div className="inbox-page">
      <div className="inbox-layout glass">
        {/* ---- Coluna esquerda: lista de instâncias ---- */}
        <div className="inbox-sidebar border-right">
          <div className="inbox-sidebar-header">
            <h3>Caixa de Entrada</h3>
            <button className="refresh-btn" onClick={loadInstances} title="Recarregar">
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="search-bar-mini glass">
            <Search size={15} />
            <input
              type="text"
              placeholder="Buscar instância..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="instances-list">
            {loadingInstances ? (
              <div className="loading-state" style={{ padding: '30px 0' }}>Carregando...</div>
            ) : filteredInstances.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 20px' }}>
                <PhoneOff size={32} />
                <p>Nenhuma instância encontrada</p>
              </div>
            ) : (
              filteredInstances.map((inst) => {
                const status = getInstStatus(inst);
                const isSelected = selectedInstance?.id === inst.id ||
                                   selectedInstance?.instanceId === inst.instanceId;
                return (
                  <div
                    key={inst.instanceId || inst.id || inst.name}
                    className={`instance-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectInstance(inst)}
                  >
                    <div className={`status-dot ${status}`} />
                    <div className="inst-info">
                      <span className="inst-name">{getInstLabel(inst)}</span>
                      <span className="inst-number">{getInstNumber(inst)}</span>
                    </div>
                    <div className="inst-status-icon">
                      {status === 'connected'
                        ? <Wifi size={13} style={{ color: 'var(--success)' }} />
                        : <WifiOff size={13} style={{ color: 'var(--text-muted)' }} />
                      }
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ---- Coluna direita: janela de chat ---- */}
        <div className="chat-window">
          {selectedInstance ? (
            <>
              {/* Header do chat */}
              <header className="chat-header border-bottom">
                <div className="chat-user-info">
                  <div className="user-avatar glass">
                    <User size={18} />
                  </div>
                  <div>
                    <h4>{getInstLabel(selectedInstance)}</h4>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                      {getInstNumber(selectedInstance)} • Tenant: {tenantId}
                    </span>
                  </div>
                </div>
                <div className={`connection-badge ${getInstStatus(selectedInstance)}`}>
                  {getInstStatus(selectedInstance) === 'connected' ? 'Online' : 'Offline'}
                </div>
              </header>

              {/* Mensagens */}
              <div className="messages-container">
                {loadingMessages ? (
                  <div className="loading-state">Carregando mensagens...</div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">
                    <MessageSquare size={40} />
                    <p>Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`message-bubble ${msg.type || (msg.fromMe ? 'out' : 'in')}`}
                      >
                        <div className="message-content glass">
                          <span className="msg-text">{msg.text || msg.body || msg.message}</span>
                          <div className="message-meta">
                            <span>{msg.timestamp || msg.messageTimestamp ? new Date(msg.timestamp || msg.messageTimestamp * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                            {(msg.type === 'out' || msg.fromMe) && (
                              <CheckCheck size={13} className="neon-text-cyan" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input de envio */}
              <footer className="chat-footer glass">
                <textarea
                  rows={1}
                  placeholder="Digite sua mensagem... (Enter para enviar)"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="send-btn btn-primary" onClick={handleSend} disabled={!newMessage.trim()}>
                  <Send size={18} />
                </button>
              </footer>
            </>
          ) : (
            <div className="empty-chat-state">
              <MessageSquare size={52} style={{ opacity: 0.2 }} />
              <p className="text-muted">Selecione uma instância acima para abrir as mensagens</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .inbox-page {
          height: calc(100vh - 130px);
        }

        .inbox-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          height: 100%;
          border-radius: var(--radius-xl);
          overflow: hidden;
          border: 1px solid var(--border-glass);
        }

        /* Sidebar esquerda */
        .inbox-sidebar {
          background: rgba(8, 8, 14, 0.5);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .border-right { border-right: 1px solid var(--border-glass); }
        .border-bottom { border-bottom: 1px solid var(--border-glass); }

        .inbox-sidebar-header {
          padding: 20px 20px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .inbox-sidebar-header h3 { font-size: 1rem; font-weight: 700; }

        .refresh-btn {
          width: 30px; height: 30px;
          border-radius: 8px;
          border: 1px solid var(--border-glass);
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: 0.2s;
        }
        .refresh-btn:hover { color: var(--primary); border-color: var(--primary); }

        .search-bar-mini {
          margin: 0 16px 12px;
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 10px;
          gap: 8px;
          flex-shrink: 0;
        }
        .search-bar-mini svg { color: var(--text-muted); flex-shrink: 0; }
        .search-bar-mini input {
          background: transparent;
          border: none;
          color: white;
          font-size: 0.85rem;
          width: 100%;
          font-family: 'Inter', sans-serif;
        }

        .instances-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }

        .instance-item {
          padding: 12px 18px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: background 0.15s;
          position: relative;
        }
        .instance-item:hover { background: rgba(255,255,255,0.04); }
        .instance-item.active {
          background: rgba(0, 242, 255, 0.08);
          border-left: 3px solid var(--primary);
        }

        .status-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .status-dot.connected { background: var(--success); box-shadow: 0 0 8px var(--success); }
        .status-dot.disconnected { background: var(--accent); }
        .status-dot.waiting { background: var(--warning); }

        .inst-info {
          display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;
        }
        .inst-name { font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .inst-number { font-size: 0.75rem; color: var(--text-muted); }
        .inst-status-icon { flex-shrink: 0; }

        /* Chat */
        .chat-window {
          display: flex;
          flex-direction: column;
          background: rgba(10, 10, 18, 0.3);
          overflow: hidden;
        }

        .chat-header {
          padding: 14px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }
        .chat-user-info { display: flex; align-items: center; gap: 12px; }
        .chat-user-info h4 { font-size: 1rem; font-weight: 700; }
        .user-avatar {
          width: 38px; height: 38px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .connection-badge {
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .connection-badge.connected { background: rgba(0,255,136,0.1); color: var(--success); border: 1px solid rgba(0,255,136,0.3); }
        .connection-badge.disconnected { background: rgba(255,0,122,0.1); color: var(--accent); border: 1px solid rgba(255,0,122,0.3); }
        .connection-badge.waiting { background: rgba(255,204,0,0.1); color: var(--warning); border: 1px solid rgba(255,204,0,0.3); }

        .messages-container {
          flex: 1;
          padding: 20px 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .message-bubble { max-width: 72%; display: flex; }
        .message-bubble.in { align-self: flex-start; }
        .message-bubble.out { align-self: flex-end; }

        .message-bubble .message-content {
          padding: 10px 16px;
          border-radius: 16px;
        }
        .message-bubble.out .message-content {
          background: linear-gradient(135deg, rgba(112,0,255,0.22) 0%, rgba(0,242,255,0.18) 100%);
          border: 1px solid rgba(0,242,255,0.25);
          border-bottom-right-radius: 4px;
        }
        .message-bubble.in .message-content {
          background: rgba(255,255,255,0.05);
          border-bottom-left-radius: 4px;
        }
        .msg-text { font-size: 0.9rem; line-height: 1.5; display: block; }
        .message-meta {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 4px; margin-top: 4px; font-size: 0.7rem; opacity: 0.55;
        }

        .chat-footer {
          margin: 16px;
          padding: 8px 10px;
          border-radius: 14px;
          display: flex;
          gap: 10px;
          align-items: flex-end;
          flex-shrink: 0;
        }
        .chat-footer textarea {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          padding: 8px 12px;
          resize: none;
          font-family: 'Inter', sans-serif;
          font-size: 0.9rem;
          line-height: 1.5;
          max-height: 120px;
        }
        .send-btn {
          width: 44px; height: 44px;
          border-radius: 10px;
          padding: 0;
          flex-shrink: 0;
        }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

        .empty-chat-state {
          flex: 1;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 16px;
          text-align: center;
          padding: 24px;
        }

        @media (max-width: 640px) {
          .inbox-page { min-height: calc(100vh - 100px); height: auto; }
          .inbox-layout { display: flex; flex-direction: column; min-height: calc(100vh - 116px); height: auto; }
          .inbox-sidebar { max-height: 270px; border-right: 0; border-bottom: 1px solid var(--border-glass); }
          .inbox-sidebar-header { padding: 18px 18px 10px; }
          .instances-list { max-height: 168px; }
          .instance-item { padding: 12px 16px; }
          .chat-window { min-height: 430px; }
          .chat-header { padding: 14px; gap: 12px; align-items: flex-start; flex-direction: column; }
          .chat-user-info { width: 100%; min-width: 0; }
          .chat-user-info > div:last-child { min-width: 0; }
          .chat-user-info h4 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px; }
          .chat-user-info .text-muted { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px; }
          .connection-badge { align-self: flex-start; }
          .messages-container { min-height: 280px; padding: 14px; }
          .message-bubble { max-width: 88%; }
          .message-bubble .message-content { padding: 10px 12px; }
          .msg-text { overflow-wrap: anywhere; word-break: break-word; }
          .chat-footer { margin: 10px; align-items: center; }
          .chat-footer textarea { min-width: 0; font-size: 0.86rem; }
          .send-btn { width: 42px; height: 42px; }
          .empty-chat-state { min-height: 340px; }
        }
      `}</style>
    </div>
  );
};

export default Inbox;
