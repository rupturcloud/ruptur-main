import { useState } from 'react';
import { Bold, Italic, Code, Link2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MessageComposer({ value, onChange }) {
  const [showVariables, setShowVariables] = useState(false);

  const variables = [
    { name: '{{name}}', label: 'Nome' },
    { name: '{{phone}}', label: 'Telefone' },
    { name: '{{email}}', label: 'Email' },
    { name: '{{company}}', label: 'Empresa' },
  ];

  const insertVariable = (varName) => {
    const textarea = document.getElementById('message-input');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = value.slice(0, start) + varName + value.slice(end);
    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varName.length, start + varName.length);
    }, 0);
  };

  const insertFormatting = (before, after = '') => {
    const textarea = document.getElementById('message-input');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);
    const newText =
      value.slice(0, start) +
      before +
      selectedText +
      after +
      value.slice(end);
    onChange(newText);
  };

  return (
    <div className="message-composer">
      <div className="composer-toolbar">
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => insertFormatting('*', '*')}
            title="Negrito"
          >
            <Bold size={16} />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => insertFormatting('_', '_')}
            title="Itálico"
          >
            <Italic size={16} />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => insertFormatting('`', '`')}
            title="Código"
          >
            <Code size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => insertFormatting('[Link](', ')]})')}
            title="Link"
          >
            <Link2 size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${showVariables ? 'active' : ''}`}
            onClick={() => setShowVariables(!showVariables)}
            title="Adicionar variáveis"
          >
            {{}}
          </button>
        </div>

        <div style={{ flex: 1 }} />

        <div className="char-count">
          {(value || '').length} / 1000
        </div>
      </div>

      {showVariables && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="variables-panel"
        >
          <div className="variables-header">
            <p>Variáveis disponíveis</p>
          </div>
          <div className="variables-grid">
            {variables.map((v) => (
              <button
                key={v.name}
                className="variable-btn"
                onClick={() => insertVariable(v.name)}
              >
                <code>{v.name}</code>
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <textarea
        id="message-input"
        className="message-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite sua mensagem aqui... Use {{name}} para personalizar, {opção1|opção2} para variações"
        rows={8}
        maxLength={1000}
      />

      <div className="composer-hints">
        <div className="hint-item">
          <code>*texto*</code> → <strong>negrito</strong>
        </div>
        <div className="hint-item">
          <code>_texto_</code> → <em>itálico</em>
        </div>
        <div className="hint-item">
          <code>{'{' + '{name}' + '}'}</code> → personalização
        </div>
        <div className="hint-item">
          <code>{'{' + '{opção1|opção2}' + '}'}</code> → variação (anti-spam)
        </div>
      </div>

      <style jsx>{`
        .message-composer {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 12px;
        }

        .composer-toolbar {
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          flex-wrap: wrap;
        }

        .toolbar-group {
          display: flex;
          gap: 4px;
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          padding-right: 8px;
        }

        .toolbar-group:last-of-type {
          border-right: none;
        }

        .toolbar-btn {
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

        .toolbar-btn:hover {
          background: rgba(0, 242, 255, 0.1);
          color: var(--primary);
          border-color: rgba(0, 242, 255, 0.3);
        }

        .toolbar-btn.active {
          background: rgba(0, 242, 255, 0.2);
          color: var(--primary);
          border-color: rgba(0, 242, 255, 0.5);
        }

        .char-count {
          font-size: 0.75rem;
          color: var(--text-muted);
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 4px;
        }

        .variables-panel {
          background: rgba(0, 242, 255, 0.05);
          border: 1px solid rgba(0, 242, 255, 0.2);
          border-radius: 8px;
          padding: 12px;
        }

        .variables-header {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .variables-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 6px;
        }

        .variable-btn {
          padding: 8px 10px;
          background: rgba(0, 242, 255, 0.1);
          border: 1px solid rgba(0, 242, 255, 0.3);
          border-radius: 6px;
          color: var(--primary);
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
        }

        .variable-btn:hover {
          background: rgba(0, 242, 255, 0.2);
          border-color: rgba(0, 242, 255, 0.5);
        }

        .variable-btn code {
          font-weight: 600;
        }

        .variable-btn span {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .message-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 12px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 0.875rem;
          resize: vertical;
          transition: all 0.2s;
          min-height: 120px;
        }

        .message-input:focus {
          outline: none;
          border-color: rgba(0, 242, 255, 0.5);
          background: rgba(0, 242, 255, 0.05);
          box-shadow: 0 0 12px rgba(0, 242, 255, 0.1);
        }

        .composer-hints {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 8px;
          margin-top: 8px;
        }

        .hint-item {
          font-size: 0.75rem;
          color: var(--text-muted);
          padding: 8px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          border-left: 2px solid rgba(0, 242, 255, 0.3);
        }

        .hint-item code {
          color: var(--primary);
          font-size: 0.7rem;
        }
      `}</style>
    </div>
  );
}
