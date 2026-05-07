/**
 * AuditLog
 * Timeline de auditoria (quem fez o quê e quando)
 */

import React from 'react';

export default function AuditLog({ logs }) {
  const getActionIcon = (action) => {
    const icons = {
      user_role_changed: '👤',
      user_removed_from_tenant: '🚫',
      user_status_changed: '⚠️',
      invite_sent: '📧',
      invite_accepted: '✓',
      invite_rejected: '✗',
      invite_expired: '⏰',
      action_confirmed_remove_user: '🗑️',
      action_confirmed_change_role: '↔️',
    };
    return icons[action] || '📝';
  };

  const getActionLabel = (action) => {
    const labels = {
      user_role_changed: 'Role alterada',
      user_removed_from_tenant: 'Membro removido',
      user_status_changed: 'Status alterado',
      invite_sent: 'Convite enviado',
      invite_accepted: 'Convite aceito',
      invite_rejected: 'Convite rejeitado',
      invite_expired: 'Convite expirado',
      action_confirmed_remove_user: 'Remoção confirmada',
      action_confirmed_change_role: 'Mudança de role confirmada',
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    if (action.includes('removed') || action.includes('rejected')) return 'text-red-700 bg-red-50';
    if (action.includes('accepted') || action.includes('confirmed')) return 'text-green-700 bg-green-50';
    if (action.includes('expired')) return 'text-yellow-700 bg-yellow-50';
    return 'text-blue-700 bg-blue-50';
  };

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center">
        <div className="text-gray-400 mb-2">📋</div>
        <p className="text-gray-600">Nenhuma atividade ainda</p>
        <p className="text-sm text-gray-500 mt-1">Os logs de auditoria aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {logs.map((log, idx) => (
        <div key={log.id || idx} className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="text-2xl mt-1 flex-shrink-0">
              {getActionIcon(log.action)}
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                  {getActionLabel(log.action)}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(log.created_at)}
                </span>
              </div>

              <p className="text-sm text-gray-700">
                <span className="font-medium">
                  {log.acting_as_role ? log.acting_as_role.charAt(0).toUpperCase() + log.acting_as_role.slice(1) : 'System'}
                </span>
                {' '}
                {getActionDescription(log)}
              </p>

              {/* Details */}
              {(log.old_value || log.new_value) && (
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  {log.old_value && (
                    <p>
                      <span className="text-red-600">De:</span> {JSON.stringify(log.old_value)}
                    </p>
                  )}
                  {log.new_value && (
                    <p>
                      <span className="text-green-600">Para:</span> {JSON.stringify(log.new_value)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getActionDescription(log) {
  if (log.action.includes('role_changed')) {
    return `mudou a role de um membro para ${
      log.new_value?.role || 'desconhecido'
    }`;
  }
  if (log.action.includes('removed_from_tenant')) {
    return 'removeu um membro do tenant';
  }
  if (log.action.includes('status_changed')) {
    return `alterou o status para ${log.new_value?.status || 'desconhecido'}`;
  }
  if (log.action.includes('invite_sent')) {
    return `enviou um convite para ${log.metadata?.email || 'alguém'}`;
  }
  if (log.action.includes('invite_accepted')) {
    return `aceitou o convite`;
  }
  if (log.action.includes('invite_rejected')) {
    return `rejeitou o convite`;
  }
  if (log.action.includes('invite_expired')) {
    return `convite expirou`;
  }
  if (log.action.includes('confirmed_remove_user')) {
    return `confirmou a remoção de um usuário`;
  }
  if (log.action.includes('confirmed_change_role')) {
    return `confirmou mudança de role`;
  }
  return 'realizou uma ação';
}

function formatTime(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'agora mesmo';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d atrás`;
  return date.toLocaleDateString('pt-BR');
}
