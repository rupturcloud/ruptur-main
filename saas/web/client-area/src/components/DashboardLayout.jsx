/**
 * Layout Principal — Shell do dashboard autenticado
 *
 * Renderiza Sidebar + Header + Outlet (conteúdo da rota ativa).
 */
import React, { useEffect, useState } from 'react';
import { Menu, Shield } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardLayout() {
  const { tenant, signOut, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('ruptur-sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    window.localStorage.setItem('ruptur-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileSidebarOpen ? 'mobile-sidebar-open' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onLogout={signOut}
        tenantId={tenant?.id}
        tenantName={tenant?.name}
      />
      {mobileSidebarOpen && (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          aria-label="Fechar menu lateral"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <main className="main-content">
        <header className="top-header glass">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Abrir menu lateral"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="header-right">
            {isPlatformAdmin && (
              <button
                onClick={() => navigate('/admin/superadmin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '100px',
                  background: 'rgba(102, 126, 234, 0.15)',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  color: '#667eea',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: '0.15s',
                  marginRight: '12px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.25)';
                  e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                }}
              >
                <Shield size={12} />
                Superadmin
              </button>
            )}
            <div className="tenant-pill">
              <span className="tenant-dot" />
              <span className="tenant-label">
                {tenant?.name || tenant?.slug || 'Carregando...'}
              </span>
            </div>
          </div>
        </header>
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
