/**
 * EnvironmentSwitcher — mostra o ambiente ativo e atalhos disponíveis por perfil.
 *
 * Ambientes:
 * - Cliente: área operacional do tenant logado.
 * - Admin: administração operacional da plataforma.
 * - Superadmin: gestão dos administradores da plataforma.
 */
import { Activity, LayoutDashboard, Shield, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ENVIRONMENTS = {
  client: {
    key: 'client',
    label: 'Cliente',
    shortLabel: 'Cliente',
    to: '/dashboard',
    icon: UserRound,
    color: '#00f2ff',
    bg: 'rgba(0,242,255,0.08)',
    border: 'rgba(0,242,255,0.22)',
  },
  admin: {
    key: 'admin',
    label: 'Admin',
    shortLabel: 'Admin',
    to: '/admin',
    icon: Activity,
    color: '#8fa2ff',
    bg: 'rgba(102,126,234,0.12)',
    border: 'rgba(102,126,234,0.32)',
  },
  superadmin: {
    key: 'superadmin',
    label: 'Superadmin',
    shortLabel: 'Superadmin',
    to: '/admin/superadmin',
    icon: Shield,
    color: '#c084fc',
    bg: 'rgba(192,132,252,0.12)',
    border: 'rgba(192,132,252,0.32)',
  },
};

function getActiveEnvironment(pathname) {
  if (pathname.startsWith('/admin/superadmin')) return 'superadmin';
  if (pathname.startsWith('/admin')) return 'admin';
  return 'client';
}

export default function EnvironmentSwitcher({ variant = 'dark', showLabel = true, className = '' }) {
  const { tenant, tenantId, isPlatformAdmin, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const activeKey = getActiveEnvironment(location.pathname);
  const activeEnv = ENVIRONMENTS[activeKey] || ENVIRONMENTS.client;

  const canOpenClient = isAuthenticated && Boolean(tenantId || tenant?.id);
  const available = [
    canOpenClient ? ENVIRONMENTS.client : null,
    isPlatformAdmin ? ENVIRONMENTS.admin : null,
    isPlatformAdmin ? ENVIRONMENTS.superadmin : null,
  ].filter(Boolean);

  if (!isAuthenticated || available.length === 0) return null;

  const surface = variant === 'light'
    ? 'rgba(255,255,255,0.05)'
    : 'rgba(0,0,0,0.18)';

  return (
    <div className={`env-switcher ${className}`} style={{ '--env-surface': surface }}>
      {showLabel && (
        <div className="env-active" title={`Ambiente ativo: ${activeEnv.label}`}>
          <LayoutDashboard size={13} />
          <span>Ambiente ativo</span>
          <strong style={{ color: activeEnv.color }}>{activeEnv.label}</strong>
        </div>
      )}

      <div className="env-shortcuts" aria-label="Atalhos de ambientes disponíveis">
        {available.map((env) => {
          const Icon = env.icon;
          const isActive = env.key === activeKey;
          return (
            <button
              key={env.key}
              type="button"
              className={`env-shortcut ${isActive ? 'active' : ''}`}
              onClick={() => !isActive && navigate(env.to)}
              disabled={isActive}
              title={isActive ? `Você está no ambiente ${env.label}` : `Ir para ${env.label}`}
              style={{
                '--env-color': env.color,
                '--env-bg': env.bg,
                '--env-border': env.border,
              }}
            >
              <Icon size={13} />
              <span>{env.shortLabel}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        .env-switcher {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .env-active {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: var(--env-surface);
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-muted, #94a3b8);
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }
        .env-active strong {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .env-shortcuts {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px;
          border-radius: 999px;
          background: var(--env-surface);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .env-shortcut {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted, #94a3b8);
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
          transition: .15s ease;
          white-space: nowrap;
        }
        .env-shortcut:hover:not(:disabled) {
          color: var(--env-color);
          background: var(--env-bg);
          border-color: var(--env-border);
        }
        .env-shortcut.active,
        .env-shortcut:disabled {
          color: var(--env-color);
          background: var(--env-bg);
          border-color: var(--env-border);
          cursor: default;
          opacity: 1;
        }
        @media (max-width: 720px) {
          .env-active span { display: none; }
          .env-shortcut span { display: none; }
          .env-shortcut { padding: 7px; }
        }
      `}</style>
    </div>
  );
}
