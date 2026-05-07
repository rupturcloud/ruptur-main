/**
 * ConfirmDialog
 * Modal de confirmação reutilizável para ações críticas
 */

import React, { useEffect } from 'react';

export default function ConfirmDialog({
  title,
  message,
  danger = false,
  onConfirm,
  onCancel,
  confirmText = danger ? 'Remover' : 'Confirmar',
  cancelText = 'Cancelar',
}) {
  // Fechar ao apertar ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Fechar ao clicar fora
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        {/* Header */}
        <div className={`border-b border-gray-200 px-6 py-4 ${danger ? 'bg-red-50' : 'bg-gray-50'}`}>
          <h2 className={`text-lg font-bold ${danger ? 'text-red-900' : 'text-gray-900'}`}>
            {title}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className={`text-sm ${danger ? 'text-red-700' : 'text-gray-700'}`}>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
