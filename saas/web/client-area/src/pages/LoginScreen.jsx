import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Lock, Mail, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * LoginScreen — Autenticação via Supabase Auth
 */
const LoginScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return setError('Informe seu e-mail');
    if (!password) return setError('Informe sua senha');

    setLoading(true);
    try {
      await signIn(email, password);
      const next = searchParams.get('next');
      navigate(next || '/dashboard');
    } catch (err) {
      if (err.message?.includes('Invalid login')) {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(err.message || 'Erro ao fazer login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <motion.div className="login-card glass" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Logo */}
        <div className="login-header">
          <motion.div className="logo-glow" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
            <Zap size={28} fill="currentColor" />
          </motion.div>
          <h1>RUPTUR<span>CLOUD</span></h1>
          <p className="login-subtitle">Automação WhatsApp</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
          <div className="input-group">
            <div className="input-icon"><Mail size={18} /></div>
            <input type="email" placeholder="Seu e-mail" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} autoFocus autoComplete="email" />
          </div>

          <div className="input-group">
            <div className="input-icon"><Lock size={18} /></div>
            <input type={showPass ? 'text' : 'password'} placeholder="Sua senha" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" />
            <button type="button" className="pass-toggle" onClick={() => setShowPass(v => !v)}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <motion.div className="login-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              {error}
            </motion.div>
          )}

          <motion.button type="submit" className="login-btn" disabled={loading} whileTap={{ scale: 0.97 }}>
            {loading ? <Loader2 size={20} className="spin" /> : <><span>Entrar</span> <ArrowRight size={18} /></>}
          </motion.button>
        </form>

        <p className="login-footer">
          Não tem conta? <Link to="/signup">Criar conta grátis</Link>
        </p>
      </motion.div>

      <style>{`
        .login-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:var(--bg-primary,#06060e)}
        .orb{position:absolute;border-radius:50%;filter:blur(120px);opacity:.15;pointer-events:none}
        .orb-1{width:400px;height:400px;background:var(--secondary,#7000ff);top:-100px;left:-100px}
        .orb-2{width:300px;height:300px;background:var(--primary,#00f2ff);bottom:-50px;right:-50px}
        .orb-3{width:200px;height:200px;background:var(--accent,#ff007a);top:50%;left:50%;transform:translate(-50%,-50%)}
        .login-card{width:100%;max-width:400px;padding:48px 40px;border-radius:20px;background:rgba(12,12,24,.7);border:1px solid var(--border-glass,rgba(255,255,255,.06));backdrop-filter:blur(24px);position:relative;z-index:10}
        .login-header{text-align:center;margin-bottom:36px}
        .logo-glow{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,var(--secondary),var(--primary));display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#fff;box-shadow:0 6px 24px rgba(112,0,255,.4)}
        .login-header h1{font-size:1.4rem;font-weight:800;letter-spacing:-0.5px;font-family:'Outfit',sans-serif}
        .login-header h1 span{color:var(--primary)}
        .login-subtitle{font-size:.82rem;color:var(--text-muted);margin-top:4px}
        .login-form{display:flex;flex-direction:column;gap:16px}
        .input-group{position:relative;display:flex;align-items:center}
        .input-icon{position:absolute;left:14px;color:var(--text-muted);display:flex;z-index:2}
        .input-group input{width:100%;padding:14px 14px 14px 44px;background:rgba(255,255,255,.04);border:1px solid var(--border-glass);border-radius:12px;color:#fff;font-size:.95rem;transition:border-color .2s;font-family:'Inter',sans-serif}
        .input-group input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(0,242,255,.1)}
        .input-group input::placeholder{color:rgba(255,255,255,.2)}
        .pass-toggle{position:absolute;right:12px;background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;z-index:2}
        .login-error{padding:10px 14px;background:rgba(255,0,80,.1);border:1px solid rgba(255,0,80,.2);border-radius:10px;color:#ff4d6a;font-size:.85rem}
        .login-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px;background:linear-gradient(135deg,var(--secondary),var(--primary));border:none;border-radius:12px;color:#fff;font-weight:700;font-size:1rem;cursor:pointer;box-shadow:0 4px 20px rgba(112,0,255,.35);transition:opacity .2s;margin-top:4px}
        .login-btn:disabled{opacity:.6;cursor:not-allowed}.login-btn:hover:not(:disabled){opacity:.9}
        .login-footer{text-align:center;margin-top:24px;font-size:.88rem;color:var(--text-muted)}
        .login-footer a{color:var(--primary);text-decoration:none;font-weight:600}
        .login-footer a:hover{text-decoration:underline}
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}
      `}</style>
    </div>
  );
};

export default LoginScreen;
