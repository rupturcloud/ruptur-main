import { useEffect, useState } from 'react';
import { MessageSquareText, Plus, Save, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';

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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.getWarmupConfig();
      setConfig(data);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar a biblioteca de mensagens.');
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
    setError('');
    setNotice('');
    try {
      await apiService.syncWarmupConfig({
        settings: config?.settings || {},
        routines: config?.routines || [],
        messages,
      });
      setNotice('Biblioteca de mensagens salva.');
      await load();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar as mensagens.');
    } finally {
      setSaving(false);
    }
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

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <section className="glass panel">
        {loading ? <p>Carregando mensagens...</p> : messages.length === 0 ? (
          <div className="empty"><MessageSquareText size={36} /><strong>Nenhuma mensagem cadastrada</strong><span>Crie modelos para reaproveitar nas funcionalidades do cliente.</span></div>
        ) : (
          <div className="message-grid">
            {messages.map((message, index) => (
              <article key={message.id || index} className="message-card glass">
                <div className="message-card-head">
                  <input value={message.name || ''} onChange={(event) => updateMessage(index, { name: event.target.value })} placeholder="Nome" />
                  <button className="icon-btn danger" onClick={() => setMessages((current) => current.filter((_, idx) => idx !== index))}><Trash2 size={15} /></button>
                </div>
                <input value={message.category || ''} onChange={(event) => updateMessage(index, { category: event.target.value })} placeholder="Categoria" />
                <textarea rows="5" value={message.text || ''} onChange={(event) => updateMessage(index, { text: event.target.value })} placeholder="Texto da mensagem" />
              </article>
            ))}
          </div>
        )}
      </section>

      <style>{`
        .global-page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
        .page-header h1 span { color: var(--primary); }
        .page-header p { color: var(--text-muted); margin-top: 6px; }
        .header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .panel { padding: 18px; border-radius: 20px; }
        .message-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
        .message-card { padding: 14px; border-radius: 16px; display: grid; gap: 10px; }
        .message-card-head { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
        input, textarea { width: 100%; background: rgba(255,255,255,0.06); color: white; border: 1px solid var(--border-glass); border-radius: 10px; padding: 10px; }
        textarea { resize: vertical; }
        .empty { min-height: 220px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:10px; color:var(--text-muted); text-align:center; }
        .empty svg { color: var(--primary); }
        .empty strong { color:white; }
        .alert { padding: 12px 14px; border-radius: 12px; }
        .alert.error { background: rgba(255, 0, 80, 0.12); color: #ff8aa8; }
        .alert.success { background: rgba(0, 255, 122, 0.12); color: #78ffb5; }
        @media (max-width: 768px) { .page-header { align-items: stretch; flex-direction: column; } }
      `}</style>
    </div>
  );
}
