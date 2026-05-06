import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConfirmDialog({
  open = false,
  title = 'Confirmar ação',
  message = '',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isDangerous = false,
}) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(10, 15, 25, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 420,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: isDangerous ? 'rgba(255, 68, 102, 0.1)' : 'rgba(255, 170, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle
                size={20}
                color={isDangerous ? '#ff4466' : '#ffaa00'}
              />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 4px 0', color: 'white', fontSize: '1rem' }}>
                {title}
              </h3>
              <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                {message}
              </p>
            </div>
            <button
              onClick={onCancel}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'transparent',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: isDangerous ? 'rgba(255, 68, 102, 0.8)' : 'rgba(0, 242, 255, 0.8)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDangerous ? 'rgba(255, 68, 102, 1)' : 'rgba(0, 242, 255, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDangerous ? 'rgba(255, 68, 102, 0.8)' : 'rgba(0, 242, 255, 0.8)';
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
