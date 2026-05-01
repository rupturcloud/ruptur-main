import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Check, ArrowRight, MessageSquare, Shield, Rocket, BarChart3, Users, PlayCircle } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Header Fixo */}
      <nav className="landing-nav glass">
        <div className="container">
          <div className="nav-logo">
            <Zap size={24} fill="currentColor" className="primary-icon" />
            <span>RUPTUR<strong>CLOUD</strong></span>
          </div>
          <div className="nav-actions">
            <Link to="/login" className="nav-link">Entrar</Link>
            <Link to="/signup" className="nav-btn">Começar Agora</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="orb hero-orb-1"></div>
        <div className="orb hero-orb-2"></div>
        
        <div className="container">
          <motion.div 
            className="hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="badge">🚀 Nova Era de Automação</span>
            <h1>Transforme seu WhatsApp em uma <span>Máquina de Vendas</span></h1>
            <p>A plataforma mais completa para automatizar envios, gerenciar campanhas e escalar seu atendimento sem bloqueios.</p>
            
            <div className="hero-btns">
              <Link to="/signup" className="btn-primary">
                Inicie agora mesmo <ArrowRight size={20} />
              </Link>
              <button className="btn-secondary">
                <PlayCircle size={20} /> Ver Demonstração
              </button>
            </div>

            <div className="hero-stats">
              <div className="stat">
                <strong>+10k</strong>
                <span>Mensagens/dia</span>
              </div>
              <div className="stat">
                <strong>99.9%</strong>
                <span>Uptime</span>
              </div>
              <div className="stat">
                <strong>0%</strong>
                <span>Risco de Ban</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Cards de Início Rápido (Pricing Section) */}
      <section className="pricing">
        <div className="container">
          <div className="section-header">
            <h2>Escolha seu plano e <span>decole</span></h2>
            <p>Comece grátis e escale conforme seu negócio cresce.</p>
          </div>

          <div className="plans-grid">
            {/* Plano Trial */}
            <motion.div className="plan-card glass" whileHover={{ y: -10 }}>
              <div className="plan-icon"><Zap size={32} /></div>
              <h3>Trial Grátis</h3>
              <div className="price">R$ 0<span>/mês</span></div>
              <ul className="features">
                <li><Check size={16} /> 50 créditos iniciais</li>
                <li><Check size={16} /> 1 instância WhatsApp</li>
                <li><Check size={16} /> Dashboard completa</li>
                <li><Check size={16} /> Suporte via Discord</li>
              </ul>
              <Link to="/signup" className="btn-outline">Experimentar Grátis</Link>
            </motion.div>

            {/* Plano Starter - Destaque */}
            <motion.div className="plan-card popular" whileHover={{ y: -10 }}>
              <div className="popular-label">Mais Recomendado</div>
              <div className="plan-icon"><Rocket size={32} /></div>
              <h3>Starter</h3>
              <div className="price">R$ 97<span>/mês</span></div>
              <ul className="features">
                <li><Check size={16} /> 2.000 créditos/mês</li>
                <li><Check size={16} /> 1 instância WhatsApp</li>
                <li><Check size={16} /> Campanhas agendadas</li>
                <li><Check size={16} /> Relatórios de entrega</li>
              </ul>
              <Link to="/signup" className="btn-primary">Começar agora</Link>
            </motion.div>

            {/* Plano Pro */}
            <motion.div className="plan-card glass" whileHover={{ y: -10 }}>
              <div className="plan-icon"><Shield size={32} /></div>
              <h3>Pro</h3>
              <div className="price">R$ 197<span>/mês</span></div>
              <ul className="features">
                <li><Check size={16} /> 5.000 créditos/mês</li>
                <li><Check size={16} /> 3 instâncias WhatsApp</li>
                <li><Check size={16} /> Multi-usuários</li>
                <li><Check size={16} /> Suporte Prioritário</li>
              </ul>
              <Link to="/signup" className="btn-outline">Assinar Pro</Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <Zap size={22} fill="currentColor" />
              <span>RUPTUR<strong>CLOUD</strong></span>
            </div>
            <p>&copy; 2024 Ruptur. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      <style>{`
        .landing-page {
          background: #06060e;
          color: #fff;
          min-height: 100vh;
          font-family: 'Inter', sans-serif;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Nav */
        .landing-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 80px;
          display: flex;
          align-items: center;
          z-index: 100;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .landing-nav .container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1.2rem;
          font-family: 'Outfit', sans-serif;
        }

        .nav-logo strong { color: #00f2ff; }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .nav-link {
          color: #a0a0b0;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s;
        }

        .nav-link:hover { color: #fff; }

        .nav-btn {
          background: linear-gradient(135deg, #7000ff, #00f2ff);
          color: #fff;
          padding: 10px 20px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.9rem;
          box-shadow: 0 4px 15px rgba(112,0,255,0.3);
        }

        /* Hero */
        .hero {
          padding: 180px 0 100px;
          position: relative;
          overflow: hidden;
          text-align: center;
        }

        .hero-content h1 {
          font-size: 4rem;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 24px;
          font-family: 'Outfit', sans-serif;
        }

        .hero-content h1 span {
          background: linear-gradient(135deg, #7000ff, #00f2ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-content p {
          font-size: 1.25rem;
          color: #a0a0b0;
          max-width: 700px;
          margin: 0 auto 48px;
          line-height: 1.6;
        }

        .hero-btns {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 80px;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #7000ff, #00f2ff);
          color: #fff;
          padding: 16px 32px;
          border-radius: 14px;
          text-decoration: none;
          font-weight: 700;
          font-size: 1.1rem;
          box-shadow: 0 10px 30px rgba(112,0,255,0.4);
          transition: transform 0.2s;
        }

        .btn-primary:hover { transform: translateY(-2px); }

        .btn-secondary {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          padding: 16px 32px;
          border-radius: 14px;
          font-weight: 600;
          font-size: 1.1rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-secondary:hover { background: rgba(255,255,255,0.1); }

        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 60px;
          padding-top: 40px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        .stat { display: flex; flex-direction: column; gap: 4px; }
        .stat strong { font-size: 1.5rem; color: #00f2ff; font-family: 'Outfit', sans-serif; }
        .stat span { font-size: 0.85rem; color: #a0a0b0; text-transform: uppercase; letter-spacing: 1px; }

        /* Pricing */
        .pricing { padding: 100px 0; }
        .section-header { text-align: center; margin-bottom: 60px; }
        .section-header h2 { font-size: 2.5rem; font-weight: 800; margin-bottom: 12px; }
        .section-header h2 span { color: #00f2ff; }
        .section-header p { color: #a0a0b0; font-size: 1.1rem; }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .plan-card {
          padding: 40px;
          border-radius: 24px;
          text-align: left;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .plan-card.glass {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
        }

        .plan-card.popular {
          background: rgba(112,0,255,0.1);
          border: 2px solid #7000ff;
          box-shadow: 0 20px 40px rgba(112,0,255,0.15);
        }

        .popular-label {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          background: #7000ff;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .plan-icon { color: #00f2ff; margin-bottom: 24px; }
        .plan-card h3 { font-size: 1.5rem; font-weight: 700; margin-bottom: 8px; }
        .price { font-size: 2.5rem; font-weight: 800; margin-bottom: 32px; font-family: 'Outfit', sans-serif; }
        .price span { font-size: 1rem; color: #a0a0b0; font-weight: 400; }

        .features {
          list-style: none;
          padding: 0;
          margin: 0 0 40px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex-grow: 1;
        }

        .features li {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #d0d0e0;
          font-size: 0.95rem;
        }

        .features li svg { color: #00ff88; }

        .btn-outline {
          text-align: center;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          text-decoration: none;
          font-weight: 600;
          transition: background 0.2s;
        }

        .btn-outline:hover { background: rgba(255,255,255,0.05); }

        /* Footer */
        .landing-footer {
          padding: 60px 0;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #a0a0b0;
        }

        .footer-content p { color: #505060; font-size: 0.85rem; }

        /* Orbs */
        .orb { position: absolute; border-radius: 50%; filter: blur(100px); z-index: -1; opacity: 0.2; }
        .hero-orb-1 { width: 500px; height: 500px; background: #7000ff; top: -100px; left: -100px; }
        .hero-orb-2 { width: 400px; height: 400px; background: #00f2ff; bottom: 0; right: -100px; }

        .glass { backdrop-filter: blur(20px); }

        @media (max-width: 992px) {
          .plans-grid { grid-template-columns: 1fr; max-width: 450px; margin: 0 auto; }
          .hero-content h1 { font-size: 2.8rem; }
          .hero-stats { flex-wrap: wrap; gap: 30px; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
