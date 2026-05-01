/**
 * Onboarding — Wizard de 3 passos pós sign-up
 *
 * Step 1: Escolher plano (ou seguir com trial)
 * Step 2: Conectar instância WhatsApp (QR Code)
 * Step 3: Enviar mensagem teste (1 crédito)
 *
 * Integração real com API de billing (Getnet) para assinaturas.
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, QrCode, Send, ArrowRight, Crown, Rocket, Building2, Loader2, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const PLANS = [
  { id: 'trial',    name: 'Trial',    price: 'Grátis',      priceCents: 0,     credits: '50 créditos',    desc: 'Explore sem compromisso',  icon: <Zap size={24} />,       highlight: false },
  { id: 'starter',  name: 'Starter',  price: 'R$ 97/mês',   priceCents: 9700,  credits: '2.000 cr/mês',   desc: '1 instância WhatsApp',     icon: <Rocket size={24} />,    highlight: true },
  { id: 'pro',      name: 'Pro',      price: 'R$ 197/mês',  priceCents: 19700, credits: '5.000 cr/mês',   desc: '3 instâncias WhatsApp',    icon: <Crown size={24} />,     highlight: false },
  { id: 'business', name: 'Business', price: 'R$ 497/mês',  priceCents: 49700, credits: '15.000 cr/mês',  desc: '10 instâncias',            icon: <Building2 size={24} />, highlight: false },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { tenant, tenantId } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState('trial');
  const [testNumber, setTestNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subscriptionResult, setSubscriptionResult] = useState(null);

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const finish = () => navigate('/dashboard');

  /**
   * Ao confirmar o plano — se for pago, chama a API de assinatura Getnet
   */
  const handlePlanConfirm = useCallback(async () => {
    setError('');

    // Trial não precisa de pagamento
    if (selectedPlan === 'trial') {
      nextStep();
      return;
    }

    // Plano pago → chamar API de assinatura
    if (!tenantId) {
      setError('Erro: tenant não provisionado. Faça logout e entre novamente.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.createSubscription(tenantId, selectedPlan);
      setSubscriptionResult(result);

      // Se a Getnet retornou uma URL de pagamento, redirecionar
      if (result.checkoutUrl || result.redirect_url) {
        window.location.href = result.checkoutUrl || result.redirect_url;
        return;
      }

      // Assinatura criada com sucesso direto (ex: cartão já no cofre)
      nextStep();
    } catch (err) {
      console.error('[Onboarding] Erro ao assinar:', err);
      setError(err.message || 'Erro ao processar assinatura. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [selectedPlan, tenantId]);

  /**
   * Enviar mensagem de teste (Step 3)
   */
  const handleSendTest = useCallback(async () => {
    if (!testNumber || testNumber.length < 10) {
      setError('Informe um número válido com DDD.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // TODO: Integrar com API de envio de teste quando disponível
      // await apiService.sendTestMessage(tenantId, testNumber);
      await new Promise(r => setTimeout(r, 1500)); // Simula envio
      finish();
    } catch (err) {
      setError(err.message || 'Erro ao enviar mensagem de teste.');
    } finally {
      setLoading(false);
    }
  }, [testNumber, tenantId]);

  return (
    <div className="onboard-page">
      <div className="onboard-wrapper">
        {/* Progress bar */}
        <div className="progress-bar">
          {[1, 2, 3].map(n => (
            <div key={n} className={`progress-step ${step >= n ? 'done' : ''} ${step === n ? 'current' : ''}`}>
              <div className="step-circle">{step > n ? <Check size={14} /> : n}</div>
              <span className="step-label">{n === 1 ? 'Plano' : n === 2 ? 'WhatsApp' : 'Teste'}</span>
            </div>
          ))}
          <div className="progress-track">
            <motion.div className="progress-fill" animate={{ width: `${((step - 1) / 2) * 100}%` }} />
          </div>
        </div>

        {/* Erro global */}
        <AnimatePresence>
          {error && (
            <motion.div className="onboard-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <AlertCircle size={16} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* STEP 1: Escolher Plano */}
          {step === 1 && (
            <motion.div key="s1" className="step-content" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <h2>Escolha seu plano</h2>
              <p className="step-desc">Comece grátis ou escolha o plano ideal para o seu negócio.</p>
              <div className="plans-grid">
                {PLANS.map(p => (
                  <motion.button key={p.id} className={`plan-card ${selectedPlan === p.id ? 'selected' : ''} ${p.highlight ? 'popular' : ''}`}
                    onClick={() => { setSelectedPlan(p.id); setError(''); }} whileTap={{ scale: 0.98 }}>
                    {p.highlight && <span className="popular-badge">Mais popular</span>}
                    <div className="plan-icon">{p.icon}</div>
                    <h3>{p.name}</h3>
                    <span className="plan-price">{p.price}</span>
                    <span className="plan-credits">{p.credits}</span>
                    <span className="plan-desc">{p.desc}</span>
                    {selectedPlan === p.id && <div className="plan-check"><Check size={16} /></div>}
                  </motion.button>
                ))}
              </div>

              {/* Badge de segurança para planos pagos */}
              {selectedPlan !== 'trial' && (
                <motion.div className="security-badge" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <ShieldCheck size={16} />
                  <span>Pagamento seguro via <strong>Getnet Santander</strong> • Cancele quando quiser</span>
                </motion.div>
              )}

              <button className="next-btn" onClick={handlePlanConfirm} disabled={loading}>
                {loading ? <Loader2 size={18} className="spin" /> : (
                  <>
                    {selectedPlan === 'trial' ? 'Começar Trial' : <>
                      <CreditCard size={18} /> Assinar {PLANS.find(p => p.id === selectedPlan)?.name}
                    </>}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* STEP 2: Conectar WhatsApp */}
          {step === 2 && (
            <motion.div key="s2" className="step-content" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <h2>Conecte seu WhatsApp</h2>
              <p className="step-desc">Escaneie o QR Code com seu WhatsApp Business para vincular.</p>
              <div className="qr-placeholder glass">
                <QrCode size={120} strokeWidth={1} style={{ opacity: 0.3 }} />
                <p>Carregando QR Code...</p>
                <span className="qr-hint">Abra WhatsApp → Configurações → Aparelhos Conectados → Conectar</span>
              </div>
              <div className="step-actions">
                <button className="skip-btn" onClick={nextStep}>Pular por agora</button>
                <button className="next-btn" onClick={nextStep}>Conectado! <ArrowRight size={18} /></button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Enviar Mensagem Teste */}
          {step === 3 && (
            <motion.div key="s3" className="step-content" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <h2>Envie sua primeira mensagem</h2>
              <p className="step-desc">Teste o sistema enviando uma mensagem para seu próprio número.</p>
              <div className="test-send glass">
                <div className="field">
                  <label>Seu número (com DDD)</label>
                  <input type="tel" placeholder="31988887777" value={testNumber} onChange={e => { setTestNumber(e.target.value); setError(''); }} />
                </div>
                <div className="test-message">
                  <p>📱 Mensagem de teste:</p>
                  <div className="msg-preview">
                    "Olá! Esta é uma mensagem de teste do RupturCloud. Se você recebeu, está tudo funcionando! 🚀"
                  </div>
                </div>
              </div>
              <div className="step-actions">
                <button className="skip-btn" onClick={finish}>Ir para o Dashboard</button>
                <button className="next-btn" onClick={handleSendTest} disabled={loading}>
                  {loading ? <Loader2 size={16} className="spin" /> : <><Send size={16} /> Enviar e Finalizar</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .onboard-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-primary,#0a0a14);padding:24px}
        .onboard-wrapper{width:100%;max-width:680px}
        .onboard-error{display:flex;align-items:center;gap:8px;padding:12px 16px;margin-bottom:20px;background:rgba(255,0,80,.08);border:1px solid rgba(255,0,80,.2);border-radius:12px;color:#ff4d6a;font-size:.88rem}
        .progress-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px;position:relative;padding:0 20px}
        .progress-step{display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2}
        .step-circle{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;background:rgba(255,255,255,.06);border:2px solid var(--border-glass);color:var(--text-muted);transition:all .3s}
        .progress-step.done .step-circle{background:var(--primary);border-color:var(--primary);color:#000}
        .progress-step.current .step-circle{border-color:var(--primary);color:var(--primary);box-shadow:0 0 12px rgba(0,242,255,.3)}
        .step-label{font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px}
        .progress-track{position:absolute;top:16px;left:50px;right:50px;height:2px;background:var(--border-glass);z-index:1}
        .progress-fill{height:100%;background:var(--primary);border-radius:2px}
        .step-content{text-align:center}
        .step-content h2{font-size:1.6rem;font-weight:700;margin-bottom:8px}
        .step-desc{color:var(--text-muted);margin-bottom:32px;font-size:.95rem}
        .plans-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:20px}
        .plan-card{position:relative;padding:24px 18px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid var(--border-glass);cursor:pointer;text-align:left;transition:all .2s;display:flex;flex-direction:column;gap:4px;color:var(--text-main)}
        .plan-card:hover{border-color:rgba(0,242,255,.2);background:rgba(0,242,255,.03)}
        .plan-card.selected{border-color:var(--primary);background:rgba(0,242,255,.06);box-shadow:0 0 20px rgba(0,242,255,.1)}
        .plan-card.popular{border-color:rgba(112,0,255,.3)}
        .popular-badge{position:absolute;top:-10px;right:12px;padding:3px 10px;border-radius:20px;background:linear-gradient(135deg,var(--secondary),var(--primary));font-size:.68rem;font-weight:700;color:#fff}
        .plan-icon{margin-bottom:6px;color:var(--primary)}
        .plan-card h3{font-size:1.1rem;font-weight:700}
        .plan-price{font-size:1rem;font-weight:700;color:var(--primary)}
        .plan-credits{font-size:.82rem;color:var(--text-muted)}
        .plan-desc{font-size:.78rem;color:var(--text-muted);margin-top:4px}
        .plan-check{position:absolute;top:12px;right:12px;width:24px;height:24px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#000}
        .security-badge{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:20px;padding:10px 16px;background:rgba(0,255,136,.05);border:1px solid rgba(0,255,136,.15);border-radius:10px;font-size:.82rem;color:#00ff88}
        .security-badge strong{color:#00ff88}
        .qr-placeholder{display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px;border-radius:16px;margin-bottom:28px}
        .qr-placeholder p{font-size:.95rem;color:var(--text-muted)}
        .qr-hint{font-size:.78rem;color:var(--text-muted);opacity:.6;max-width:300px}
        .test-send{padding:28px;border-radius:16px;margin-bottom:28px;text-align:left}
        .test-send .field label{display:block;font-size:.82rem;font-weight:600;color:var(--text-muted);margin-bottom:6px}
        .test-send .field input{width:100%;padding:12px;background:rgba(255,255,255,.04);border:1px solid var(--border-glass);border-radius:10px;color:#fff;font-size:1rem}
        .test-send .field input:focus{outline:none;border-color:var(--primary)}
        .test-message{margin-top:20px}
        .test-message p{font-size:.85rem;color:var(--text-muted);margin-bottom:8px}
        .msg-preview{padding:14px;background:rgba(0,242,255,.04);border-radius:10px;border-left:3px solid var(--primary);font-size:.9rem;color:var(--text-main);line-height:1.5}
        .step-actions{display:flex;gap:12px;justify-content:center}
        .skip-btn{padding:12px 24px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border-glass);color:var(--text-muted);cursor:pointer;font-size:.9rem;transition:all .2s}
        .skip-btn:hover{background:rgba(255,255,255,.08);color:var(--text-main)}
        .next-btn{display:flex;align-items:center;gap:8px;padding:14px 28px;border-radius:10px;background:linear-gradient(135deg,var(--secondary),var(--primary));border:none;color:#fff;font-weight:700;font-size:1rem;cursor:pointer;box-shadow:0 4px 16px rgba(112,0,255,.3);transition:opacity .2s}
        .next-btn:hover{opacity:.9}
        .next-btn:disabled{opacity:.5;cursor:not-allowed}
        @media(max-width:600px){.plans-grid{grid-template-columns:1fr}}
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}
      `}</style>
    </div>
  );
}
