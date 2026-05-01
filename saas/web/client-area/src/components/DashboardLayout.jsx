/**
 * Layout Principal — Shell do dashboard autenticado
 *
 * Renderiza Sidebar + Header + Outlet (conteúdo da rota ativa).
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardLayout() {
  const { tenant, signOut } = useAuth();

  return (
    <div className="app-container">
      <Sidebar onLogout={signOut} tenantId={tenant?.id} tenantName={tenant?.name} />
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
