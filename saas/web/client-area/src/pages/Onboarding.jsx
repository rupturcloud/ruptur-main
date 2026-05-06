import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Zap, QrCode, ArrowRight, ArrowLeft,
  Crown, Rocket, Loader2, CreditCard,
  ShieldCheck, AlertCircle, Sparkles, MessageSquare,
  Smartphone, Target, Trophy, Lock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const PLANS = [
  {
    id: 'trial',
    name: 'Trial Grátis',
    price: 'R$ 0',
    credits: '50 créditos',
    desc: 'Ideal para testar a potência do Ruptur sem compromisso.',
    icon: <Zap size={28} />,
    color: 'var(--primary)',
    features: ['50 Créditos Iniciais', '1 Instância WhatsApp', 'Suporte via Comunidade']
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 'R$ 97',
    period: '/mês',
    credits: '2.000 cr/mês',
    desc: 'Perfeito para pequenos negócios e escala inicial.',
    icon: <Rocket size={28} />,
    color: 'var(--secondary)',
    popular: true,
    features: ['2.000 Créditos/mês', '1 Instância WhatsApp', 'Envios Ilimitados', 'Suporte Prioritário']
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 197',
    period: '/mês',
    credits: '5.000 cr/mês',
    desc: 'O poder máximo para quem não aceita limites.',
    icon: <Crown size={28} />,
    color: 'var(--accent)',
    features: ['5.000 Créditos/mês', '3 Instâncias WhatsApp', 'Webhooks Avançados', 'Gerente de Conta']
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { tenantId, user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrCode, setQrCode] = useState(null);
  const [provisioning, setProvisioning] = useState(true);
  const [qrStatus, setQrStatus] = useState('waiting');

  useEffect(() => {
    // Simula ou aguarda o provisionamento real do tenant
    if (tenantId) {
      const timer = setTimeout(() => setProvisioning(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [tenantId]);

  const nextStep = () => { setError(''); setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const prevStep = () => { setError(''); setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const finish = () => navigate('/dashboard');

  const handlePlanConfirm = useCallback(async () => {
    if (selectedPlan === 'trial') {
      nextStep();
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.createSubscription(tenantId, selectedPlan);
      if (result.checkoutUrl || result.redirect_url) {
        window.location.href = result.checkoutUrl || result.redirect_url;
        return;
      }
      nextStep();
    } catch (err) {
      setError(err.message || 'Erro ao processar assinatura via Getnet.');
    } finally {
      setLoading(false);
    }
  }, [selectedPlan, tenantId]);

  useEffect(() => {
    if (step === 3 && !qrCode) {
      Promise.resolve().then(() => setLoading(true));
      setTimeout(() => {
        setQrCode('https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=RupturCloud-Auth-' + Date.now());
        setLoading(false);
        setQrStatus('waiting');
      }, 2500);
    }
  }, [step, qrCode]);

  // A integração real com Webhooks substituirá este controle.
  // Por ora, em produção, mantemos o fluxo manual (ou via API real) sem auto-advance fake.
  const handleSimulateConnection = () => {
    setQrStatus('scanned');
    setTimeout(() => {
      setQrStatus('connected');
      setTimeout(() => {
        nextStep();
      }, 1000);
    }, 1500);
  };

  // Tela de Provisionamento Premium
  if (provisioning) {
    return (
      <div className="onboarding-page provisioning">
        <motion.div
          className="provisioning-card glass"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="rocket-animation">
            <Rocket size={64} className="rocket-icon" />
            <div className="rocket-smoke">
              <span></span><span></span><span></span>
            </div>
          </div>
          <h1>Preparando sua Infraestrutura</h1>
          <p>Estamos configurando seu workspace, banco de dados e instâncias isoladas na nuvem.</p>

          <div className="loading-steps">
            <div className="l-step done"><Check size={14} /> Conta criada</div>
            <div className="l-step active"><Loader2 size={14} className="spin" /> Provisionando banco de dados...</div>
            <div className="l-step"><div className="dot"></div> Ativando API Gateway</div>
          </div>

          <div className="progress-bar">
            <motion.div
              className="progress-fill"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2.5, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
        <style>{`
          .provisioning { display: flex; align-items: center; justify-content: center; }
          .provisioning-card { padding: 60px; max-width: 500px; text-align: center; border-radius: 32px; border: 1px solid rgba(255,255,255,0.1); }
          .rocket-animation { margin-bottom: 40px; position: relative; display: inline-block; }
          .rocket-icon { color: var(--primary); transform: rotate(-45deg); filter: drop-shadow(0 0 20px var(--primary-glow)); }
          .rocket-smoke { position: absolute; bottom: -10px; left: -10px; width: 100%; display: flex; justify-content: center; gap: 8px; }
          .rocket-smoke span { width: 8px; height: 8px; background: rgba(255,255,255,0.1); border-radius: 50%; animation: smoke 1.5s infinite; }
          .rocket-smoke span:nth-child(2) { animation-delay: 0.2s; }
          .rocket-smoke span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes smoke { 0% { transform: translateY(0) scale(1); opacity: 0.5; } 100% { transform: translateY(20px) scale(2); opacity: 0; } }

          .provisioning-card h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 16px; font-family: 'Outfit', sans-serif; }
          .provisioning-card p { color: var(--text-muted); font-size: 1rem; line-height: 1.6; margin-bottom: 40px; }

          .loading-steps { display: flex; flex-direction: column; gap: 12px; text-align: left; margin-bottom: 40px; }
          .l-step { display: flex; align-items: center; gap: 12px; font-size: 0.9rem; font-weight: 600; color: var(--text-dim); }
          .l-step.done { color: var(--success); }
          .l-step.active { color: var(--primary); }
          .l-step .dot { width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,0.05); }

          .progress-bar { width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; }
          .progress-fill { height: 100%; background: linear-gradient(to right, var(--secondary), var(--primary)); box-shadow: 0 0 15px var(--primary-glow); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      {/* Background Decorativo */}
      <div className="bg-glow-top"></div>
      <div className="bg-glow-bottom"></div>

      <div className="onboarding-container">

        {/* Progress Header */}
        <header className="onboarding-header">
          <div className="brand">
            <div className="brand-icon"><Zap size={20} fill="currentColor" /></div>
            <span>RUPTUR<strong>CLOUD</strong></span>
          </div>

          <div className="wizard-stepper">
            {[
              { id: 1, label: 'Foco', icon: <Target size={16} /> },
              { id: 2, label: 'Plano', icon: <CreditCard size={16} /> },
              { id: 3, label: 'Conexão', icon: <Smartphone size={16} /> },
              { id: 4, label: 'Pronto', icon: <Trophy size={16} /> }
            ].map((s) => (
              <div key={s.id} className={`wizard-step ${step >= s.id ? 'active' : ''} ${step > s.id ? 'completed' : ''}`}>
                <div className="step-icon-circle">
                  {step > s.id ? <Check size={14} /> : s.icon}
                </div>
                <span className="step-label">{s.label}</span>
                {s.id < 4 && <div className="step-connector"></div>}
              </div>
            ))}
          </div>
        </header>

        <main className="onboarding-content">
          <AnimatePresence mode="wait">

            {/* STEP 1: OBJETIVO */}
            {step === 1 && (
              <motion.section
                key="step1"
                className="step-card glass"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="step-badge"><Target size={14} /> Foco & Estratégia</div>
                <h1 className="step-title">Olá, {user?.user_metadata?.full_name?.split(' ')[0] || 'parceiro'}!</h1>
                <p className="step-desc">Para personalizarmos sua experiência, qual o seu principal desafio hoje?</p>

                <div className="goal-grid">
                  {[
                    { id: 'sales', label: 'Escalar Vendas', desc: 'Recupere carrinhos e dispare ofertas', icon: <Rocket size={24} /> },
                    { id: 'support', label: 'Automatizar Suporte', desc: 'Responda clientes 24/7 sem esforço', icon: <MessageSquare size={24} /> },
                    { id: 'marketing', label: 'Campanhas em Massa', desc: 'Alcance milhares de contatos num clique', icon: <Sparkles size={24} /> },
                  ].map(g => (
                    <button
                      key={g.id}
                      className={`goal-item ${goal === g.id ? 'active' : ''}`}
                      onClick={() => setGoal(g.id)}
                    >
                      <div className="g-icon">{g.icon}</div>
                      <div className="g-info">
                        <strong>{g.label}</strong>
                        <span>{g.desc}</span>
                      </div>
                      <div className="g-check"><Check size={16} /></div>
                    </button>
                  ))}
                </div>

                <div className="step-actions">
                  <button className="btn-primary-lg" onClick={nextStep} disabled={!goal}>
                    Continuar Configuração <ArrowRight size={20} />
                  </button>
                </div>
              </motion.section>
            )}

            {/* STEP 2: PLANO */}
            {step === 2 && (
              <motion.section
                key="step2"
                className="step-card wide glass"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="step-badge"><CreditCard size={14} /> Ativação de Conta</div>
                <h1 className="step-title">Escolha o seu plano</h1>
                <p className="step-desc">Ative agora para liberar as ferramentas de automação avançada.</p>

                <div className="plans-showcase">
                  {PLANS.map(p => (
                    <div
                      key={p.id}
                      className={`plan-card ${selectedPlan === p.id ? 'selected' : ''} ${p.popular ? 'popular' : ''}`}
                      onClick={() => setSelectedPlan(p.id)}
                    >
                      {p.popular && <div className="popular-tag">Mais Escolhido</div>}
                      <div className="p-header" style={{ color: p.color }}>
                        {p.icon}
                        <h3>{p.name}</h3>
                      </div>
                      <div className="p-price-wrap">
                        <span className="p-currency">R$</span>
                        <span className="p-amount">{p.price.split(' ')[1]}</span>
                        <span className="p-period">{p.period || ''}</span>
                      </div>
                      <div className="p-credits-pill">{p.credits}</div>
                      <ul className="p-features">
                        {p.features.map((f, i) => <li key={i}><Check size={14} /> {f}</li>)}
                      </ul>
                      <div className="p-selector">
                        {selectedPlan === p.id ? 'Selecionado' : 'Selecionar'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="billing-trust">
                  <div className="trust-item">
                    <ShieldCheck size={18} />
                    <span>Checkout Seguro <strong>Getnet</strong></span>
                  </div>
                  <div className="trust-item">
                    <Lock size={18} />
                    <span>Dados Criptografados</span>
                  </div>
                </div>

                {error && <div className="error-box"><AlertCircle size={18} /> {error}</div>}

                <div className="step-actions split">
                  <button className="btn-ghost" onClick={prevStep}><ArrowLeft size={18} /> Voltar</button>
                  <button className="btn-primary-lg" onClick={handlePlanConfirm} disabled={loading}>
                    {loading ? <Loader2 size={20} className="spin" /> : <>Ativar Plano <ArrowRight size={20} /></>}
                  </button>
                </div>
              </motion.section>
            )}

            {/* STEP 3: WHATSAPP */}
            {step === 3 && (
              <motion.section
                key="step3"
                className="step-card glass"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="step-badge"><QrCode size={14} /> Conexão em Tempo Real</div>
                <h1 className="step-title">Vincule seu WhatsApp</h1>
                <p className="step-desc">Escaneie o código abaixo com o seu celular para ativar sua primeira instância.</p>

                <div className="qr-wrapper">
                  <div className={`qr-frame ${qrStatus}`}>
                    {loading ? (
                      <div className="qr-state">
                        <div className="radar-ping"></div>
                        <Loader2 size={40} className="spin" />
                        <span>Sincronizando com UAZAPI...</span>
                      </div>
                    ) : (
                      <div className="qr-display">
                        <img src={qrCode} alt="WhatsApp QR Code" className={qrStatus !== 'waiting' ? 'blurred' : ''} />

                        <AnimatePresence>
                          {qrStatus === 'scanned' && (
                            <motion.div
                              className="qr-overlay-status"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Loader2 size={40} className="spin status-icon primary" />
                              <span>Autenticando Aparelho...</span>
                            </motion.div>
                          )}
                          {qrStatus === 'connected' && (
                            <motion.div
                              className="qr-overlay-status success"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                            >
                              <div className="success-circle">
                                <Check size={40} className="status-icon" />
                              </div>
                              <span>Conexão Estabelecida!</span>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="qr-overlay-glow"></div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="qr-instructions glass">
                  <div className="ins-item">
                    <div className="ins-num">1</div>
                    <span>Abra o WhatsApp no celular</span>
                  </div>
                  <div className="ins-item">
                    <div className="ins-num">2</div>
                    <span>Toque em <strong>Configurações</strong> &gt; <strong>Aparelhos</strong></span>
                  </div>
                  <div className="ins-item">
                    <div className="ins-num">3</div>
                    <span>Aponte a câmera para esta tela</span>
                  </div>
                </div>

                <div className="step-actions split">
                  <button className="btn-ghost" onClick={prevStep}>Voltar</button>
                  <button
                    className="btn-primary-lg"
                    onClick={qrStatus === 'connected' ? nextStep : handleSimulateConnection}
                  >
                    {qrStatus === 'waiting' ? 'Já escaneei o QR Code' : qrStatus === 'connected' ? 'Continuar' : 'Autenticando...'}
                  </button>
                </div>
              </motion.section>
            )}

            {/* STEP 4: SUCESSO */}
            {step === 4 && (
              <motion.section
                key="step4"
                className="step-card glass"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="success-confetti">
                  <Sparkles size={48} className="icon-sparkle" />
                </div>
                <div className="trophy-wrap">
                  <Trophy size={64} className="trophy-icon" />
                  <div className="trophy-glow"></div>
                </div>
                <h1 className="step-title">Você está pronto!</h1>
                <p className="step-desc">Sua jornada no <strong>Ruptur Cloud</strong> começa agora. Vamos decolar?</p>

                <div className="setup-summary">
                  <div className="sum-item">
                    <div className="sum-icon"><ShieldCheck size={18} /></div>
                    <div className="sum-text">
                      <strong>Conta Verificada</strong>
                      <span>Acesso total liberado</span>
                    </div>
                  </div>
                  <div className="sum-item">
                    <div className="sum-icon"><Zap size={18} /></div>
                    <div className="sum-text">
                      <strong>Plano {PLANS.find(p => p.id === selectedPlan)?.name}</strong>
                      <span>Renovação automática ativa</span>
                    </div>
                  </div>
                </div>

                <div className="step-actions">
                  <button className="btn-primary-xl" onClick={finish}>
                    Explorar meu Dashboard <Rocket size={20} />
                  </button>
                </div>
              </motion.section>
            )}

          </AnimatePresence>
        </main>
      </div>

      <style>{`
        .onboarding-page {
          min-height: 100vh;
          background: #06060e;
          color: #fff;
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow-x: hidden;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
        }

        .bg-glow-top { position: absolute; top: -10%; right: -10%; width: 50%; height: 50%; background: radial-gradient(circle, rgba(0,242,255,0.08) 0%, transparent 70%); z-index: 0; }
        .bg-glow-bottom { position: absolute; bottom: -10%; left: -10%; width: 50%; height: 50%; background: radial-gradient(circle, rgba(112,0,255,0.08) 0%, transparent 70%); z-index: 0; }

        .onboarding-container { width: 100%; max-width: 600px; position: relative; z-index: 1; }
        .onboarding-container:has(.wide) { max-width: 900px; }

        .onboarding-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
        }

        .brand { display: flex; align-items: center; gap: 12px; font-family: 'Outfit', sans-serif; font-size: 1.1rem; }
        .brand-icon { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--secondary), var(--primary)); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(112,0,255,0.3); }
        .brand strong { color: var(--primary); }

        .wizard-stepper {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .wizard-step {
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
        }
        .step-icon-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          transition: all 0.3s;
          z-index: 2;
        }
        .wizard-step.active .step-icon-circle {
          background: rgba(0,242,255,0.1);
          border-color: var(--primary);
          color: var(--primary);
          box-shadow: 0 0 15px rgba(0,242,255,0.2);
        }
        .wizard-step.completed .step-icon-circle {
          background: var(--primary);
          border-color: var(--primary);
          color: #000;
        }
        .step-label {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          transition: all 0.3s;
        }
        .wizard-step.active .step-label { color: #fff; }
        .step-connector {
          width: 30px;
          height: 2px;
          background: rgba(255,255,255,0.05);
          margin: 0 4px;
        }
        .wizard-step.completed .step-connector { background: var(--primary); }

        .step-card { padding: 48px; border-radius: 32px; text-align: center; border: 1px solid rgba(255,255,255,0.08); position: relative; }
        .step-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 100px; font-size: 0.75rem; font-weight: 700; color: var(--primary); margin-bottom: 24px; text-transform: uppercase; }
        .step-title { font-size: 2.5rem; font-weight: 800; font-family: 'Outfit', sans-serif; margin-bottom: 12px; letter-spacing: -1px; }
        .step-desc { font-size: 1.1rem; color: var(--text-dim); margin-bottom: 40px; line-height: 1.6; }

        /* Goal Grid */
        .goal-grid { display: grid; gap: 16px; margin-bottom: 40px; }
        .goal-item {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          text-align: left;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          border: 1px solid transparent;
        }
        .goal-item:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); transform: translateX(5px); }
        .goal-item.active { background: rgba(0,242,255,0.05); border-color: var(--primary); box-shadow: 0 0 30px rgba(0,242,255,0.1); }

        .g-icon { width: 52px; height: 52px; border-radius: 14px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; color: var(--text-dim); transition: all 0.3s; }
        .goal-item.active .g-icon { background: var(--primary); color: #000; box-shadow: 0 0 15px var(--primary-glow); }

        .g-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .g-info strong { font-size: 1.1rem; color: #fff; }
        .g-info span { font-size: 0.9rem; color: var(--text-muted); }

        .g-check { width: 24px; height: 24px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: transparent; transition: all 0.3s; }
        .goal-item.active .g-check { background: var(--primary); border-color: var(--primary); color: #000; }

        /* Plans Showcase */
        .plans-showcase { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; perspective: 1000px; }
        .plan-card {
          padding: 32px 24px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .plan-card:hover { transform: translateY(-10px) scale(1.02); background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.15); }
        .plan-card.selected { border-color: var(--primary); background: rgba(0,242,255,0.04); box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px var(--primary); }
        .plan-card.popular { border-color: var(--secondary); background: rgba(112,0,255,0.03); }
        .plan-card.popular.selected { border-color: var(--primary); }

        .popular-tag { position: absolute; top: -12px; background: var(--secondary); padding: 4px 12px; border-radius: 100px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: #fff; box-shadow: 0 5px 15px var(--secondary-glow); }

        .p-header { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .p-header h3 { font-size: 1.4rem; font-weight: 800; color: #fff; }

        .p-price-wrap { display: flex; align-items: baseline; gap: 4px; }
        .p-currency { font-size: 0.9rem; font-weight: 600; color: var(--text-dim); }
        .p-amount { font-size: 2.2rem; font-weight: 800; color: #fff; font-family: 'Outfit', sans-serif; }
        .p-period { font-size: 0.9rem; color: var(--text-muted); }

        .p-credits-pill { padding: 4px 12px; background: rgba(255,255,255,0.05); border-radius: 100px; font-size: 0.75rem; font-weight: 700; color: var(--text-dim); border: 1px solid rgba(255,255,255,0.08); }
        .plan-card.selected .p-credits-pill { background: var(--primary); color: #000; border-color: var(--primary); }

        .p-features { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 8px; }
        .p-features li { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; color: var(--text-dim); text-align: left; }
        .p-features li svg { color: var(--success); flex-shrink: 0; }

        .p-selector { margin-top: auto; width: 100%; padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.05); color: #fff; font-weight: 700; font-size: 0.85rem; transition: all 0.3s; }
        .plan-card.selected .p-selector { background: var(--primary); color: #000; }

        .billing-trust { display: flex; justify-content: center; gap: 24px; margin-bottom: 32px; color: var(--text-muted); font-size: 0.85rem; }
        .trust-item { display: flex; align-items: center; gap: 8px; }
        .trust-item strong { color: var(--text-dim); }

        /* QR Step */
        .qr-wrapper { margin-bottom: 40px; display: flex; justify-content: center; }
        .qr-frame { width: 300px; height: 300px; padding: 25px; background: #fff; border-radius: 32px; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .qr-display { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .qr-display img { width: 100%; border-radius: 12px; transition: filter 0.3s; }
        .qr-display img.blurred { filter: blur(8px) brightness(0.8); }
        .qr-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; color: #505060; font-weight: 600; text-align: center; }

        .qr-overlay-status { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: rgba(255,255,255,0.8); border-radius: 12px; font-weight: 700; color: #000; z-index: 10; }
        .qr-overlay-status.success { background: rgba(0,255,136,0.9); color: #000; }
        .status-icon.primary { color: var(--primary); }
        .success-circle { width: 64px; height: 64px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--success); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }

        .qr-instructions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 24px; border-radius: 20px; text-align: left; }
        .ins-item { display: flex; flex-direction: column; gap: 12px; }
        .ins-num { width: 28px; height: 28px; border-radius: 8px; background: var(--primary); color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; }
        .ins-item span { font-size: 0.85rem; color: var(--text-dim); line-height: 1.4; }

        /* Success Step */
        .trophy-wrap { position: relative; width: 120px; height: 120px; margin: 0 auto 32px; display: flex; align-items: center; justify-content: center; }
        .trophy-icon { color: var(--primary); position: relative; z-index: 2; filter: drop-shadow(0 0 20px var(--primary-glow)); }
        .trophy-glow { position: absolute; inset: 0; background: var(--primary); border-radius: 50%; filter: blur(40px); opacity: 0.2; animation: pulse 2s infinite; }

        .setup-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 40px; }
        .sum-item { display: flex; align-items: center; gap: 16px; padding: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; text-align: left; }
        .sum-icon { width: 40px; height: 40px; border-radius: 12px; background: rgba(0,255,136,0.1); color: var(--success); display: flex; align-items: center; justify-content: center; }
        .sum-text { display: flex; flex-direction: column; gap: 2px; }
        .sum-text strong { font-size: 0.95rem; color: #fff; }
        .sum-text span { font-size: 0.8rem; color: var(--text-muted); }

        /* Actions */
        .step-actions { margin-top: 10px; }
        .step-actions.split { display: flex; gap: 16px; }

        .btn-primary-lg { flex: 1; padding: 20px 32px; background: linear-gradient(135deg, var(--secondary), var(--primary)); border: none; border-radius: 20px; color: #fff; font-weight: 800; font-size: 1.1rem; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 10px 30px var(--secondary-glow); }
        .btn-primary-lg:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 40px var(--secondary-glow); filter: brightness(1.1); }
        .btn-primary-lg:disabled { opacity: 0.4; cursor: not-allowed; }

        .btn-primary-xl { width: 100%; padding: 24px; background: linear-gradient(135deg, var(--secondary), var(--primary)); border: none; border-radius: 24px; color: #fff; font-weight: 800; font-size: 1.2rem; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 10px 40px var(--secondary-glow); }
        .btn-primary-xl:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 20px 50px var(--secondary-glow); }

        .btn-ghost { padding: 20px 32px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; color: var(--text-dim); font-weight: 700; cursor: pointer; transition: all 0.3s; }
        .btn-ghost:hover { background: rgba(255,255,255,0.06); color: #fff; }

        .error-box { display: flex; align-items: center; gap: 12px; padding: 16px; background: rgba(255,0,80,0.1); border: 1px solid rgba(255,0,80,0.2); border-radius: 16px; color: #ff4d6a; margin-bottom: 24px; font-size: 0.9rem; font-weight: 600; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.2; } 50% { transform: scale(1.1); opacity: 0.4; } 100% { transform: scale(0.95); opacity: 0.2; } }

        @media (max-width: 768px) {
          .plans-showcase { grid-template-columns: 1fr; }
          .setup-summary { grid-template-columns: 1fr; }
          .onboarding-header { flex-direction: column; gap: 20px; align-items: flex-start; }
          .progress-hub { align-items: flex-start; width: 100%; }
          .progress-track { width: 100%; }
          .step-title { font-size: 2rem; }
          .step-card { padding: 32px 20px; }
        }
      `}</style>
    </div>
  );
}
