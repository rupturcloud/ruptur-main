import React, { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import DashboardHome from './pages/DashboardHome';
import Campaigns from './pages/Campaigns';
import Wallet from './pages/Wallet';
import Inbox from './pages/Inbox';
import LoginScreen from './pages/LoginScreen';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

const ADMIN_ID = 'admin-demo';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tenantId, setTenantId] = useState(() => {
    return localStorage.getItem('ruptur_tenant_id') || null;
  });

  const handleLogin = useCallback((id) => {
    localStorage.setItem('ruptur_tenant_id', id);
    setTenantId(id);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('ruptur_tenant_id');
    setTenantId(null);
    setActiveTab('dashboard');
  }, []);

  // Tela de login se não há tenant identificado
  if (!tenantId) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Admin Panel — rota especial
  if (tenantId === ADMIN_ID) {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  // Client Dashboard
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':  return <DashboardHome tenantId={tenantId} />;
      case 'campaigns':  return <Campaigns tenantId={tenantId} />;
      case 'wallet':     return <Wallet tenantId={tenantId} />;
      case 'inbox':      return <Inbox tenantId={tenantId} />;
      default:           return <DashboardHome tenantId={tenantId} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} tenantId={tenantId} />
      <main className="main-content">
        <header className="top-header glass">
          <div className="header-right">
            <div className="tenant-pill">
              <span className="tenant-dot" />
              <span className="tenant-label">{tenantId}</span>
            </div>
          </div>
        </header>
        <div className="page-container">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
