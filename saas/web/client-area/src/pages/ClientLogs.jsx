import { useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

export default function ClientLogs() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setSnapshot(await apiService.getWarmupState());
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, []);

  const logs = snapshot?.recentLogs || [];
  const audit = snapshot?.auditTrail || [];

  return (
    <div className="global-page">
      <header className="page-header">
        <div>
          <h1>Logs & <span>Auditoria</span></h1>
          <p>Central global para acompanhar eventos operacionais do cliente.</p>
        </div>
        <button className="btn-secondary" onClick={load}><RefreshCw size={18} /> Atualizar</button>
      </header>

      {error && <div className="alert error">{error}</div>}

      <section className="glass panel">
        <h2><History size={18} /> Eventos recentes</h2>
        {loading ? <p>Carregando logs...</p> : logs.length === 0 ? <p className="muted">Nenhum evento recente.</p> : (
          <div className="table-wrap"><table><thead><tr><th>Quando</th><th>Tipo</th><th>Status</th><th>Origem</th><th>Mensagem</th></tr></thead><tbody>{logs.map((log, idx) => (
            <tr key={`${log.timestamp}-${idx}`}><td>{dateLabel(log.timestamp)}</td><td>{log.type || '—'}</td><td><span className={`badge ${log.status || ''}`}>{log.status || 'info'}</span></td><td>{log.instanceName || log.originToken || 'Runtime'}</td><td>{log.message || log.details || '—'}</td></tr>
          ))}</tbody></table></div>
        )}
      </section>

      <section className="glass panel">
        <h2>Auditoria</h2>
        {audit.length === 0 ? <p className="muted">Nenhum registro de auditoria.</p> : (
          <div className="audit-list">{audit.map((item, idx) => <div key={`${item.timestamp}-${idx}`} className="audit-item"><strong>{item.action || item.type}</strong><span>{item.actor || 'Sistema'} · {dateLabel(item.timestamp)}</span><p>{item.details || '—'}</p></div>)}</div>
        )}
      </section>

      <style>{`
        .global-page { display:flex; flex-direction:column; gap:24px; }
        .page-header { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; }
        .page-header h1 span { color:var(--primary); }
        .page-header p, .muted { color:var(--text-muted); }
        .panel { padding:18px; border-radius:20px; }
        .panel h2 { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
        .table-wrap { overflow:auto; }
        table { width:100%; border-collapse:collapse; min-width:760px; }
        th, td { padding:12px; border-bottom:1px solid rgba(255,255,255,0.08); text-align:left; }
        th { color:var(--text-dim); font-size:.75rem; text-transform:uppercase; }
        .badge { padding:4px 9px; border-radius:999px; background:rgba(255,255,255,.08); color:white; font-size:.75rem; }
        .badge.success { background:rgba(0,255,122,.12); color:#78ffb5; }
        .badge.error { background:rgba(255,0,80,.12); color:#ff8aa8; }
        .audit-list { display:grid; gap:10px; }
        .audit-item { padding:12px; border:1px solid var(--border-glass); border-radius:14px; background:rgba(255,255,255,.04); }
        .audit-item span { display:block; color:var(--text-muted); font-size:.8rem; margin-top:4px; }
        .audit-item p { margin-top:8px; color:var(--text-dim); }
        .alert.error { padding:12px 14px; border-radius:12px; background:rgba(255,0,80,.12); color:#ff8aa8; }
        @media (max-width:768px) { .page-header { align-items:stretch; flex-direction:column; } }
      `}</style>
    </div>
  );
}
