import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Shield, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AcceptAdminInvite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState(() => token ? 'idle' : 'error');
  const [message, setMessage] = useState(() => token ? '' : 'Token de convite ausente.');
  const currentPath = useMemo(() => {
    const query = searchParams.toString();
    return `/admin/accept-invite${query ? `?${query}` : ''}`;
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;

    if (!token) {
      return;
    }

    if (!user) {
      navigate(`/login?next=${encodeURIComponent(currentPath)}`, { replace: true });
      return;
    }

    let cancelled = false;

    async function acceptInvite() {
      setStatus('loading');
      setMessage('Validando convite...');

      try {
        const res = await fetch('/api/admin/platform/accept-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            userId: user.id,
            email: user.email,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(data.error || 'Não foi possível aceitar o convite.');
        }

        setStatus('success');
        setMessage(data.message || 'Convite aceito com sucesso.');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err.message || 'Erro inesperado ao aceitar convite.');
      }
    }

    acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [currentPath, loading, navigate, token, user]);

  const isLoading = loading || status === 'idle' || status === 'loading';
  const isSuccess = status === 'success';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg-primary, #06060e)',
      color: 'white',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 460,
        padding: '36px',
        borderRadius: 20,
        background: 'rgba(12,12,24,.78)',
        border: '1px solid rgba(255,255,255,.08)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          margin: '0 auto 20px',
          borderRadius: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isSuccess ? 'rgba(34,197,94,.12)' : status === 'error' ? 'rgba(255,68,102,.12)' : 'rgba(0,242,255,.10)',
          color: isSuccess ? '#22c55e' : status === 'error' ? '#ff4466' : '#00f2ff',
        }}>
          {isLoading ? <Loader2 size={30} className="spin" /> : isSuccess ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
        </div>

        <h1 style={{ fontSize: 24, margin: '0 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Shield size={24} />
          Convite de Superadmin
        </h1>

        <p style={{ color: 'var(--text-muted, rgba(255,255,255,.62))', lineHeight: 1.6, margin: '0 0 24px' }}>
          {isLoading ? message || 'Processando convite...' : message}
        </p>

        {isSuccess ? (
          <Link to="/admin/superadmin" style={buttonStyle}>
            Abrir painel de superadmin
          </Link>
        ) : status === 'error' ? (
          <Link to="/dashboard" style={buttonStyle}>
            Voltar para o dashboard
          </Link>
        ) : null}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; }
      `}</style>
    </div>
  );
}

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 18px',
  borderRadius: 12,
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  textDecoration: 'none',
  fontWeight: 700,
};
