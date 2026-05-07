import { useAuth } from '../contexts/AuthContext';

export default function Health() {
  const { session, user, tenant, isAuthenticated } = useAuth();

  const health = {
    timestamp: new Date().toISOString(),
    authenticated: isAuthenticated,
    hasSession: !!session,
    hasUser: !!user,
    hasTenant: !!tenant,
    userEmail: user?.email,
    tenantId: tenant?.id,
    tenantName: tenant?.name,
  };

  if (!isAuthenticated) {
    return <div style={{ padding: 20 }}>Não autenticado</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Health Check</h1>
      <pre style={{ background: '#1a1a1a', color: '#0f0', fontFamily: 'monospace', padding: 16, borderRadius: 8 }}>
        {JSON.stringify(health, null, 2)}
      </pre>
    </div>
  );
}
