import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Check, ArrowRight, Shield, 
  Rocket, Users, Star, 
  ChevronDown, Smartphone, Globe, Building2
} from 'lucide-react';

const APP_URL = 'https://app.ruptur.cloud';

const LandingPage = () => {
  const [openFaq, setOpenFaq] = useState(null);

  const faqData = [
    {
      id: 1,
      question: "Como funciona o sistema de créditos?",
      answer: "Cada mensagem enviada consome 1 crédito. Você ganha 50 créditos grátis ao criar sua conta para testar todas as funcionalidades."
    },
    {
      id: 2,
      question: "Existe risco de banimento?",
      answer: "Nosso sistema utiliza tecnologias exclusivas de humanização e delays inteligentes para reduzir drasticamente os riscos, seguindo as melhores práticas recomendadas."
    },
    {
      id: 3,
      question: "Preciso deixar o PC ligado?",
      answer: "Não! O Ruptur Cloud funciona 100% na nuvem. Suas campanhas rodam mesmo se você estiver offline ou com o computador desligado."
    },
    {
      id: 4,
      question: "Posso cancelar a qualquer momento?",
      answer: "Sim, não temos fidelidade. Você pode cancelar ou alterar seu plano quando desejar através do seu painel administrativo."
    }
  ];

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div className="landing-page">
      {/* Background Decor */}
      <div className="orb hero-orb-1"></div>
      <div className="orb hero-orb-2"></div>
      <div className="orb hero-orb-3"></div>

      <nav className="landing-nav glass">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="nav-logo">
            <Zap size={24} fill="var(--primary)" color="var(--primary)" className="primary-icon" />
            <span>RUPTUR<strong>CLOUD</strong></span>
          </div>
          <div className="nav-links-desktop">
            <a href="#features">Recursos</a>
            <a href="#pricing">Planos</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="nav-actions">
            <a href={`${APP_URL}/login`} className="nav-link-premium">
              <span>Entrar</span>
            </a>
            <a href={`${APP_URL}/signup`} className="nav-btn-signup-premium">
              Começar Agora Grátis <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <motion.div 
              className="hero-content"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <motion.span 
                className="badge"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                ✨ IA-Powered WhatsApp Automation
              </motion.span>
              <h1>Transforme seu WhatsApp em uma <span>Máquina de Vendas</span></h1>
              <p>A plataforma mais completa para automatizar envios, gerenciar campanhas e escalar seu atendimento com inteligência artificial e zero bloqueios.</p>
              
              <div className="hero-btns">
                <a href={`${APP_URL}/signup`} className="btn-primary-lg">
                  Iniciar Teste Grátis <ArrowRight size={20} />
                </a>
                <a href={`${APP_URL}/login`} className="btn-secondary-lg">
                  Acessar Minha Conta <ArrowRight size={20} />
                </a>
              </div>

              <div className="hero-trust">
                <div className="trust-item">
                  <div className="stars">
                    <Star size={14} fill="var(--warning)" color="var(--warning)" /> 
                    <Star size={14} fill="var(--warning)" color="var(--warning)" /> 
                    <Star size={14} fill="var(--warning)" color="var(--warning)" /> 
                    <Star size={14} fill="var(--warning)" color="var(--warning)" /> 
                    <Star size={14} fill="var(--warning)" color="var(--warning)" />
                  </div>
                  <span>Aprovado por +500 empresas</span>
                </div>
              </div>
            </motion.div>

            <motion.div 
              className="hero-image"
              initial={{ opacity: 0, scale: 0.9, rotateY: 20 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
              style={{ perspective: "1000px" }}
            >
              <motion.div 
                className="image-wrap glass-premium"
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="preview-header">
                  <div className="dots"><span></span><span></span><span></span></div>
                  <div className="url-bar">saas.ruptur.cloud</div>
                </div>
                <div className="preview-content">
                  <div className="sidebar-mock"></div>
                  <div className="main-mock">
                    <div className="stat-row">
                      <div className="stat-card-mock"></div>
                      <div className="stat-card-mock"></div>
                      <div className="stat-card-mock"></div>
                    </div>
                    <div className="chart-mock"></div>
                  </div>
                </div>
                <motion.div 
                  className="floating-badge badge-1 glass"
                  animate={{ x: [0, 10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Zap size={18} color="var(--primary)" />
                  <span>99.9% Entrega</span>
                </motion.div>
                <motion.div 
                  className="floating-badge badge-2 glass"
                  animate={{ x: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                  <Smartphone size={18} color="var(--secondary)" />
                  <span>Multichannel</span>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Quick Action Cards */}
      <section className="quick-actions" id="features">
        <div className="container">
          <motion.div 
            className="quick-grid"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.div className="action-card glass" variants={itemVariants} whileHover={{ y: -8, backgroundColor: "rgba(255,255,255,0.05)" }}>
              <div className="icon-wrap cyan"><Users size={24} /></div>
              <h3>Para Afiliados</h3>
              <p>Escala seus lançamentos e automatiza o funil de vendas via WhatsApp.</p>
              <a href={`${APP_URL}/signup`}>Criar conta agora <ArrowRight size={16} /></a>
            </motion.div>
            <motion.div className="action-card glass" variants={itemVariants} whileHover={{ y: -8, backgroundColor: "rgba(255,255,255,0.05)" }}>
              <div className="icon-wrap purple"><Building2 size={24} /></div>
              <h3>Para Empresas</h3>
              <p>Centralize seu atendimento e recupere carrinhos abandonados no automático.</p>
              <a href={`${APP_URL}/signup`}>Iniciar configuração <ArrowRight size={16} /></a>
            </motion.div>
            <motion.div className="action-card glass" variants={itemVariants} whileHover={{ y: -8, backgroundColor: "rgba(255,255,255,0.05)" }}>
              <div className="icon-wrap pink"><Rocket size={24} /></div>
              <h3>Para Agências</h3>
              <p>Gerencie múltiplos clientes com instâncias separadas e relatórios avançados.</p>
              <a href={`${APP_URL}/signup`}>Ver planos agência <ArrowRight size={16} /></a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="how-it-works">
        <div className="container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="section-badge">Simples & Rápido</span>
            <h2>Comece em <span>3 passos</span></h2>
          </motion.div>

          <motion.div 
            className="steps-grid"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div className="step-card glass" variants={itemVariants}>
              <div className="step-num">01</div>
              <div className="step-icon"><Users size={32} /></div>
              <h3>Crie sua conta</h3>
              <p>Cadastre seu negócio em segundos e ganhe 50 créditos iniciais.</p>
            </motion.div>
            <motion.div className="step-card glass" variants={itemVariants}>
              <div className="step-num">02</div>
              <div className="step-icon"><Smartphone size={32} /></div>
              <h3>Conecte o WhatsApp</h3>
              <p>Escaneie o QR Code e vincule seu número com total segurança.</p>
            </motion.div>
            <motion.div className="step-card glass" variants={itemVariants}>
              <div className="step-num">03</div>
              <div className="step-icon"><Rocket size={32} /></div>
              <h3>Lance sua Campanha</h3>
              <p>Importe contatos, crie mensagens e veja as vendas acontecerem.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Planos (Pricing) */}
      <section className="pricing" id="pricing">
        <div className="container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="section-badge">Planos Flexíveis</span>
            <h2>O combustível para o seu <span>crescimento</span></h2>
            <p>Escolha o plano ideal para o momento atual da sua empresa.</p>
          </motion.div>

          <motion.div 
            className="plans-grid"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {/* Plano Trial */}
            <motion.div className="plan-card glass" variants={itemVariants} whileHover={{ y: -10 }}>
              <div className="plan-icon"><Zap size={32} /></div>
              <h3>Trial Grátis</h3>
              <div className="price">R$ 0<span>/mês</span></div>
              <ul className="features">
                <li><Check size={16} /> 50 créditos iniciais</li>
                <li><Check size={16} /> 1 instância WhatsApp</li>
                <li><Check size={16} /> Dashboard completa</li>
                <li><Check size={16} /> Suporte via Discord</li>
              </ul>
              <a href={`${APP_URL}/signup`} className="btn-outline-plan">Experimentar Agora</a>
            </motion.div>

            {/* Plano Starter - Destaque */}
            <motion.div className="plan-card popular" variants={itemVariants} whileHover={{ y: -10, scale: 1.02 }}>
              <div className="popular-label">Mais Recomendado</div>
              <div className="plan-icon"><Rocket size={32} /></div>
              <h3>Starter</h3>
              <div className="price">R$ 97<span>/mês</span></div>
              <ul className="features">
                <li><Check size={16} /> 2.000 créditos/mês</li>
                <li><Check size={16} /> 1 instância WhatsApp</li>
                <li><Check size={16} /> Campanhas agendadas</li>
                <li><Check size={16} /> Relatórios de entrega</li>
                <li><Check size={16} /> Multi-agentes (Inbox)</li>
              </ul>
              <a href={`${APP_URL}/signup`} className="btn-primary-plan">Assinar Starter</a>
            </motion.div>

            {/* Plano Pro */}
            <motion.div className="plan-card glass" variants={itemVariants} whileHover={{ y: -10 }}>
              <div className="plan-icon"><Shield size={32} /></div>
              <h3>Pro</h3>
              <div className="price">R$ 197<span>/mês</span></div>
              <ul className="features">
                <li><Check size={16} /> 5.000 créditos/mês</li>
                <li><Check size={16} /> 3 instâncias WhatsApp</li>
                <li><Check size={16} /> Multi-usuários</li>
                <li><Check size={16} /> Webhooks & API</li>
                <li><Check size={16} /> Suporte Prioritário</li>
              </ul>
              <a href={`${APP_URL}/signup`} className="btn-outline-plan">Assinar Pro</a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq" id="faq">
        <div className="container">
          <motion.div 
            className="section-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="section-badge">FAQ</span>
            <h2>Perguntas <span>Frequentes</span></h2>
          </motion.div>
          <div className="faq-grid">
            {faqData.map((item, idx) => (
              <motion.div 
                key={item.id} 
                className={`faq-item glass ${openFaq === item.id ? 'active' : ''}`}
                onClick={() => toggleFaq(item.id)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <button className="faq-question">
                  <h3>{item.question}</h3>
                  <ChevronDown className="faq-icon" size={20} />
                </button>
                <AnimatePresence>
                  {openFaq === item.id && (
                    <motion.div 
                      className="faq-answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <p>{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand">
              <Zap size={28} fill="var(--primary)" color="var(--primary)" />
              <span>RUPTUR<strong>CLOUD</strong></span>
            </div>
            <div className="footer-links">
              <a href={`${APP_URL}/login`}>Login</a>
              <a href={`${APP_URL}/signup`}>Cadastro</a>
              <a href="#pricing">Planos</a>
              <a href="#">Termos</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 Ruptur. Todos os direitos reservados. Feito com 💜 para escaladores.</p>
            <div className="socials">
              < Globe size={18} />
              < Smartphone size={18} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
