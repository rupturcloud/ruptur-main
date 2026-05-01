import React, { useEffect } from 'react';
import { Wallet, Send, Users, AlertCircle, TrendingUp, Zap } from 'lucide-react';
import { apiService } from '../services/api';
import { useApi } from '../hooks/useApi';
import { motion } from 'framer-motion';

const DashboardHome = ({ tenantId }) => {
  const { data: stats, loading, request: fetchStats } = useApi(apiService.getDashboardStats);

  useEffect(() => {
    fetchStats(tenantId);
  }, [tenantId, fetchStats]);

  const cards = [
    { label: 'Saldo Wallet', value: stats?.walletBalance || 0, unit: 'créditos', icon: <Wallet size={24} />, color: '#00f2ff', suffix: ' credits' },
    { label: 'Envios Hoje', value: stats?.sendsToday || 0, unit: 'mensagens', icon: <Send size={24} />, color: '#7000ff' },
    { label: 'Instâncias', value: `${stats?.connectedInstances || 0}/${stats?.totalInstances || 0}`, unit: 'online', icon: <Zap size={24} />, color: '#00ff88' },
    { label: 'Fila de Espera', value: stats?.queueCount || 0, unit: 'pendentes', icon: <AlertCircle size={24} />, color: '#ffcc00' },
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
            <button className="neon-btn purple">Novo Disparo</button>
            <button className="neon-btn cyan">Conectar WhatsApp</button>
            <button className="neon-btn outline">Gerar Relatório</button>
          </div>
        </section>
      </div>

      <style jsx="true">{`
        .dashboard-home { display: flex; flex-direction: column; gap: 30px; }
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
