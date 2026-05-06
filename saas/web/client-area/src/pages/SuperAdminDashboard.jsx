import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, Mail, Trash2, X, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import EnvironmentSwitcher from '../components/EnvironmentSwitcher';

const SuperAdminDashboard = ({ onLogout }) => {
  const { session, signOut } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [activeTab, setActiveTab] = useState('admins');

  // Buscar superadmins
  useEffect(() => {
    if (!session?.access_token) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Buscar superadmins ativos
        const adminsRes = await fetch('/api/admin/platform/admins', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (adminsRes.ok) {
          const adminsData = await adminsRes.json();
          setAdmins(adminsData.data || []);
        }

        // Buscar convites pendentes
        const invitesRes = await fetch('/api/admin/platform/invites', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (invitesRes.ok) {
          const invitesData = await invitesRes.json();
          setInvites(invitesData.data || []);
        }
      } catch (err) {
        console.error('Erro ao buscar dados de superadmin:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session?.access_token]);

  // Convidar novo superadmin
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    try {
      setInviting(true);
      const res = await fetch('/api/admin/platform/invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.invite) setInvites([data.invite, ...invites]);
        if (data.inviteUrl) setLastInviteUrl(data.inviteUrl);
        setInviteEmail('');
      } else {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || 'Erro ao criar convite.');
      }
    } catch (err) {
      console.error('Erro ao convidar:', err);
    } finally {
      setInviting(false);
    }
  };

  // Remover superadmin
  const handleRemove = async (adminId) => {
    if (!window.confirm('Tem certeza que deseja remover este superadmin?')) return;

    try {
      const res = await fetch('/api/admin/platform/remove', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminId }),
      });

      if (res.ok) {
        setAdmins(admins.filter(a => a.id !== adminId));
      }
    } catch (err) {
      console.error('Erro ao remover:', err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'white', fontFamily: 'Inter, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Shield size={32} style={{ color: '#667eea' }} />
              Gerenciamento de Superadmin
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
              Configure e gerencie superadministradores da plataforma Ruptur
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <EnvironmentSwitcher variant="light" />
            <button
              onClick={onLogout || signOut}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid rgba(255,68,102,0.2)',
                background: 'rgba(255,68,102,0.05)',
                color: '#ff6680',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: '0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,68,102,0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,68,102,0.05)'}
            >
              Sair
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
          {[
            { key: 'admins', label: 'Superadmins Ativos', count: admins.length },
            { key: 'invites', label: 'Convites Pendentes', count: invites.filter(i => i.status === 'pending').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === tab.key ? 'rgba(0,242,255,0.08)' : 'transparent',
                color: activeTab === tab.key ? '#00f2ff' : 'var(--text-muted)',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: '0.15s',
              }}
            >
              {tab.label} <span style={{ fontSize: '12px', opacity: 0.7 }}>({tab.count})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(0,242,255,0.2)',
              borderTop: '3px solid #00f2ff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }} />
            <p style={{ color: 'var(--text-muted)' }}>Carregando dados...</p>
          </div>
        ) : activeTab === 'admins' ? (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={() => setInviteModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: '0.15s',
                }}
              >
                <Plus size={16} /> Convidar Novo Superadmin
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {admins.length === 0 ? (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                }}>
                  <Shield size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <p>Nenhum superadmin configurado</p>
                </div>
              ) : (
                admins.map(admin => (
                  <motion.div
                    key={admin.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: '16px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                      }}>
                        {admin.email[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{admin.email}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          <CheckCircle2 size={12} style={{ marginRight: '4px', display: 'inline' }} />
                          Ativo desde {new Date(admin.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(admin.id)}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,68,102,0.2)',
                        background: 'rgba(255,68,102,0.05)',
                        color: '#ff6680',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: '0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,68,102,0.12)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,68,102,0.05)'}
                      title="Remover superadmin"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {invites.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '12px',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-muted)',
              }}>
                <Mail size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p>Nenhum convite pendente</p>
              </div>
            ) : (
              invites.map(invite => (
                <motion.div
                  key={invite.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: '16px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: 'rgba(255,170,0,0.1)',
                      border: '1px solid rgba(255,170,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffaa00',
                      fontWeight: '700',
                    }}>
                      {invite.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{invite.email}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        <Clock size={12} style={{ marginRight: '4px', display: 'inline' }} />
                        Válido até {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#ffaa00', fontWeight: '600' }}>
                    Pendente
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal de Convite */}
      <AnimatePresence>
        {inviteModal && (
          <motion.div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setInviteModal(false)}
          >
            <motion.div
              style={{
                width: '100%',
                maxWidth: '420px',
                padding: '32px',
                borderRadius: '16px',
                background: 'rgba(10,10,20,0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Convidar Superadmin</h3>
                <button
                  onClick={() => setInviteModal(false)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  Email do novo superadmin
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="admin@example.com"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-glass)',
                    background: 'rgba(255,255,255,0.02)',
                    color: 'white',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', padding: '12px', background: 'rgba(0,242,255,0.05)', borderRadius: '8px' }}>
                Um convite será criado para este email. Se o serviço de email não estiver configurado, copie o link gerado abaixo.
              </div>

              {lastInviteUrl && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                    Último link de convite
                  </label>
                  <textarea
                    readOnly
                    value={lastInviteUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    style={{
                      width: '100%',
                      minHeight: '76px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,242,255,0.25)',
                      background: 'rgba(0,242,255,0.05)',
                      color: 'white',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setInviteModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-glass)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: inviting || !inviteEmail.trim() ? 'rgba(0,242,255,0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                    opacity: inviting || !inviteEmail.trim() ? 0.6 : 1,
                  }}
                >
                  {inviting ? 'Enviando...' : 'Convidar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SuperAdminDashboard;
