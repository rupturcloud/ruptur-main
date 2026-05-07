/**
 * PendingInvites
 * Lista de convites pendentes com ações (cancel)
 */

import React, { useState } from 'react';

export default function PendingInvites({ invites, onCancel }) {
  const [hoveredId, setHoveredId] = useState(null);

  const getTimeUntilExpire = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const hours = Math.ceil((expires - now) / (1000 * 60 * 60));

    if (hours <= 0) return 'Expirado';
    if (hours < 24) return `${hours}h`;
    return `${Math.ceil(hours / 24)}d`;
  };

  const getExpiryColor = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const hours = (expires - now) / (1000 * 60 * 60);

    if (hours <= 0) return 'text-red-600 bg-red-50';
    if (hours < 24) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  if (!invites || invites.length === 0) {
    return (
      <div className="bg-white rounded-lg p-8 text-center">
        <div className="text-gray-400 mb-2">📧</div>
        <p className="text-gray-600">Nenhum convite pendente</p>
        <p className="text-sm text-gray-500 mt-1">Os convites pendentes aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invites.map((invite) => (
        <div
          key={invite.id}
          onMouseEnter={() => setHoveredId(invite.id)}
          onMouseLeave={() => setHoveredId(null)}
          className="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition flex items-center justify-between"
        >
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                {invite.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                <p className="text-xs text-gray-500">
                  Convidado há {getTimeAgo(invite.created_at)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Role */}
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded">
              {invite.invited_role}
            </span>

            {/* Expiry */}
            <div className={`px-3 py-1 rounded text-xs font-medium ${getExpiryColor(invite.expires_at)}`}>
              Expira em {getTimeUntilExpire(invite.expires_at)}
            </div>

            {/* Actions */}
            {hoveredId === invite.id && (
              <button
                onClick={() => onCancel(invite.id)}
                className="text-red-600 hover:text-red-900 font-medium text-sm"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      ))}
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
