import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function AccessDenied() {
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
      textAlign: 'center',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 460,
        padding: '36px',
        borderRadius: 20,
        background: 'rgba(12,12,24,.78)',
        border: '1px solid rgba(255,255,255,.08)',
      }}>
        <div style={{
          width: 64,
          height: 64,
          margin: '0 auto 20px',
          borderRadius: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,68,102,.12)',
          color: '#ff4466',
        }}>
          <ShieldAlert size={32} />
        </div>

        <h1 style={{ fontSize: 26, margin: '0 0 10px' }}>Acesso negado</h1>
        <p style={{ color: 'var(--text-muted, rgba(255,255,255,.62))', lineHeight: 1.6, margin: '0 0 24px' }}>
          Sua sessão está ativa, mas seu usuário não tem permissão para acessar esta área.
        </p>

        <Link to="/dashboard" style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 18px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textDecoration: 'none',
          fontWeight: 700,
        }}>
          Voltar para o dashboard
        </Link>
      </div>
    </div>
  );
}
