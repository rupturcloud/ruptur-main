import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, Zap, QrCode, Send, ArrowRight, ArrowLeft, 
  Crown, Rocket, Building2, Loader2, CreditCard, 
  ShieldCheck, AlertCircle, Sparkles, MessageSquare, 
  Smartphone, Target, Trophy 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const PLANS = [
  { id: 'trial',    name: 'Trial Grátis', price: 'R$ 0',        credits: '50 créditos',    desc: 'Teste sem compromisso',  icon: <Zap size={24} />,       color: '#00f2ff' },
  { id: 'starter',  name: 'Starter',      price: 'R$ 97/mês',   credits: '2.000 cr/mês',   desc: '1 instância WhatsApp',     icon: <Rocket size={24} />,    color: '#7000ff', popular: true },
  { id: 'pro',      name: 'Pro',          price: 'R$ 197/mês',  credits: '5.000 cr/mês',   desc: '3 instâncias WhatsApp',    icon: <Crown size={24} />,     color: '#ff007a' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { tenant, tenantId, user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState('trial');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrCode, setQrCode] = useState(null);

  const nextStep = () => { setError(''); setStep(s => s + 1); };
  const prevStep = () => { setError(''); setStep(s => s - 1); };
  const finish = () => navigate('/dashboard');

  // Lógica de Assinatura
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
      setError(err.message || 'Erro ao processar assinatura.');
    } finally {
      setLoading(false);
    }
  }, [selectedPlan, tenantId]);

  // Simulação de QR Code (Em prod, isso viria da UAZAPI)
  useEffect(() => {
    if (step === 3 && !qrCode) {
      setLoading(true);
      setTimeout(() => {
        setQrCode('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=RupturCloud-Auth');
        setLoading(false);
      }, 2000);
    }
  }, [step, qrCode]);

  return (
    <div className="onboarding-wizard">
      <div className="wizard-container">
        
        {/* Header do Wizard */}
        <div className="wizard-header">
          <div className="logo">
            <Zap size={24} fill="#00f2ff" color="#00f2ff" />
            <span>RUPTUR<strong>CLOUD</strong></span>
          </div>
          <div className="steps-indicator">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`step-dot ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
                {step > s ? <Check size={12} /> : s}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: OBJETIVO */}
          {step === 1 && (
            <motion.div key="step1" className="step-box" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="icon-main"><Target size={48} color="#00f2ff" /></div>
              <h2>Seja bem-vindo, {user?.user_metadata?.full_name || 'parceiro'}!</h2>
              <p>Qual é o seu principal objetivo com o Ruptur hoje?</p>
              
              <div className="goal-options">
                {[
                  { id: 'sales', label: 'Escalar Vendas', icon: <Rocket size={20} /> },
                  { id: 'support', label: 'Automação de Suporte', icon: <MessageSquare size={20} /> },
                  { id: 'marketing', label: 'Campanhas em Massa', icon: <Sparkles size={20} /> },
                ].map(g => (
                  <button key={g.id} className={`goal-card ${goal === g.id ? 'active' : ''}`} onClick={() => setGoal(g.id)}>
                    {g.icon} <span>{g.label}</span>
                  </button>
                ))}
              </div>

              <button className="btn-next" onClick={nextStep} disabled={!goal}>
                Próximo Passo <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {/* STEP 2: PLANO */}
          {step === 2 && (
            <motion.div key="step2" className="step-box wide" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2>Escolha seu combustível</h2>
              <p>Comece com o trial gratuito ou desbloqueie o poder total.</p>
              
              <div className="plans-row">
                {PLANS.map(p => (
                  <div key={p.id} className={`plan-item ${selectedPlan === p.id ? 'selected' : ''}`} onClick={() => setSelectedPlan(p.id)}>
                    {p.popular && <span className="badge-popular">Recomendado</span>}
                    <div className="p-icon" style={{ color: p.color }}>{p.icon}</div>
                    <h3>{p.name}</h3>
                    <div className="p-price">{p.price}</div>
                    <p>{p.desc}</p>
                    <div className="p-credits">{p.credits}</div>
                  </div>
                ))}
              </div>

              {error && <div className="error-msg"><AlertCircle size={16} /> {error}</div>}

              <div className="actions">
                <button className="btn-back" onClick={prevStep}><ArrowLeft size={18} /> Voltar</button>
                <button className="btn-next" onClick={handlePlanConfirm} disabled={loading}>
                  {loading ? <Loader2 size={18} className="spin" /> : <>Confirmar Plano <ArrowRight size={18} /></>}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: WHATSAPP */}
          {step === 3 && (
            <motion.div key="step3" className="step-box" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="icon-main"><Smartphone size={48} color="#00ff88" /></div>
              <h2>Conectar WhatsApp</h2>
              <p>Escaneie o código abaixo para vincular sua conta ao Ruptur.</p>
              
              <div className="qr-container glass">
                {loading ? (
                  <div className="qr-loading">
                    <Loader2 size={40} className="spin" />
                    <span>Gerando instância única...</span>
                  </div>
                ) : (
                  <img src={qrCode} alt="QR Code" className="qr-img" />
                )}
              </div>

              <div className="instructions">
                <ol>
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Vá em <strong>Aparelhos Conectados</strong></li>
                  <li>Toque em <strong>Conectar um aparelho</strong></li>
                </ol>
              </div>

              <div className="actions">
                <button className="btn-back" onClick={prevStep}>Voltar</button>
                <button className="btn-next" onClick={nextStep}>Já conectei! <ArrowRight size={18} /></button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: SUCESSO */}
          {step === 4 && (
            <motion.div key="step4" className="step-box" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="icon-main success-icon"><Trophy size={60} color="#00f2ff" /></div>
              <h2>Tudo pronto, {user?.user_metadata?.full_name?.split(' ')[0]}!</h2>
              <p>Sua conta foi configurada com sucesso. Você já pode iniciar suas primeiras automações.</p>
              
              <div className="success-summary glass">
                <div className="s-item"><Check size={18} color="#00ff88" /> <span>Plano {PLANS.find(p => p.id === selectedPlan)?.name} Ativo</span></div>
                <div className="s-item"><Check size={18} color="#00ff88" /> <span>Instância Vinculada</span></div>
                <div className="s-item"><Check size={18} color="#00ff88" /> <span>50 créditos de bônus liberados</span></div>
              </div>

              <button className="btn-finish" onClick={finish}>
                Ir para Dashboard <Rocket size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .onboarding-wizard {
          min-height: 100vh;
          background: #06060e;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-family: 'Inter', sans-serif;
          padding: 24px;
        }

        .wizard-container {
          width: 100%;
          max-width: 600px;
          position: relative;
        }

        .wizard-container:has(.wide) { max-width: 800px; }

        .wizard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 48px;
        }

        .logo { display: flex; align-items: center; gap: 10px; font-size: 1.1rem; font-family: 'Outfit', sans-serif; }
        .logo strong { color: #00f2ff; }

        .steps-indicator { display: flex; gap: 12px; }
        .step-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          color: #505060;
          transition: all 0.3s;
        }

        .step-dot.active { border-color: #00f2ff; color: #00f2ff; box-shadow: 0 0 10px rgba(0,242,255,0.3); }
        .step-dot.completed { background: #00f2ff; border-color: #00f2ff; color: #000; }

        .step-box {
          background: rgba(12,12,24,0.7);
          border: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(24px);
          padding: 48px;
          border-radius: 24px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        }

        .step-box h2 { font-size: 1.8rem; font-weight: 800; margin-bottom: 12px; font-family: 'Outfit', sans-serif; }
        .step-box p { color: #a0a0b0; margin-bottom: 32px; line-height: 1.6; }

        .icon-main { margin-bottom: 24px; display: flex; justify-content: center; }

        .goal-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
        .goal-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 24px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          color: #a0a0b0;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
        }

        .goal-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); }
        .goal-card.active { background: rgba(0,242,255,0.08); border-color: #00f2ff; color: #fff; }

        .plans-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
        .plan-item {
          padding: 24px 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .plan-item:hover { transform: translateY(-5px); background: rgba(255,255,255,0.05); }
        .plan-item.selected { border-color: #00f2ff; background: rgba(0,242,255,0.05); box-shadow: 0 0 20px rgba(0,242,255,0.1); }

        .badge-popular {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: #7000ff;
          padding: 4px 12px;
          border-radius: 10px;
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .p-icon { margin-bottom: 12px; }
        .p-price { font-size: 1.25rem; font-weight: 800; margin: 8px 0; color: #00f2ff; }
        .p-credits { font-size: 0.75rem; color: #707080; font-weight: 700; text-transform: uppercase; }

        .qr-container {
          width: 240px;
          height: 240px;
          margin: 0 auto 32px;
          padding: 20px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qr-img { width: 100%; border-radius: 10px; filter: brightness(1.1); }
        .qr-loading { display: flex; flex-direction: column; gap: 16px; color: #505060; font-size: 0.85rem; }

        .instructions { text-align: left; max-width: 320px; margin: 0 auto 32px; color: #a0a0b0; font-size: 0.9rem; }
        .instructions ol { padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }

        .success-summary {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 24px;
          border-radius: 16px;
          margin-bottom: 32px;
          text-align: left;
        }

        .s-item { display: flex; align-items: center; gap: 12px; font-weight: 600; color: #d0d0e0; }

        .actions { display: flex; gap: 12px; justify-content: center; }

        .btn-next, .btn-finish {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 32px;
          background: linear-gradient(135deg, #7000ff, #00f2ff);
          border: none;
          border-radius: 14px;
          color: #fff;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(112,0,255,0.3);
          transition: transform 0.2s;
        }

        .btn-next:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-next:hover:not(:disabled) { transform: translateY(-2px); }

        .btn-back {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px 24px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #a0a0b0;
          border-radius: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-back:hover { background: rgba(255,255,255,0.08); color: #fff; }

        .error-msg {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: rgba(255,0,80,0.1);
          border: 1px solid rgba(255,0,80,0.2);
          border-radius: 10px;
          color: #ff4d6a;
          margin-bottom: 20px;
          font-size: 0.85rem;
        }

        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 600px) {
          .plans-row { grid-template-columns: 1fr; }
          .wizard-container:has(.wide) { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
