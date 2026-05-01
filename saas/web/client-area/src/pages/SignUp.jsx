import React, { useState } from 'react';
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
        <p className="auth-footer">Já tem conta? <Link to="/login">Entrar</Link></p>
        <div className="trial-badge"><span>🎁</span> 50 créditos grátis • Sem compromisso</div>
      </motion.div>
      <style>{`
        .auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-primary,#0a0a14);padding:24px}
        .auth-card{width:100%;max-width:420px;padding:40px 36px;border-radius:16px;border:1px solid var(--border-glass);background:rgba(12,12,24,.85)}
        .auth-logo{display:flex;align-items:center;gap:12px;margin-bottom:32px}
        .auth-logo .logo-icon-wrap{width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,var(--secondary),var(--primary));display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 16px rgba(112,0,255,.3)}
        .auth-logo .logo-text{font-size:1.2rem;font-weight:800;letter-spacing:-.5px;font-family:'Outfit',sans-serif}
        .auth-logo .logo-text span{color:var(--primary)}
        .auth-title{font-size:1.5rem;font-weight:700;margin-bottom:6px}
        .auth-sub{font-size:.9rem;color:var(--text-muted);margin-bottom:28px}
        .auth-form{display:flex;flex-direction:column;gap:18px}
        .field label{display:block;font-size:.82rem;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
        .field input{width:100%;padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid var(--border-glass);border-radius:10px;color:#fff;font-size:.95rem;transition:border-color .2s;font-family:'Inter',sans-serif}
        .field input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,242,255,.1)}
        .field input::placeholder{color:rgba(255,255,255,.2)}
        .pw-wrap{position:relative}.pw-wrap input{padding-right:42px}
        .pw-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px}
        .auth-error{padding:10px 14px;background:rgba(255,0,80,.1);border:1px solid rgba(255,0,80,.2);border-radius:10px;color:#ff4d6a;font-size:.85rem}
        .auth-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;background:linear-gradient(135deg,var(--secondary),var(--primary));border:none;border-radius:10px;color:#fff;font-weight:700;font-size:1rem;cursor:pointer;font-family:'Inter',sans-serif;box-shadow:0 4px 20px rgba(112,0,255,.3);transition:opacity .2s}
        .auth-btn:disabled{opacity:.6;cursor:not-allowed}.auth-btn:hover:not(:disabled){opacity:.9}
        .auth-footer{text-align:center;margin-top:24px;font-size:.88rem;color:var(--text-muted)}
        .auth-footer a{color:var(--primary);text-decoration:none;font-weight:600}
        .trial-badge{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;padding:10px;background:rgba(0,242,255,.05);border:1px solid rgba(0,242,255,.1);border-radius:10px;font-size:.82rem;color:var(--primary)}
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}
      `}</style>
    </div>
  );
}
