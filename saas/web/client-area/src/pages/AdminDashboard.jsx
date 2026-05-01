import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Zap, MessageSquare, CreditCard, Plus, Search,
  MoreVertical, TrendingUp, ArrowUpRight, Shield, Settings,
  ChevronRight, X, CheckCircle2, Activity, Eye
} from 'lucide-react';

// Mock de clientes — será substituído por API real
const MOCK_CLIENTS = [
  { id: 'cliente-demo', name: 'Demo Corp', balance: 2450, instances: 3, status: 'active', sendsToday: 312, plan: 'Pro' },
  { id: 'murilo-rifas', name: 'Murilo Rifas', balance: 890, instances: 2, status: 'active', sendsToday: 145, plan: 'Starter' },
  { id: 'loja-fashion', name: 'Loja Fashion', balance: 50, instances: 1, status: 'warning', sendsToday: 22, plan: 'Starter' },
  { id: 'auto-pecas', name: 'Auto Peças SP', balance: 0, instances: 1, status: 'suspended', sendsToday: 0, plan: 'Pro' },
];

const STATUS_MAP = {
  active:    { label: 'Ativo',    color: '#00ff88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)' },
  warning:   { label: 'Baixo',    color: '#ffaa00', bg: 'rgba(255,170,0,0.1)',  border: 'rgba(255,170,0,0.3)' },
  suspended: { label: 'Suspenso', color: '#ff4466', bg: 'rgba(255,68,102,0.1)', border: 'rgba(255,68,102,0.3)' },
};

