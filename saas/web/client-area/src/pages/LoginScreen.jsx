import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';

/**
 * LoginScreen — Tela de entrada da Área do Cliente
 *
 * Por enquanto faz autenticação simples por tenantId.
 * Pronto para ser substituído por autenticação real (Supabase, JWT, etc.)
 */
const LoginScreen = ({ onLogin }) => {
  const [tenantId, setTenantId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const tid = tenantId.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tid) {
      setError('Informe o ID da sua conta.');
      return;
    }

    setLoading(true);

    // TODO: Substituir por autenticação real com Supabase/JWT
    // Por enquanto aceita qualquer tenantId não-vazio com senha "ruptur" ou sem senha
    await new Promise((r) => setTimeout(r, 600)); // simula latência

    if (password && password !== 'ruptur') {
      setError('Senha inválida. (Use "ruptur" em ambiente de teste)');
      setLoading(false);
      return;
    }

    onLogin(tid);
    setLoading(false);
  };

  return (
    <div className="login-screen">
      {/* Orbs de fundo */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="login-card glass"
      >
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon">
            <Zap size={28} fill="currentColor" />
          </div>
          <div>
            <h1 className="logo-brand">RUPTUR<span>CLOUD</span></h1>
            <p className="logo-tagline">Área do Cliente</p>
          </div>
        </div>

        <div className="login-divider" />

        <h2 className="login-title">Bem-vindo de volta</h2>
        <p className="login-subtitle">Acesse sua plataforma de automações WhatsApp</p>

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Campo Tenant ID */}
          <div className="form-group">
            <label>ID da Conta</label>
            <div className="input-icon-wrapper">
              <User size={16} className="input-icon" />
              <input
                type="text"
                placeholder="ex: minha-empresa"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <span className="input-hint">Fornecido pela Ruptur ao criar sua conta</span>
          </div>

          {/* Campo Senha */}
          <div className="form-group">
            <label>Senha</label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-icon-right"
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="login-error"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            className={`btn-primary login-submit ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              <>
                Entrar <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="login-footer">
          Não tem uma conta?{' '}
          <a href="https://ruptur.cloud" target="_blank" rel="noopener noreferrer">
            Fale com a Ruptur
          </a>
        </p>
      </motion.div>

      <style>{`
        .login-screen {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-dark);
          position: relative;
          overflow: hidden;
          padding: 20px;
        }

        /* Orbs de fundo */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(112, 0, 255, 0.18) 0%, transparent 70%);
          top: -150px; left: -150px;
        }
        .orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(0, 242, 255, 0.14) 0%, transparent 70%);
          bottom: -100px; right: -100px;
        }
        .orb-3 {
          width: 250px; height: 250px;
          background: radial-gradient(circle, rgba(255, 0, 122, 0.1) 0%, transparent 70%);
          top: 50%; left: 60%;
        }

        /* Card */
        .login-card {
          width: 100%;
          max-width: 420px;
          padding: 44px 40px;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(12, 12, 18, 0.88);
          position: relative;
          z-index: 1;
        }

        /* Logo */
        .login-logo {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
        }
        .logo-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 8px 24px var(--secondary-glow);
          flex-shrink: 0;
        }
        .logo-brand {
          font-size: 1.3rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          line-height: 1.1;
          font-family: 'Outfit', sans-serif;
        }
        .logo-brand span { color: var(--primary); }
        .logo-tagline {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .login-divider {
          height: 1px;
          background: var(--border-glass);
          margin-bottom: 28px;
        }

        .login-title {
          font-size: 1.6rem;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .login-subtitle {
          font-size: 0.9rem;
          color: var(--text-muted);
          margin-bottom: 32px;
          line-height: 1.5;
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
          pointer-events: none;
          flex-shrink: 0;
        }
        .input-icon-right {
          position: absolute;
          right: 14px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
          transition: color 0.2s;
        }
        .input-icon-right:hover { color: white; }

        .input-icon-wrapper input {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-glass);
          border-radius: var(--radius-md);
          padding: 13px 16px 13px 42px;
          color: white;
          font-size: 0.95rem;
          width: 100%;
          transition: all 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .input-icon-wrapper input:focus {
          border-color: var(--primary);
          background: rgba(0, 242, 255, 0.04);
          box-shadow: 0 0 0 3px var(--primary-glow);
          outline: none;
        }

        .input-hint {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 4px;
        }

        /* Erro */
        .login-error {
          background: rgba(255, 0, 122, 0.1);
          border: 1px solid rgba(255, 0, 122, 0.3);
          color: #ff6fa8;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
        }

        /* Submit */
        .login-submit {
          width: 100%;
          justify-content: center;
          padding: 14px;
          font-size: 1rem;
          border-radius: var(--radius-md);
          margin-top: 4px;
        }
        .login-submit.loading {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Footer */
        .login-footer {
          text-align: center;
          margin-top: 28px;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .login-footer a {
          color: var(--primary);
          font-weight: 600;
          transition: opacity 0.2s;
        }
        .login-footer a:hover { opacity: 0.75; }
      `}</style>
    </div>
  );
};

export default LoginScreen;
