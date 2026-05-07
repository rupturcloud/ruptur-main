/**
 * MembersTable
 * Tabela de membros com ações (remove, change role)
 */

import React, { useState } from 'react';

export default function MembersTable({ members, canManage, onRemove, onChangeRole }) {
  const [hoveredRow, setHoveredRow] = useState(null);

  const roleColors = {
    owner: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    member: 'bg-gray-100 text-gray-800',
  };

  const statusColors = {
    active: 'text-green-600',
    suspended: 'text-yellow-600',
    inactive: 'text-red-600',
  };

  const handleRoleChange = (userId, currentRole) => {
    const roles = ['owner', 'admin', 'member'].filter((r) => r !== currentRole);
    const newRole = roles[0]; // Simplificado para exemplo
    onChangeRole(userId, newRole);
  };

  if (!members || members.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center">
        <div className="text-gray-400 mb-2">👥</div>
        <p className="text-gray-600">Nenhum membro ainda</p>
        <p className="text-sm text-gray-500 mt-1">Convide membros para começar</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              Membro
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              Status
            </th>
            {canManage && (
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                Ações
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {members.map((member) => (
            <tr
              key={member.id}
              onMouseEnter={() => setHoveredRow(member.id)}
              onMouseLeave={() => setHoveredRow(null)}
              className={`${hoveredRow === member.id ? 'bg-gray-50' : 'hover:bg-gray-50'} transition`}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    {member.user_id?.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      Usuário {member.user_id?.slice(0, 8)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Adicionado há {getTimeAgo(member.created_at)}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {member.metadata?.email || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${roleColors[member.role] || roleColors.member}`}>
                  {member.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`text-sm font-medium ${statusColors[member.status] || statusColors.active}`}>
                  {member.status === 'active' ? '✓ Ativo' : member.status}
                </span>
              </td>
              {canManage && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  {hoveredRow === member.id && member.status === 'active' && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleRoleChange(member.user_id, member.role)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        Mudar role
                      </button>
                      <button
                        onClick={() => onRemove(member.user_id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'poucos segundos';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
