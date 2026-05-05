/**
 * Layout Principal — Shell do dashboard autenticado
 *
 * Renderiza Sidebar + Header + Outlet (conteúdo da rota ativa).
 */
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import EnvironmentSwitcher from './EnvironmentSwitcher';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardLayout() {
  const { tenant, signOut } = useAuth();
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
            <EnvironmentSwitcher />
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