const AdminDashboard = ({ onLogout }) => {
  const [clients, setClients] = useState(MOCK_CLIENTS);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [creditModal, setCreditModal] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [activeView, setActiveView] = useState('overview'); // overview | clients

  const filtered = clients.filter(c =>
    c.id.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totals = {
    clients: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    credits: clients.reduce((a, c) => a + c.balance, 0),
    sends: clients.reduce((a, c) => a + c.sendsToday, 0),
    instances: clients.reduce((a, c) => a + c.instances, 0),
  };

  const handleAddCredits = () => {
    const val = Number(creditAmount);
    if (!val || val <= 0 || !creditModal) return;
    setClients(prev => prev.map(c =>
      c.id === creditModal.id ? { ...c, balance: c.balance + val, status: c.balance + val > 100 ? 'active' : c.status } : c
    ));
    setCreditModal(null);
    setCreditAmount('');
  };

  return (
    <div className="admin-root">
      {/* Sidebar Admin */}
      <aside className="admin-sidebar glass">
        <div className="admin-logo">
          <Shield size={28} className="neon-text-cyan" />
          <div>
            <span className="admin-logo-title">RUPTUR</span>
            <span className="admin-logo-sub">Admin Panel</span>
          </div>
        </div>

        <nav className="admin-nav">
          {[
            { key: 'overview', icon: <Activity size={18} />, label: 'Visão Geral' },
            { key: 'clients', icon: <Users size={18} />, label: 'Clientes' },
          ].map(item => (
            <button
              key={item.key}
              className={`admin-nav-btn ${activeView === item.key ? 'active' : ''}`}
              onClick={() => setActiveView(item.key)}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <button className="admin-logout-btn" onClick={onLogout}>Sair</button>
      </aside>

      {/* Conteúdo principal */}
      <main className="admin-main">
        <header className="admin-top-bar">
          <h1>{activeView === 'overview' ? 'Visão Geral' : 'Gestão de Clientes'}</h1>
          <div className="admin-badge"><Shield size={14} /> admin-demo</div>
        </header>

        {activeView === 'overview' ? (
          /* ===== OVERVIEW ===== */
          <div className="admin-content">
            <div className="stats-grid">
              {[
                { label: 'Clientes Ativos', value: totals.active, total: totals.clients, icon: <Users size={22} />, accent: '#00ff88' },
                { label: 'Créditos em Circulação', value: totals.credits.toLocaleString('pt-BR'), icon: <Zap size={22} />, accent: '#00f2ff' },
                { label: 'Envios Hoje', value: totals.sends.toLocaleString('pt-BR'), icon: <MessageSquare size={22} />, accent: '#a855f7' },
                { label: 'Instâncias Ativas', value: totals.instances, icon: <Activity size={22} />, accent: '#ff007a' },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card glass">
                  <div className="stat-icon" style={{ color: s.accent, background: `${s.accent}15`, border: `1px solid ${s.accent}30` }}>{s.icon}</div>
                  <div className="stat-info">
                    <span className="stat-label">{s.label}</span>
                    <span className="stat-value">{s.value}{s.total ? <span className="stat-total">/{s.total}</span> : ''}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            <section className="recent-section glass">
              <h3><Users size={18} /> Clientes Recentes</h3>
              <div className="client-mini-list">
                {clients.slice(0, 4).map(c => {
                  const st = STATUS_MAP[c.status];
                  return (
                    <div key={c.id} className="client-mini-row" onClick={() => { setActiveView('clients'); setSelected(c); }}>
                      <div className="client-avatar">{c.name[0]}</div>
                      <div className="client-mini-info">
                        <span className="client-mini-name">{c.name}</span>
                        <span className="client-mini-id">{c.id}</span>
                      </div>
                      <span className="status-dot" style={{ background: st.color }} title={st.label} />
                      <span className="client-mini-bal">{c.balance.toLocaleString('pt-BR')} cr</span>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
          /* ===== CLIENTS ===== */
          <div className="admin-content">
            <div className="clients-toolbar">
              <div className="search-box glass">
                <Search size={16} />
                <input placeholder="Buscar por nome ou ID..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="clients-table glass">
              <div className="table-header">
                <span>Cliente</span><span>Plano</span><span>Instâncias</span><span>Créditos</span><span>Envios Hoje</span><span>Status</span><span></span>
              </div>
              {filtered.map(c => {
                const st = STATUS_MAP[c.status];
                return (
                  <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="table-row">
                    <div className="cell-client">
                      <div className="client-avatar-sm">{c.name[0]}</div>
                      <div><div className="cell-name">{c.name}</div><div className="cell-id">{c.id}</div></div>
                    </div>
                    <span className="cell-plan">{c.plan}</span>
                    <span>{c.instances}</span>
                    <span className="cell-credits">{c.balance.toLocaleString('pt-BR')}</span>
                    <span>{c.sendsToday.toLocaleString('pt-BR')}</span>
                    <span className="cell-status" style={{ color: st.color, background: st.bg, borderColor: st.border }}>{st.label}</span>
                    <div className="cell-actions">
                      <button className="action-btn" title="Adicionar créditos" onClick={() => { setCreditModal(c); setCreditAmount(''); }}>
                        <Plus size={14} />
                      </button>
                      <button className="action-btn" title="Ver detalhes" onClick={() => setSelected(c)}>
                        <Eye size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
              {filtered.length === 0 && <div className="empty-table">Nenhum cliente encontrado</div>}
            </div>
          </div>
        )}
      </main>

      {/* Modal de créditos */}
      <AnimatePresence>
        {creditModal && (
          <motion.div className="wizard-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="credit-modal glass" initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}>
              <div className="cm-header">
                <h3>Lançar Créditos</h3>
                <button className="close-btn" onClick={() => setCreditModal(null)}><X size={16} /></button>
              </div>
              <p className="cm-sub">Para: <strong>{creditModal.name}</strong> ({creditModal.id})</p>
              <p className="cm-balance">Saldo atual: <strong>{creditModal.balance.toLocaleString('pt-BR')} créditos</strong></p>

              <div className="form-group">
                <label>Quantidade de créditos</label>
                <input type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="Ex: 1000" min="1" />
              </div>

              <div className="wizard-actions">
                <button className="btn-secondary" onClick={() => setCreditModal(null)}>Cancelar</button>
                <button className="btn-primary" onClick={handleAddCredits} disabled={!creditAmount}>
                  <Plus size={16} /> Confirmar Lançamento
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .admin-root { display: flex; height: 100vh; background: var(--bg-primary); color: white; font-family: 'Inter', sans-serif; }

        /* Sidebar */
        .admin-sidebar { width: 240px; padding: 24px 16px; display: flex; flex-direction: column; gap: 24px; border-right: 1px solid var(--border-glass); border-radius: 0; flex-shrink: 0; }
        .admin-logo { display: flex; align-items: center; gap: 12px; padding: 0 8px; }
        .admin-logo-title { font-size: 1.1rem; font-weight: 900; letter-spacing: 1px; display: block; }
        .admin-logo-sub { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; display: block; }
        .admin-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .admin-nav-btn { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; border: none; background: transparent; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: 0.15s; text-align: left; font-family: inherit; }
        .admin-nav-btn:hover { background: rgba(255,255,255,0.04); color: white; }
        .admin-nav-btn.active { background: rgba(0,242,255,0.08); color: var(--primary); border: 1px solid rgba(0,242,255,0.15); }
        .admin-logout-btn { padding: 10px; border-radius: 10px; border: 1px solid rgba(255,68,102,0.2); background: rgba(255,68,102,0.05); color: #ff6680; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: 0.15s; font-family: inherit; }
        .admin-logout-btn:hover { background: rgba(255,68,102,0.12); }

        /* Main */
        .admin-main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
        .admin-top-bar { padding: 20px 32px; border-bottom: 1px solid var(--border-glass); display: flex; justify-content: space-between; align-items: center; }
        .admin-top-bar h1 { font-size: 1.3rem; font-weight: 800; }
        .admin-badge { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 100px; background: rgba(0,242,255,0.08); border: 1px solid rgba(0,242,255,0.2); color: var(--primary); font-size: 0.75rem; font-weight: 700; }
        .admin-content { padding: 28px 32px; display: flex; flex-direction: column; gap: 24px; }

        /* Stats Grid */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .stat-card { padding: 22px; border-radius: 16px; display: flex; align-items: center; gap: 16px; }
        .stat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-info { display: flex; flex-direction: column; }
        .stat-label { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-value { font-size: 1.6rem; font-weight: 900; font-family: 'Outfit', sans-serif; line-height: 1.2; }
        .stat-total { font-size: 0.9rem; color: var(--text-muted); font-weight: 600; }

        /* Recent Section */
        .recent-section { padding: 24px; border-radius: 20px; }
        .recent-section h3 { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; font-weight: 700; margin-bottom: 16px; }
        .client-mini-list { display: flex; flex-direction: column; gap: 6px; }
        .client-mini-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; cursor: pointer; transition: 0.15s; border: 1px solid transparent; }
        .client-mini-row:hover { background: rgba(255,255,255,0.03); border-color: var(--border-glass); }
        .client-avatar, .client-avatar-sm { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; flex-shrink: 0; }
        .client-avatar-sm { width: 32px; height: 32px; font-size: 0.75rem; border-radius: 8px; }
        .client-mini-info { flex: 1; }
        .client-mini-name { font-weight: 700; font-size: 0.9rem; display: block; }
        .client-mini-id { font-size: 0.75rem; color: var(--text-muted); }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .client-mini-bal { font-size: 0.85rem; font-weight: 700; font-family: 'Outfit', monospace; color: var(--primary); }

        /* Clients Table */
        .clients-toolbar { display: flex; gap: 12px; }
        .search-box { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 12px; flex: 1; max-width: 400px; }
        .search-box input { background: transparent; border: none; outline: none; color: white; font-size: 0.85rem; flex: 1; font-family: inherit; }
        .search-box input::placeholder { color: var(--text-muted); }

        .clients-table { border-radius: 16px; overflow: hidden; }
        .table-header, .table-row { display: grid; grid-template-columns: 2fr 0.8fr 0.8fr 1fr 0.8fr 0.8fr 0.6fr; align-items: center; padding: 12px 20px; gap: 8px; }
        .table-header { background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border-glass); font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .table-row { border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.85rem; transition: 0.15s; }
        .table-row:hover { background: rgba(255,255,255,0.02); }
        .cell-client { display: flex; align-items: center; gap: 10px; }
        .cell-name { font-weight: 700; font-size: 0.88rem; }
        .cell-id { font-size: 0.72rem; color: var(--text-muted); }
        .cell-plan { font-weight: 600; color: var(--primary); font-size: 0.8rem; }
        .cell-credits { font-weight: 800; font-family: 'Outfit', monospace; }
        .cell-status { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 0.7rem; font-weight: 700; border: 1px solid; text-align: center; }
        .cell-actions { display: flex; gap: 6px; }
        .action-btn { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border-glass); background: transparent; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.15s; }
        .action-btn:hover { background: rgba(255,255,255,0.06); color: white; border-color: var(--primary); }
        .empty-table { padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.85rem; }

        /* Credit Modal */
        .credit-modal { width: 100%; max-width: 420px; padding: 32px; border-radius: 24px; background: rgba(10,10,20,0.97); border: 1px solid rgba(255,255,255,0.1); }
        .cm-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .cm-header h3 { font-size: 1.2rem; font-weight: 800; }
        .cm-sub { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px; }
        .cm-balance { font-size: 0.85rem; color: var(--primary); margin-bottom: 20px; }

        @media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 768px) { .admin-sidebar { display: none; } .table-header, .table-row { grid-template-columns: 1.5fr 1fr 1fr 0.6fr; } }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
