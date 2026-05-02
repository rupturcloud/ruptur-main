/**
 * Layout Principal — Shell do dashboard autenticado
 *
 * Renderiza Sidebar + Header + Outlet (conteúdo da rota ativa).
 */
import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardLayout() {
  const { tenant, signOut } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('ruptur-sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    window.localStorage.setItem('ruptur-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onLogout={signOut}
        tenantId={tenant?.id}
        tenantName={tenant?.name}
      />
      <main className="main-content">
        <header className="top-header glass">
          <div className="header-right">
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
