import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return setError('Preencha todos os campos');
    if (form.password.length < 6) return setError('Senha mínima: 6 caracteres');
    setLoading(true);
    try {
      await signUp(form.email, form.password, form.name);
      navigate('/onboarding');
    } catch (err) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <motion.div className="auth-card glass" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="auth-logo">
          <div className="logo-icon-wrap"><Zap size={22} fill="currentColor" /></div>
          <h1 className="logo-text">RUPTUR<span>CLOUD</span></h1>
        </div>
        <h2 className="auth-title">Crie sua conta</h2>
        <p className="auth-sub">Comece grátis com 50 créditos. Sem cartão.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label>Nome do negócio</label>
            <input name="name" placeholder="Ex: Murilo Rifas" value={form.name} onChange={handleChange} autoFocus />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input name="email" type="email" placeholder="seu@email.com" value={form.email} onChange={handleChange} />
          </div>
          <div className="field">
            <label>Senha</label>
            <div className="pw-wrap">
              <input name="password" type={showPw ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" value={form.password} onChange={handleChange} />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <motion.button type="submit" className="auth-btn" disabled={loading} whileTap={{ scale: 0.97 }}>
            {loading ? <Loader2 size={20} className="spin" /> : <>Começar Grátis <ArrowRight size={18} /></>}
          </motion.button>
        </form>
        <div className="auth-divider"></div>
        <div className="auth-footer-container glass-highlight">
          <p className="auth-footer">Já é um de nossos parceiros?</p>
          <Link to="/login" className="login-link-highlight">
            Acessar Minha Conta <ArrowRight size={18} />
          </Link>
        </div>
        <div className="trial-badge"><span>🎁</span> 50 créditos grátis inclusos • Sem cartão</div>
      </motion.div>
      <style>{`
        .glass-highlight {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .auth-footer { margin-bottom: 8px !important; opacity: 0.6; font-size: 0.9rem; }
        .auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-primary,#0a0a14);padding:24px;background: radial-gradient(circle at top right, rgba(112,0,255,0.05), transparent), radial-gradient(circle at bottom left, rgba(0,242,255,0.05), transparent);}
        .auth-card{width:100%;max-width:440px;padding:48px 40px;border-radius:24px;border:1px solid var(--border-glass);background:rgba(12,12,24,.85);backdrop-filter:blur(20px);box-shadow: 0 20px 60px rgba(0,0,0,0.5);}
        .auth-logo{display:flex;align-items:center;gap:12px;margin-bottom:32px}
        .auth-logo .logo-icon-wrap{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,var(--secondary),var(--primary));display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 8px 20px rgba(112,0,255,.3)}
        .auth-logo .logo-text{font-size:1.3rem;font-weight:800;letter-spacing:-1px;font-family:'Outfit',sans-serif}
        .auth-logo .logo-text span{color:var(--primary)}
        .auth-title{font-size:1.75rem;font-weight:800;margin-bottom:8px;font-family:'Outfit',sans-serif}
        .auth-sub{font-size:1rem;color:var(--text-muted);margin-bottom:32px}
        .auth-form{display:flex;flex-direction:column;gap:20px}
        .auth-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 32px 0; }
        .field label{display:block;font-size:.8rem;font-weight:700;color:var(--text-dim);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px}
        .field input{width:100%;padding:14px 16px;background:rgba(255,255,255,0.03);border:1px solid var(--border-glass);border-radius:12px;color:#fff;font-size:1rem;transition: all 0.2s;font-family:'Inter',sans-serif}
        .field input:focus{outline:none;border-color:var(--primary);background:rgba(0,242,255,0.02);box-shadow:0 0 0 4px rgba(0,242,255,.1)}
        .field input::placeholder{color:rgba(255,255,255,0.15)}
        .pw-wrap{position:relative}.pw-wrap input{padding-right:42px}
        .pw-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px}
        .auth-error{padding:12px 16px;background:rgba(255,0,80,.1);border:1px solid rgba(255,0,80,.2);border-radius:12px;color:#ff4d6a;font-size:.88rem;margin-top:8px}
        .auth-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px;background:linear-gradient(135deg,var(--secondary),var(--primary));border:none;border-radius:12px;color:#fff;font-weight:800;font-size:1.1rem;cursor:pointer;font-family:'Inter',sans-serif;box-shadow:0 10px 25px rgba(112,0,255,.3);transition:all 0.2s}
        .auth-btn:disabled{opacity:.6;cursor:not-allowed}.auth-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 15px 35px rgba(112,0,255,.4);filter:brightness(1.1)}
        .login-link-highlight {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--primary);
          text-decoration: none;
          font-weight: 800;
          font-size: 1rem;
          transition: all 0.2s;
          padding: 8px;
          border-bottom: 2px solid transparent;
        }
        .login-link-highlight:hover {
          color: #fff;
          border-bottom-color: var(--primary);
          transform: translateX(3px);
        }
        .trial-badge{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:24px;padding:12px;background:rgba(0,242,255,.05);border:1px solid rgba(0,242,255,.1);border-radius:12px;font-size:.85rem;color:var(--primary);font-weight:600}
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}
      `}</style>
    </div>
  );
}
