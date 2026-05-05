/**
 * App.jsx — Roteamento principal com React Router
 *
 * Domínio: saas.ruptur.cloud
 * Estrutura:
 *   /login       → LoginScreen
 *   /signup      → SignUp (criar conta)
 *   /onboarding  → Wizard 3 passos (pós sign-up)
 *   /dashboard   → Dashboard do cliente
 *   /campanhas   → Gestão de campanhas
 *   /carteira    → Wallet + comprar créditos
 *   /inbox       → Mensagens
 *   /config      → Configurações
 *   /admin       → Painel administrativo (apenas admins)
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginScreen from './pages/LoginScreen';
import SignUp from './pages/SignUp';
import Onboarding from './pages/Onboarding';
import DashboardHome from './pages/DashboardHome';
import Campaigns from './pages/Campaigns';
import Wallet from './pages/Wallet';
import Inbox from './pages/Inbox';
import Instances from './pages/Instances';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AcceptAdminInvite from './pages/AcceptAdminInvite';
import AccessDenied from './pages/AccessDenied';
import './App.css';

import LandingPage from './pages/LandingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/admin/accept-invite" element={<AcceptAdminInvite />} />
        <Route path="/403" element={<AccessDenied />} />

        {/* Rotas autenticadas — Cliente */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/campanhas" element={<Campaigns />} />
            <Route path="/carteira" element={<Wallet />} />
            <Route path="/instancias" element={<Instances />} />
            <Route path="/inbox" element={<Inbox />} />
          </Route>
        </Route>

        {/* Rotas autenticadas — Admin operacional da plataforma */}
        <Route element={<ProtectedRoute requirePlatformAdmin />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* Rotas autenticadas — Superadmin */}
        <Route element={<ProtectedRoute requirePlatformAdmin />}>
          <Route path="/admin/superadmin" element={<SuperAdminDashboard />} />
        </Route>

        {/* Fallback: rotas desconhecidas → home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
