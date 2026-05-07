/**
 * InviteModal
 * Modal para enviar convites de novo membro
 * Validação de email e seleção de role
 */

import React, { useState } from 'react';

export default function InviteModal({ onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validação básica
    if (!email || !email.includes('@')) {
      setError('Email inválido');
      setLoading(false);
      return;
    }

    const result = await onSubmit(email, role);

    if (result.success) {
      setSuccess(true);
      setEmail('');
      setRole('member');
      setMessage('');
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setError(result.error || 'Erro ao enviar convite');
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl animate-pulse">
          <div className="text-center">
            <div className="text-4xl mb-4">✓</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Convite enviado!</h3>
            <p className="text-gray-600 text-sm">
              Convite foi enviado para <span className="font-medium">{email}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Convidar Membro</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email do novo membro
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@example.com"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              O usuário receberá um email com link para aceitar o convite
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <div className="space-y-2">
              {['member', 'admin', 'owner'].map((r) => (
                <label key={r} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={loading}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="ml-3 text-sm">
                    <span className="font-medium text-gray-900 capitalize">{r}</span>
                    <span className="text-gray-500 block text-xs mt-0.5">
                      {getRoleDescription(r)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Message (opcional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensagem (opcional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Adicione uma mensagem pessoal para o convite"
              disabled={loading}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-50 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !email}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium flex items-center justify-center gap-2"
            >
              {loading && <span className="animate-spin">⟳</span>}
              {loading ? 'Enviando...' : 'Enviar Convite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getRoleDescription(role) {
  const descriptions = {
    member: 'Pode ver e usar recursos do time',
    admin: 'Pode gerenciar membros e recursos',
    owner: 'Acesso total ao time',
  };
  return descriptions[role] || '';
}
