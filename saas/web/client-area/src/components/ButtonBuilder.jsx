import { Plus, Trash2, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ButtonBuilder({ buttons = [], onChange, maxButtons = 3, mode = 'quick' }) {
  const addButton = () => {
    if (buttons.length < maxButtons) {
      onChange([
        ...buttons,
        {
          id: `btn-${Date.now()}`,
          text: '',
          type: mode === 'quick' ? 'reply' : 'url',
          value: '',
        },
      ]);
    }
  };

  const updateButton = (index, field, value) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeButton = (index) => {
    onChange(buttons.filter((_, i) => i !== index));
  };

  const duplicateButton = (index) => {
    const btn = buttons[index];
    onChange([
      ...buttons,
      {
        ...btn,
        id: `btn-${Date.now()}`,
      },
    ]);
  };

  return (
    <div className="button-builder">
      <div className="builder-header">
        <h4>
          {mode === 'quick' ? '⚡ Botões de Resposta Rápida' : '📋 Botões com Link'}
        </h4>
        <span className="button-count">
          {buttons.length} / {maxButtons}
        </span>
      </div>

      <AnimatePresence>
        {buttons.map((btn, idx) => (
          <motion.div
            key={btn.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="button-row"
          >
            <div className="button-drag-handle">
              <GripVertical size={16} />
            </div>

            <div className="button-inputs">
              <input
                type="text"
                placeholder="Texto do botão"
                value={btn.text}
                onChange={(e) => updateButton(idx, 'text', e.target.value)}
                maxLength={24}
                className="button-text-input"
              />

              {mode === 'url' && (
                <input
                  type="text"
                  placeholder="https://seu-link.com"
                  value={btn.value}
                  onChange={(e) => updateButton(idx, 'value', e.target.value)}
                  className="button-value-input"
                />
              )}

              {mode === 'quick' && (
                <input
                  type="text"
                  placeholder="ID único (ex: btn_comprar)"
                  value={btn.value}
                  onChange={(e) => updateButton(idx, 'value', e.target.value)}
                  maxLength={20}
                  className="button-id-input"
                />
              )}
            </div>

            <div className="button-actions">
              <button
                className="action-btn copy"
                onClick={() => duplicateButton(idx)}
                title="Duplicar"
              >
                📋
              </button>
              <button
                className="action-btn delete"
                onClick={() => removeButton(idx)}
                title="Deletar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {buttons.length < maxButtons && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn-add-button"
          onClick={addButton}
        >
          <Plus size={16} /> Adicionar Botão
        </motion.button>
      )}

      {buttons.length === maxButtons && (
        <div className="button-limit-reached">
          ⚠️ Limite máximo de {maxButtons} botões atingido
        </div>
      )}

      <div className="button-preview">
        <p className="preview-label">Preview:</p>
        <div className="preview-buttons">
          {buttons.length === 0 ? (
            <span className="preview-empty">Nenhum botão adicionado</span>
          ) : (
            buttons.map((btn) => (
              <motion.button
                key={btn.id}
                whileHover={{ scale: 1.05 }}
                className="preview-button"
                disabled
              >
                {btn.text || 'Botão'}
              </motion.button>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        .button-builder {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 16px;
        }

        .builder-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .builder-header h4 {
          margin: 0;
          font-size: 0.95rem;
          color: white;
        }

        .button-count {
          font-size: 0.75rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 8px;
          border-radius: 4px;
        }

        .button-row {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          animation: slideIn 0.3s ease;
        }

        .button-drag-handle {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          cursor: grab;
          padding: 4px;
        }

        .button-drag-handle:active {
          cursor: grabbing;
        }

        .button-inputs {
          flex: 1;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .button-text-input,
        .button-id-input,
        .button-value-input {
          flex: 1;
          min-width: 120px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: white;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .button-text-input::placeholder,
        .button-id-input::placeholder,
        .button-value-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .button-text-input:focus,
        .button-id-input:focus,
        .button-value-input:focus {
          outline: none;
          border-color: rgba(0, 242, 255, 0.5);
          background: rgba(0, 242, 255, 0.05);
        }

        .button-actions {
          display: flex;
          gap: 6px;
        }

        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: transparent;
          color: var(--text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: rgba(0, 242, 255, 0.1);
          color: var(--primary);
          border-color: rgba(0, 242, 255, 0.3);
        }

        .action-btn.delete:hover {
          background: rgba(255, 68, 102, 0.1);
          color: #ff4466;
          border-color: rgba(255, 68, 102, 0.3);
        }

        .btn-add-button {
          padding: 10px 16px;
          background: rgba(0, 242, 255, 0.1);
          border: 1px dashed rgba(0, 242, 255, 0.3);
          border-radius: 8px;
          color: var(--primary);
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .btn-add-button:hover {
          background: rgba(0, 242, 255, 0.2);
          border-color: rgba(0, 242, 255, 0.5);
        }

        .button-limit-reached {
          padding: 10px;
          background: rgba(255, 170, 0, 0.1);
          border: 1px solid rgba(255, 170, 0, 0.3);
          border-radius: 6px;
          color: #ffaa00;
          font-size: 0.8rem;
          text-align: center;
        }

        .button-preview {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .preview-label {
          margin: 0 0 8px 0;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .preview-buttons {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .preview-button {
          padding: 12px;
          background: rgba(7, 94, 84, 0.3);
          border: 1px solid rgba(7, 94, 84, 0.5);
          border-radius: 6px;
          color: #075e54;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: default;
          transition: all 0.2s;
          text-align: center;
        }

        .preview-button:hover {
          background: rgba(7, 94, 84, 0.4);
        }

        .preview-empty {
          display: block;
          padding: 12px;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.85rem;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .button-row {
            flex-direction: column;
            align-items: stretch;
          }

          .button-inputs {
            flex-direction: column;
          }

          .button-text-input,
          .button-id-input,
          .button-value-input {
            width: 100%;
          }

          .button-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
