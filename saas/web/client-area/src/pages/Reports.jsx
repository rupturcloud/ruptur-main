import { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';

function Stat({ label, value, hint }) {
  return <div className="stat glass"><span>{label}</span><strong>{value}</strong>{hint ? <small>{hint}</small> : null}</div>;
}

export default function Reports() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try { setSnapshot(await apiService.getWarmupState()); }
    catch (err) { setError(err.message || 'Não foi possível carregar relatórios.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, []);

  const instances = useMemo(() => snapshot?.instanceStates || [], [snapshot]);
  const summary = snapshot?.summary || {};
  const health = useMemo(() => {
    if (!instances.length) return 0;
    return Math.round(instances.reduce((sum, item) => sum + Number(item.heatScore || 0), 0) / instances.length);
  }, [instances]);

  return (
    <div className="global-page">
      <header className="page-header"><div><h1>Relatórios <span>do Cliente</span></h1><p>Visão consolidada para operação, aquecimento e entregabilidade.</p></div><button className="btn-secondary" onClick={load}><RefreshCw size={18} /> Atualizar</button></header>
      {error && <div className="alert error">{error}</div>}
      {loading ? <section className="glass panel">Carregando relatórios...</section> : <>
        <section className="stats-grid">
          <Stat label="Instâncias" value={summary.totalInstances || 0} hint={`${summary.connected || 0} conectadas`} />
          <Stat label="Saúde média" value={`${health}%`} hint="baseada nas instâncias do tenant" />
          <Stat label="Enviadas hoje" value={summary.sentToday || 0} hint="aquecimento/runtime" />
          <Stat label="Elegíveis" value={summary.eligible || 0} hint="aptas para próximo ciclo" />
          <Stat label="Em fila" value={summary.queuedEntries || 0} hint="disparos pendentes" />
          <Stat label="Erros recentes" value={summary.recentErrors || 0} hint="janela operacional" />
        </section>
        <section className="glass panel"><h2><BarChart3 size={18} /> Próximas elegibilidades</h2>{instances.length === 0 ? <p className="muted">Nenhuma instância encontrada.</p> : <div className="table-wrap"><table><thead><tr><th>Instância</th><th>Etapa</th><th>Enviadas hoje</th><th>Próxima janela</th></tr></thead><tbody>{instances.map((item) => <tr key={item.instanceToken}><td>{item.instanceName || item.instanceToken}</td><td>{item.heatStage || '—'}</td><td>{item.sentToday || 0}</td><td>{item.nextEligibleAt ? new Date(item.nextEligibleAt).toLocaleString('pt-BR') : '—'}</td></tr>)}</tbody></table></div>}</section>
      </>}
      <style>{`
        .global-page { display:flex; flex-direction:column; gap:24px; }
        .page-header { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; }
        .page-header h1 span { color:var(--primary); }
        .page-header p, .muted { color:var(--text-muted); }
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; }
        .stat { padding:18px; border-radius:18px; display:flex; flex-direction:column; gap:6px; }
        .stat span, .stat small { color:var(--text-muted); }
        .stat strong { font-size:2rem; color:white; }
        .panel { padding:18px; border-radius:20px; }
        .panel h2 { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
        .table-wrap { overflow:auto; }
        table { width:100%; border-collapse:collapse; min-width:680px; }
        th,td { padding:12px; border-bottom:1px solid rgba(255,255,255,.08); text-align:left; }
        th { color:var(--text-dim); font-size:.75rem; text-transform:uppercase; }
        .alert.error { padding:12px 14px; border-radius:12px; background:rgba(255,0,80,.12); color:#ff8aa8; }
        @media (max-width:768px) { .page-header { align-items:stretch; flex-direction:column; } }
      `}</style>
    </div>
  );
}
