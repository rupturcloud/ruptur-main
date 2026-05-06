import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowDownLeft, History, CreditCard,
  TrendingUp, Zap, Search, Plus, X,
  ArrowRightLeft, Loader2, ShieldCheck
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import { formatError } from '../utils/errorHelper';

// Tipos de transação Ruptur (créditos, não dinheiro)
const TX_TYPES = ['ALL', 'credit', 'debit', 'campaign', 'refund'];
const TX_LABELS = { ALL: 'Todos', credit: 'Recargas', debit: 'Consumo', campaign: 'Campanhas', refund: 'Estornos' };

const TX_STYLE = {
  credit:   { bg: 'rgba(0,255,136,0.08)',  border: 'rgba(0,255,136,0.2)',  color: '#00ff88', icon: <ArrowDownLeft size={22} /> },
  debit:    { bg: 'rgba(255,0,122,0.08)',  border: 'rgba(255,0,122,0.2)',  color: '#ff007a', icon: <ArrowUpRight size={22} /> },
  campaign: { bg: 'rgba(112,0,255,0.1)',   border: 'rgba(112,0,255,0.25)', color: '#a855f7', icon: <ArrowRightLeft size={22} /> },
  refund:   { bg: 'rgba(0,242,255,0.08)',  border: 'rgba(0,242,255,0.2)',  color: '#00f2ff', icon: <TrendingUp size={22} /> },
};

