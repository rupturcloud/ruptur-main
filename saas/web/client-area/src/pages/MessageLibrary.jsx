import { useEffect, useState } from 'react';
import { MessageSquareText, Plus, Save, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatError } from '../utils/errorHelper';

function makeMessage() {
  return {
    id: `client-message-${Date.now()}`,
    name: 'Nova mensagem',
    category: 'Geral',
    text: 'Oi, tudo certo por aí?',
    createdAt: new Date().toISOString(),
  };
}

export default function MessageLibrary() {
  const [config, setConfig] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiService.getWarmupConfig();
      setConfig(data);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      setToast({
        type: 'error',
        message: formatError(err, 'warmup'),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, []);

  function updateMessage(index, patch) {
    setMessages((current) => current.map((message, idx) => idx === index ? { ...message, ...patch } : message));
  }

  async function save() {
    setSaving(true);
    try {
      await apiService.syncWarmupConfig({
        settings: config?.settings || {},
        routines: config?.routines || [],
        messages,
      });
      setToast({
        type: 'success',
        message: 'Biblioteca de mensagens salva com sucesso.',
      });
      await load();
    } catch (err) {
      setToast({
        type: 'error',
        message: formatError(err, 'warmup'),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteMessage(index) {
    setConfirmDelete(index);
  }

  function confirmDeleteMessage() {
    if (confirmDelete !== null) {
      setMessages((current) => current.filter((_, idx) => idx !== confirmDelete));
      setToast({
        type: 'info',
        message: 'Mensagem removida. Clique em Salvar para confirmar.',
      });
    }
    setConfirmDelete(null);
  }

  return (
    <div className="global-page">
      <header className="page-header">
        <div>
          <h1>Biblioteca de <span>Mensagens</span></h1>
          <p>Modelos reutilizáveis para aquecimento, campanhas e fluxos do cliente.</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setMessages((current) => [...current, makeMessage()])}><Plus size={18} /> Nova mensagem</button>
          <button className="btn-primary" onClick={save} disabled={saving}><Save size={18} /> {saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </header>

      <section className="glass panel">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Carregando mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div className="empty"><MessageSquareText size={36} /><strong>Nenhuma mensagem cadastrada</strong><span>Crie modelos para reaproveitar nas funcionalidades do cliente.</span></div>
        ) : (
          <div className="message-grid">
            {messages.map((message, index) => (
              <article key={message.id || index} className="message-card glass">
                <div className="message-card-head">
                  <input
                    value={message.name || ''}
                    onChange={(event) => updateMessage(index, { name: event.target.value })}
                    placeholder="Nome da mensagem"
                    maxLength={50}
                  />
                  <button
                    className="icon-btn danger"
                    title="Deletar mensagem"
                    onClick={() => handleDeleteMessage(index)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <input
                  value={message.category || ''}
                  onChange={(event) => updateMessage(index, { category: event.target.value })}
                  placeholder="Categoria (ex: Promoção, Suporte)"
                  maxLength={30}
                />
                <textarea
                  rows="5"
                  value={message.text || ''}
                  onChange={(event) => updateMessage(index, { text: event.target.value })}
                  placeholder="Texto da mensagem. Use {{name}} para personalizar."
                  maxLength={1000}
                />
                <div className="message-card-footer">
                  <span className="char-count">{(message.text || '').length} / 1000</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Deletar mensagem?"
        message="Essa ação não pode ser desfeita. A mensagem será removida do banco de dados."
        confirmLabel="Deletar"
        cancelLabel="Cancelar"
        isDangerous={true}
        onConfirm={confirmDeleteMessage}
        onCancel={() => setConfirmDelete(null)}
      />

      <style>{`
        .global-page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
        .page-header h1 span { color: var(--primary); }
        .page-header p { color: var(--text-muted); margin-top: 6px; }
        .header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .panel { padding: 18px; border-radius: 20px; }
        .message-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
        .message-card {
          padding: 16px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s;
        }
        .message-card:hover { border-color: rgba(0, 242, 255, 0.3); box-shadow: 0 0 20px rgba(0, 242, 255, 0.1); }
        .message-card-head { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; }
        .message-card-head input { min-height: 36px; }
        .message-card-footer { display: flex; justify-content: flex-end; font-size: 0.7rem; color: var(--text-muted); }
        input, textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px;
          font-family: inherit;
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        input:focus, textarea:focus { outline: none; border-color: rgba(0, 242, 255, 0.5); background: rgba(0, 242, 255, 0.05); }
        textarea { resize: vertical; font-family: 'Monaco', 'Courier New', monospace; }
        .empty {
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 10px;
          color: var(--text-muted);
          text-align: center;
        }
        .empty svg { color: var(--primary); filter: drop-shadow(0 0 12px var(--primary-glow)); }
        .empty strong { color: white; }
        @media (max-width: 768px) {
          .page-header { align-items: stretch; flex-direction: column; }
          .message-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
