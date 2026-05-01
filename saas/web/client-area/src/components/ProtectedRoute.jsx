/**
 * ProtectedRoute — Guarda de rotas autenticadas
 *
 * Redireciona para /login se o usuário não estiver autenticado.
 * Mostra loading enquanto verifica a sessão.
 */
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ requireAdmin = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  // Enquanto verifica sessão, mostra loading
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary, #0a0a14)',
        color: 'var(--text-primary, #fff)',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(0,242,255,0.2)',
            borderTop: '3px solid #00f2ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ opacity: 0.6 }}>Verificando sessão...</p>
        </div>
      </div>
    );
  }

  // Não autenticado → login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Rota admin, mas user não é admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
