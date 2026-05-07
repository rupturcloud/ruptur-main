/**
 * TeamMembersPage
 * Página principal de gerenciamento de membros do tenant
 * Layout: left sidebar (nav) + main (tabs: Members, Invites, Audit)
 */

import React, { useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { TenantContext } from '../context/TenantContext';
import { useUsersTenant } from '../hooks/useUsersTenant';
import MembersTable from '../components/team/MembersTable';
import PendingInvites from '../components/team/PendingInvites';
import InviteModal from '../components/team/InviteModal';
import AuditLog from '../components/team/AuditLog';
import ConfirmDialog from '../components/common/ConfirmDialog';

export default function TeamMembersPage() {
  const { tenantId } = useParams();
  const { userRole } = useContext(TenantContext);
  const {
    members,
    invites,
    auditLogs,
    loading,
    error,
    addMember,
    removeMember,
    changeRole,
    cancelInvite,
  } = useUsersTenant(tenantId);

  const [activeTab, setActiveTab] = useState('members');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const canManage = ['owner', 'admin'].includes(userRole);

  // ===== HANDLERS =====

  const handleAddMember = async (email, role) => {
    const result = await addMember(email, role);
    if (result.success) {
      setShowInviteModal(false);
      // Toast success
    }
    return result;
  };

  const handleRemoveMember = async (userId) => {
    setConfirmAction({
      type: 'remove',
      userId,
      onConfirm: async () => {
        const result = await removeMember(userId, 'Removed by admin');
        if (result.success) {
          // Toast success
        }
        setShowConfirm(false);
      },
    });
    setShowConfirm(true);
  };

  const handleChangeRole = async (userId, newRole) => {
    setConfirmAction({
      type: 'changeRole',
      userId,
      newRole,
      onConfirm: async () => {
        const result = await changeRole(userId, newRole);
        if (result.success) {
          // Toast success
        }
        setShowConfirm(false);
      },
    });
    setShowConfirm(true);
  };

  const handleCancelInvite = async (inviteId) => {
    await cancelInvite(inviteId);
  };

  // ===== RENDER =====

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 p-4">
        <div className="max-w-2xl mx-auto bg-white rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-700 mb-2">Erro ao carregar dados</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Membros do Time</h1>
            <p className="text-sm text-gray-500 mt-1">
              {members.length} membro{members.length !== 1 ? 's' : ''} ativos
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + Convidar Membro
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex border-b border-gray-200 mt-4">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-3 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Membros ({members.length})
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setActiveTab('invites')}
                className={`px-4 py-3 font-medium text-sm ${
                  activeTab === 'invites'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Convites Pendentes ({invites.length})
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-3 font-medium text-sm ${
                  activeTab === 'audit'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Auditoria
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="mt-6 mb-8">
          {activeTab === 'members' && (
            <MembersTable
              members={members}
              canManage={canManage}
              onRemove={handleRemoveMember}
              onChangeRole={handleChangeRole}
            />
          )}

          {activeTab === 'invites' && canManage && (
            <PendingInvites
              invites={invites}
              onCancel={handleCancelInvite}
            />
          )}

          {activeTab === 'audit' && canManage && (
            <AuditLog logs={auditLogs} />
          )}
        </div>
      </div>

      {/* Modals */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSubmit={handleAddMember}
        />
      )}

      {showConfirm && confirmAction && (
        <ConfirmDialog
          title={
            confirmAction.type === 'remove'
              ? 'Remover membro?'
              : 'Mudar role?'
          }
          message={
            confirmAction.type === 'remove'
              ? 'Esta ação não pode ser desfeita. O membro perderá acesso ao tenant.'
              : `Mudar role para "${confirmAction.newRole}"? O usuário precisará fazer login novamente.`
          }
          danger={confirmAction.type === 'remove'}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
