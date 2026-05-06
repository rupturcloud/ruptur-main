import { useEffect } from 'react';
import { Wallet, Send, TrendingUp, Zap, Sparkles, Check, Flame } from 'lucide-react';
import { apiService } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const DashboardHome = () => {
  const { tenantId } = useAuth();
  const navigate = useNavigate();
  const { data: stats, loading, request: fetchStats } = useApi(apiService.getDashboardStats);

  useEffect(() => {
    if (tenantId) fetchStats(tenantId);
  }, [tenantId, fetchStats]);

  const cards = [
    { label: 'Saldo Wallet', value: stats?.walletBalance || 0, unit: 'créditos', icon: <Wallet size={24} />, color: '#00f2ff', suffix: ' credits' },
    { label: 'Envios Hoje', value: stats?.sendsToday || 0, unit: 'mensagens', icon: <Send size={24} />, color: '#7000ff' },
    { label: 'Instâncias', value: `${stats?.connectedInstances || 0}/${stats?.totalInstances || 0}`, unit: 'online', icon: <Zap size={24} />, color: '#00ff88' },
    { label: 'Aquecimento', value: stats?.heatingNow || stats?.warmupHeatingNow || 0, unit: 'em ciclo', icon: <Flame size={24} />, color: '#ff7a00' },
  ];

  return (
    <div className="dashboard-home">
      <header className="page-header">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1>Bem-vindo ao <span>Ruptur Cloud</span></h1>
          <p>Acompanhe o desempenho das suas automações em tempo real.</p>
        </motion.div>
      </header>

      {/* Checklist de Início Rápido */}
      <section className="quick-start-checklist glass">
        <div className="checklist-header">
          <h3><Sparkles size={18} color="#00f2ff" /> Complete sua configuração</h3>
          <span className="badge-outline">2/4 concluídos</span>
        </div>
        <div className="checklist-grid">
          <div className="check-item done">
            <div className="check-circle"><Check size={14} /></div>
            <div className="check-text">
              <strong>Criar Conta</strong>
              <span>Sua conta está ativa e pronta.</span>
            </div>
          </div>
          <div className="check-item done">
            <div className="check-circle"><Check size={14} /></div>
            <div className="check-text">
              <strong>Escolher Plano</strong>
              <span>Você está no plano Trial (50 créditos).</span>
            </div>
          </div>
          <div className="check-item pending">
            <div className="check-circle">3</div>
            <div className="check-text">
              <strong>Conectar WhatsApp</strong>
              <span>Vincule uma instância para começar os envios.</span>
            </div>
            <button className="check-action" onClick={() => navigate('/instancias')}>Conectar</button>
          </div>
          <div className="check-item pending">
            <div className="check-circle">4</div>
            <div className="check-text">
              <strong>Ativar Aquecimento</strong>
              <span>Aqueça a conta antes dos primeiros disparos.</span>
            </div>
            <button className="check-action" onClick={() => navigate('/aquecimento')}>Aquecer</button>
          </div>
        </div>
      </section>

      <div className="stats-grid">
        {cards.map((stat, index) => (
          <motion.div 
            key={index} 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="stat-card glass neon-border"
          >
            <div className="stat-icon" style={{ background: `${stat.color}15`, color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-info">
              <span className="stat-label">{stat.label}</span>
              <div className="stat-value-group">
                <span className="stat-value">
                  {loading ? '...' : stat.value}
                </span>
                <span className="stat-unit">{stat.unit}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="dashboard-content">
        <section className="recent-activity glass">
          <div className="section-header">
            <h3><TrendingUp size={20} className="neon-text-purple" /> Atividade do Sistema</h3>
          </div>
          <div className="activity-list">
            <div className="activity-item border-bottom">
              <div className="dot pulse green"></div>
              <div className="details">
                <span className="title">Conexão Estabelecida</span>
                <span className="time">Há 5 minutos • Instância Suporte 01</span>
              </div>
            </div>
            <div className="activity-item border-bottom">
              <div className="dot pulse purple"></div>
              <div className="details">
                <span className="title">Disparo Concluído</span>
                <span className="time">Há 12 minutos • Campanha: Lançamento Verão</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="dot orange"></div>
              <div className="details">
                <span className="title">Créditos Adicionados</span>
                <span className="time">Há 2 horas • +R$ 500,00</span>
              </div>
            </div>
          </div>
        </section>

        <section className="quick-actions glass">
          <h3>Ações Rápidas</h3>
          <div className="actions-buttons">
            <button className="neon-btn purple" onClick={() => navigate('/campanhas')}>Novo Disparo</button>
            <button className="neon-btn cyan" onClick={() => navigate('/instancias')}>Conectar WhatsApp</button>
            <button className="neon-btn orange" onClick={() => navigate('/aquecimento')}>Aquecimento</button>
            <button className="neon-btn outline">Gerar Relatório</button>
          </div>
        </section>
      </div>

      <style jsx="true">{`
        .dashboard-home { display: flex; flex-direction: column; gap: 30px; }
        
        .quick-start-checklist { padding: 30px; border-radius: 24px; background: rgba(0,242,255,0.02); border: 1px solid rgba(0,242,255,0.1); }
        .checklist-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .checklist-header h3 { display: flex; align-items: center; gap: 10px; font-size: 1.1rem; }
        .badge-outline { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem; color: var(--text-muted); }
        
        .checklist-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
        .check-item { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); position: relative; }
        .check-item.done { opacity: 0.7; }
        .check-circle { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem; font-weight: 700; color: var(--text-muted); }
        .check-item.done .check-circle { background: #00ff88; border-color: #00ff88; color: #000; }
        .check-item.pending .check-circle { border-color: #00f2ff; color: #00f2ff; box-shadow: 0 0 10px rgba(0,242,255,0.2); }
        
        .check-text { display: flex; flex-direction: column; gap: 2px; flex-grow: 1; }
        .check-text strong { font-size: 0.95rem; }
        .check-text span { font-size: 0.75rem; color: var(--text-muted); }
        
        .check-action { padding: 6px 14px; border-radius: 8px; background: #00f2ff; border: none; color: #000; font-weight: 700; font-size: 0.75rem; cursor: pointer; transition: 0.2s; }
        .check-action:hover { transform: scale(1.05); }

        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
        
        .stat-card { padding: 24px; border-radius: 20px; display: flex; align-items: center; gap: 20px; transition: 0.3s; }
        .stat-card:hover { transform: translateY(-5px); background: rgba(255, 255, 255, 0.05); }
        .stat-icon { width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        .stat-info { display: flex; flex-direction: column; }
        .stat-label { font-size: 0.8rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
        .stat-value { font-size: 2rem; font-weight: 800; font-family: 'Outfit', sans-serif; }
        .stat-unit { font-size: 0.85rem; color: var(--text-muted); margin-left: 8px; }

        .dashboard-content { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; }
        .recent-activity, .quick-actions { padding: 30px; border-radius: 24px; }
        
        .section-header { margin-bottom: 25px; }
        .activity-list { display: flex; flex-direction: column; }
        .activity-item { padding: 15px 0; display: flex; align-items: flex-start; gap: 15px; }
        .border-bottom { border-bottom: 1px solid rgba(255,255,255,0.05); }

        .dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; }
        .dot.green { background: #00ff88; box-shadow: 0 0 10px #00ff88; }
        .dot.purple { background: #7000ff; box-shadow: 0 0 10px #7000ff; }
        .dot.orange { background: #ffaa00; }
        
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }

        .activity-item .title { display: block; font-weight: 600; font-size: 0.95rem; }
        .activity-item .time { font-size: 0.8rem; color: var(--text-muted); }

        .actions-buttons { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
      `}</style>
    </div>
  );
};

export default DashboardHome;
