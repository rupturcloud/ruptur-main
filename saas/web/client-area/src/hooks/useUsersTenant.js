/**
 * useUsersTenant
 * Hook para gerenciar usuários do tenant com real-time sync
 * Integra com Supabase listeners para atualizações automáticas
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useUsersTenant(tenantId) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Buscar membros do tenant
  const fetchMembers = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from('user_tenant_roles')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setMembers(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Buscar convites pendentes
  const fetchInvites = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { data, error: err } = await supabase
        .from('user_tenant_invites')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setInvites(data || []);
    } catch (err) {
      console.error('Failed to fetch invites:', err);
    }
  }, [tenantId]);

  // Buscar logs de auditoria
  const fetchAuditLogs = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { data, error: err } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('resource_type', ['user_role', 'user_invite'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) throw err;
      setAuditLogs(data || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  }, [tenantId]);

  // Setup real-time listeners
  useEffect(() => {
    if (!tenantId) return;

    // Fetch inicial
    fetchMembers();
    fetchInvites();
    fetchAuditLogs();

    // Listener: mudanças em user_tenant_roles
    const membersSubscription = supabase
      .channel(`members:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_tenant_roles',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setMembers((prev) => {
              const filtered = prev.filter((m) => m.id !== payload.new.id);
              return [...filtered, payload.new].sort(
                (a, b) => new Date(b.created_at) - new Date(a.created_at)
              );
            });
          } else if (payload.eventType === 'DELETE') {
            setMembers((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Listener: mudanças em user_tenant_invites
    const invitesSubscription = supabase
      .channel(`invites:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_tenant_invites',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setInvites((prev) => {
              const filtered = prev.filter((i) => i.id !== payload.new.id);
              return [...filtered, payload.new].sort(
                (a, b) => new Date(b.created_at) - new Date(a.created_at)
              );
            });
          } else if (payload.eventType === 'DELETE') {
            setInvites((prev) => prev.filter((i) => i.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      membersSubscription.unsubscribe();
      invitesSubscription.unsubscribe();
    };
  }, [tenantId, fetchMembers, fetchInvites, fetchAuditLogs]);

  // Ações
  const addMember = useCallback(
    async (email, role = 'member') => {
      try {
        const response = await fetch(
          `/api/teams/${tenantId}/invites`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            },
            body: JSON.stringify({ email, role }),
          }
        );

        if (!response.ok) throw new Error('Failed to send invite');
        const { data } = await response.json();

        setInvites((prev) => [data, ...prev]);
        return { success: true, data };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [tenantId]
  );

  const removeMember = useCallback(
    async (userId, reason = '') => {
      try {
        const response = await fetch(
          `/api/teams/${tenantId}/members/${userId}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            },
            body: JSON.stringify({ reason }),
          }
        );

        if (!response.ok) throw new Error('Failed to remove member');

        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, status: 'inactive' } : m))
        );
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [tenantId]
  );

  const changeRole = useCallback(
    async (userId, newRole) => {
      try {
        const response = await fetch(
          `/api/teams/${tenantId}/members/${userId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            },
            body: JSON.stringify({ role: newRole }),
          }
        );

        if (!response.ok) throw new Error('Failed to change role');
        const { data } = await response.json();

        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
        );
        return { success: true, data };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [tenantId]
  );

  const cancelInvite = useCallback(
    async (inviteId) => {
      try {
        const response = await fetch(
          `/api/teams/${tenantId}/invites/${inviteId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            },
          }
        );

        if (!response.ok) throw new Error('Failed to cancel invite');

        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    [tenantId]
  );

  return {
    // Estado
    members,
    invites,
    auditLogs,
    loading,
    error,

    // Ações
    addMember,
    removeMember,
    changeRole,
    cancelInvite,

    // Refetch
    refetch: () => {
      fetchMembers();
      fetchInvites();
      fetchAuditLogs();
    },
  };
}