const Wallet = () => {
  const { tenantId } = useAuth();
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [sendsToday, setSendsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [modal, setModal] = useState(null); // 'buy' | null
  const [packages, setPackages] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [buyLoading, setBuyLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stats, txs] = await Promise.allSettled([
        apiService.getDashboardStats(tenantId),
        apiService.getWalletHistory(tenantId),
      ]);

      if (stats.status === 'fulfilled' && stats.value) {
        setBalance(stats.value.walletBalance ?? 0);
        setSendsToday(stats.value.sendsToday ?? 0);
      }
      if (txs.status === 'fulfilled' && Array.isArray(txs.value)) {
        setHistory(txs.value);
      }
    } catch (err) {
      console.error('[Wallet] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadPackages = useCallback(async () => {
    try {
      const data = await apiService.getPackages();
      const pkgs = data.packages || data;
      // Normalizar para array
      if (typeof pkgs === 'object' && !Array.isArray(pkgs)) {
        setPackages(Object.entries(pkgs).map(([id, pkg]) => ({ id, ...pkg })));
      } else {
        setPackages(pkgs);
      }
    } catch (err) {
      console.error('[Wallet] Erro ao carregar pacotes:', err);
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    Promise.resolve().then(() => {
      loadData();
      loadPackages();
    });
  }, [tenantId, loadData, loadPackages]);

  const handleBuyCredits = useCallback(async () => {
    if (!selectedPkg) return;
    setBuyLoading(true);
    try {
      const result = await apiService.createCheckout(tenantId, selectedPkg);
      if (result.checkoutUrl || result.redirect_url) {
        window.location.href = result.checkoutUrl || result.redirect_url;
      } else {
        setModal(null);
        setSelectedPkg(null);
        setToast({ type: 'success', message: 'Créditos adicionados com sucesso!' });
        loadData();
      }
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'wallet') });
    } finally {
      setBuyLoading(false);
    }
  }, [loadData, selectedPkg, tenantId]);

  const filteredHistory = history.filter(tx =>
    activeTab === 'ALL' ? true : tx.type === activeTab
  );

  const totalVolume = history.reduce((acc, tx) => acc + (tx.amount || 0), 0);

  return (
    <div className="wallet-page">
      {/* Cabeçalho */}
      <header className="page-header">
        <div className="header-info">
          <h1>Minha <span>Carteira</span></h1>
          <p>Gerencie seus créditos e visualize o histórico de consumo.</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('buy')}>
          <Plus size={18} /> Adicionar Créditos
        </button>
      </header>

      {/* Cards de resumo */}
      <div className="wallet-summary-grid">
        {/* Card principal — saldo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="balance-card glass neon-border"
        >
          <div className="balance-glow" />
          <div className="balance-content">
            <p className="balance-label">Saldo Disponível</p>
            <div className="balance-value-row">
              <Zap size={36} className="neon-text-cyan" fill="currentColor" />
              <span className="balance-number">
                {loading ? '—' : (balance ?? 0).toLocaleString('pt-BR')}
              </span>
              <span className="balance-unit">créditos</span>
            </div>
            <div className="balance-badges">
              <span className="badge-pill green">
                <TrendingUp size={11} /> ATIVO
              </span>
              <span className="badge-pill ghost">
                <CreditCard size={11} /> Conta Verificada
              </span>
            </div>
          </div>
          <button className="btn-buy" onClick={() => setModal('buy')}>
            <CreditCard size={16} /> Comprar Créditos
          </button>
        </motion.div>

        {/* Card — volume e consumo */}
        <div className="wallet-side-cards">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="side-card glass"
          >
            <span className="side-card-label">Enviados Hoje</span>
            <span className="side-card-value">{loading ? '—' : sendsToday.toLocaleString('pt-BR')}</span>
            <span className="side-card-sub">mensagens</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="side-card glass purple"
          >
            <span className="side-card-label">Volume Total</span>
            <span className="side-card-value">{loading ? '—' : totalVolume.toLocaleString('pt-BR')}</span>
            <span className="side-card-sub">créditos movimentados</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="side-card glass accent"
          >
            <span className="side-card-label">Custo Estimado</span>
            <span className="side-card-value">R$ {((sendsToday || 0) * 0.05).toFixed(2)}</span>
            <span className="side-card-sub">hoje</span>
          </motion.div>
        </div>
      </div>

      {/* Extrato de transações */}
      <section className="transactions-section glass">
        <div className="tx-header">
          <div className="tx-title-row">
            <div className="tx-title-icon">
              <History size={20} />
            </div>
            <h3>Extrato de Operações</h3>
          </div>

          {/* Abas de filtro */}
          <div className="tx-tabs">
            {TX_TYPES.map(tab => (
              <button
                key={tab}
                className={`tx-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {TX_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="tx-list">
          {loading ? (
            <div className="loading-state">Carregando histórico...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="empty-state">
              <Search size={36} />
              <p>Nenhuma transação encontrada</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredHistory.map((tx) => {
                const style = TX_STYLE[tx.type] || TX_STYLE['debit'];
                const isPositive = tx.type === 'credit' || tx.type === 'refund';
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="tx-item"
                  >
                    <div className="tx-icon-wrap" style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.color }}>
                      {style.icon}
                    </div>
                    <div className="tx-details">
                      <span className="tx-desc">{tx.description || tx.reason || 'Transação'}</span>
                      <div className="tx-meta">
                        <span className="tx-date">{tx.date || tx.createdAt ? new Date(tx.date || tx.createdAt).toLocaleString('pt-BR') : '—'}</span>
                        <span className="tx-type-badge" style={{ color: style.color, borderColor: style.border }}>
                          {TX_LABELS[tx.type] || tx.type}
                        </span>
                      </div>
                    </div>
                    <div className="tx-amount" style={{ color: isPositive ? '#00ff88' : '#ff6fa8' }}>
                      {isPositive ? '+' : '-'}{(tx.amount || 0).toLocaleString('pt-BR')}
                      <span className="tx-amount-unit"> cr</span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* Modal de compra de créditos */}
      <AnimatePresence>
        {modal === 'buy' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="wizard-overlay"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              className="buy-modal glass"
            >
              <div className="buy-modal-header">
                <h3>Adicionar Créditos</h3>
                <button className="close-btn" onClick={() => setModal(null)}><X size={18} /></button>
              </div>

              <p className="buy-modal-sub">Escolha um pacote de créditos para recarga.</p>

              {/* Pacotes reais da API de billing */}
              <div className="credit-presets">
                {packages.length > 0 ? packages.map(pkg => (
                  <button
                    key={pkg.id}
                    className={`preset-btn ${selectedPkg === pkg.id ? 'active' : ''}`}
                    onClick={() => setSelectedPkg(pkg.id)}
                  >
                    <span className="preset-credits">{(pkg.credits || 0).toLocaleString('pt-BR')}</span>
                    <span className="preset-label">créditos</span>
                    <span className="preset-price">R$ {((pkg.price_cents || 0) / 100).toFixed(2).replace('.', ',')}</span>
                  </button>
                )) : (
                  <div className="loading-state" style={{ gridColumn: '1/-1' }}>Carregando pacotes...</div>
                )}
              </div>

              <div className="buy-info-box">
                <ShieldCheck size={18} style={{ color: '#00ff88', flexShrink: 0 }} />
                <p>
                  Compra segura pelo <strong>gateway ativo</strong>. Quando houver checkout externo configurado,
                  você será redirecionado; após confirmação, os créditos entram automaticamente.
                </p>
              </div>

              <div className="wizard-actions">
                <button className="btn-secondary" onClick={() => { setModal(null); setSelectedPkg(null); }}>Cancelar</button>
                <button className="btn-primary" onClick={handleBuyCredits} disabled={!selectedPkg || buyLoading}>
                  {buyLoading ? <Loader2 size={16} className="spin" /> : <><CreditCard size={16} /> Comprar</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <style>{`
        .wallet-page { display: flex; flex-direction: column; gap: 28px; }

        /* Summary Grid */
        .wallet-summary-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 20px;
        }

        /* Balance Card */
        .balance-card {
          padding: 40px;
          border-radius: var(--radius-xl);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, rgba(112,0,255,0.1) 0%, rgba(0,242,255,0.08) 100%);
          position: relative;
          overflow: hidden;
        }
        .balance-glow {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 20% 50%, rgba(0,242,255,0.06) 0%, transparent 60%);
          pointer-events: none;
        }
        .balance-content { position: relative; z-index: 1; }
        .balance-label {
          font-size: 0.7rem; font-weight: 700;
          color: var(--text-muted); text-transform: uppercase;
          letter-spacing: 2px; margin-bottom: 16px; display: block;
        }
        .balance-value-row { display: flex; align-items: center; gap: 14px; }
        .balance-number { font-size: 3.2rem; font-weight: 900; line-height: 1; font-family: 'Outfit', sans-serif; }
        .balance-unit { font-size: 1rem; color: var(--text-muted); align-self: flex-end; margin-bottom: 6px; }
        .balance-badges { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
        .badge-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 100px;
          font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .badge-pill.green { background: rgba(0,255,136,0.1); color: var(--success); border: 1px solid rgba(0,255,136,0.3); }
        .badge-pill.ghost { background: rgba(255,255,255,0.04); color: var(--text-muted); border: 1px solid var(--border-glass); }

        .btn-buy {
          position: relative; z-index: 1;
          display: flex; align-items: center; gap: 8px;
          background: white; color: #0a0a0b;
          border: none; padding: 14px 24px; border-radius: var(--radius-md);
          font-weight: 800; font-size: 0.85rem; cursor: pointer;
          transition: var(--transition); white-space: nowrap;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 8px 24px rgba(255,255,255,0.1);
        }
        .btn-buy:hover { background: var(--primary); color: white; transform: translateY(-2px); box-shadow: 0 12px 30px var(--primary-glow); }

        /* Side Cards */
        .wallet-side-cards { display: flex; flex-direction: column; gap: 14px; }
        .side-card {
          padding: 22px 24px; border-radius: var(--radius-lg);
          display: flex; flex-direction: column; gap: 4px;
          flex: 1;
        }
        .side-card.purple { border-color: rgba(112,0,255,0.2); background: rgba(112,0,255,0.05); }
        .side-card.accent { border-color: rgba(255,0,122,0.2); background: rgba(255,0,122,0.05); }
        .side-card-label { font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
        .side-card-value { font-size: 1.8rem; font-weight: 800; font-family: 'Outfit', sans-serif; line-height: 1.1; margin-top: 4px; }
        .side-card-sub { font-size: 0.75rem; color: var(--text-muted); }

        /* Transactions */
        .transactions-section { padding: 0; border-radius: var(--radius-xl); overflow: hidden; }
        .tx-header {
          padding: 24px 28px;
          border-bottom: 1px solid var(--border-glass);
          display: flex; justify-content: space-between; align-items: center;
          background: rgba(255,255,255,0.01);
          flex-wrap: wrap; gap: 16px;
        }
        .tx-title-row { display: flex; align-items: center; gap: 12px; }
        .tx-title-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(255,255,255,0.04); border: 1px solid var(--border-glass);
          display: flex; align-items: center; justify-content: center; color: var(--text-muted);
        }
        .tx-title-row h3 { font-size: 0.95rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }

        .tx-tabs {
          display: flex; gap: 4px;
          background: rgba(0,0,0,0.3); padding: 4px;
          border-radius: 12px; border: 1px solid var(--border-glass);
        }
        .tx-tab {
          padding: 6px 14px; border-radius: 8px;
          border: none; background: transparent;
          color: var(--text-muted); font-size: 0.75rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.5px;
          cursor: pointer; transition: 0.15s;
          font-family: 'Inter', sans-serif;
        }
        .tx-tab.active { background: rgba(255,255,255,0.08); color: white; }
        .tx-tab:hover:not(.active) { color: rgba(255,255,255,0.5); }

        .tx-list { padding: 12px 16px; max-height: 500px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }

        .tx-item {
          display: flex; align-items: center; gap: 16px;
          padding: 16px 18px; border-radius: 16px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          transition: 0.15s; cursor: default;
        }
        .tx-item:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
        .tx-icon-wrap { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .tx-details { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .tx-desc { font-weight: 700; font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tx-meta { display: flex; align-items: center; gap: 10px; }
        .tx-date { font-size: 0.75rem; color: var(--text-muted); }
        .tx-type-badge { font-size: 0.65rem; font-weight: 800; padding: 2px 8px; border-radius: 100px; border: 1px solid; text-transform: uppercase; }
        .tx-amount { font-size: 1.1rem; font-weight: 900; font-family: 'Outfit', monospace; white-space: nowrap; }
        .tx-amount-unit { font-size: 0.7rem; font-weight: 600; opacity: 0.6; }

        /* Buy Modal */
        .buy-modal {
          width: 100%; max-width: 480px;
          padding: 36px; border-radius: 28px;
          background: rgba(10,10,20,0.95);
          border: 1px solid rgba(255,255,255,0.12);
        }
        .buy-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .buy-modal-header h3 { font-size: 1.4rem; font-weight: 800; }
        .buy-modal-sub { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 24px; }
        .close-btn {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,255,255,0.05); border: none;
          color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: 0.15s;
        }
        .close-btn:hover { background: rgba(255,255,255,0.1); color: white; }

        .credit-presets { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .preset-btn {
          padding: 16px; border-radius: 14px;
          border: 1px solid var(--border-glass);
          background: rgba(255,255,255,0.03);
          color: white; cursor: pointer; transition: 0.15s;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          font-family: 'Inter', sans-serif;
        }
        .preset-btn:hover { border-color: var(--primary); background: rgba(0,242,255,0.05); }
        .preset-btn.active { border-color: var(--primary); background: rgba(0,242,255,0.1); }
        .preset-credits { font-size: 1.4rem; font-weight: 900; font-family: 'Outfit', sans-serif; }
        .preset-label { font-size: 0.7rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
        .preset-price { font-size: 0.85rem; font-weight: 700; color: var(--primary); margin-top: 4px; }

        .buy-info-box {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 16px; border-radius: 12px;
          background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.12);
          margin: 20px 0;
        }
        .buy-info-box p { font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; }
        .buy-info-box strong { color: #00ff88; }
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}

        @media (max-width: 900px) {
          .wallet-summary-grid { grid-template-columns: 1fr; }
          .wallet-side-cards { flex-direction: row; }
        }
      `}</style>
    </div>
  );
};

export default Wallet;
