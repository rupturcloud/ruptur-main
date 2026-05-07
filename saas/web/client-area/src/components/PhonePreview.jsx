import { CheckCheck, Paperclip } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PhonePreview({
  message = '',
  mediaUrl = '',
  mediaType = 'text',
  buttons = [],
  showTimestamp = true,
}) {
  const parseFormatting = (text) => {
    if (!text) return [];

    // Split by formatting markers e variáveis
    const parts = [];

    // Regex para capturar: *bold*, _italic_, `code`, {{vars}}, {opt1|opt2}
    const patterns = [
      { regex: /\*\*(.+?)\*\*/g, tag: 'strong' },
      { regex: /_(.+?)_/g, tag: 'em' },
      { regex: /`(.+?)`/g, tag: 'code' },
      { regex: /\{\{([^}]+)\}\}/g, tag: 'variable' },
      { regex: /\{([^}|]+)\|(.+?)\}/g, tag: 'spintext' },
    ];

    let lastIndex = 0;
    const matches = [];

    patterns.forEach(({ regex, tag }) => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          tag,
          content: match[1] || match[0],
          original: match[0],
        });
      }
    });

    matches.sort((a, b) => a.start - b.start);

    lastIndex = 0;
    matches.forEach((m) => {
      if (m.start > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, m.start),
        });
      }
      parts.push({
        type: m.tag,
        content: m.content,
      });
      lastIndex = m.end;
    });

    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex),
      });
    }

    return parts;
  };

  const parts = parseFormatting(message);

  return (
    <div className="phone-preview">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="phone-frame"
      >
        {/* Phone Header */}
        <div className="phone-header">
          <div className="status-bar">
            <span className="time">9:41</span>
            <div className="status-icons">
              <span>📶</span>
              <span>🔋</span>
            </div>
          </div>
          <div className="chat-header">
            <div className="contact-info">
              <div className="avatar">👤</div>
              <div>
                <p className="contact-name">João Silva</p>
                <p className="contact-status">Online</p>
              </div>
            </div>
            <div className="chat-actions">
              <button>☎️</button>
              <button>ℹ️</button>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="messages-area">
          {/* Received Message (template) */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="message-bubble received"
            >
              {mediaUrl && mediaType !== 'text' && (
                <div className="message-media">
                  {mediaType === 'image' && (
                    <img
                      src={mediaUrl}
                      alt="preview"
                      onError={(e) => {
                        e.target.src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="120"%3E%3Crect fill="%23333" width="200" height="120"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3EImagem inválida%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  )}
                  {mediaType === 'video' && (
                    <div className="media-placeholder">
                      🎬 Vídeo
                    </div>
                  )}
                  {mediaType === 'audio' && (
                    <div className="media-placeholder">
                      🎵 Áudio
                    </div>
                  )}
                  {mediaType === 'document' && (
                    <div className="media-placeholder">
                      📄 Documento
                    </div>
                  )}
                </div>
              )}

              {message && (
                <p className="message-text">
                  {parts.map((part, idx) => {
                    if (part.type === 'text') return part.content;
                    if (part.type === 'strong')
                      return (
                        <strong key={idx} style={{ fontWeight: 600 }}>
                          {part.content}
                        </strong>
                      );
                    if (part.type === 'em')
                      return (
                        <em key={idx} style={{ fontStyle: 'italic' }}>
                          {part.content}
                        </em>
                      );
                    if (part.type === 'code')
                      return (
                        <code
                          key={idx}
                          style={{
                            background: 'rgba(255,255,255,0.1)',
                            padding: '2px 4px',
                            borderRadius: 3,
                          }}
                        >
                          {part.content}
                        </code>
                      );
                    if (part.type === 'variable')
                      return (
                        <span
                          key={idx}
                          style={{
                            color: '#ffaa00',
                            fontWeight: 500,
                            padding: '0 2px',
                          }}
                        >
                          {'{' + '{' + part.content + '}' + '}'}
                        </span>
                      );
                    if (part.type === 'spintext')
                      return (
                        <span
                          key={idx}
                          title="Variação de texto (anti-spam)"
                          style={{
                            background: 'rgba(0, 242, 255, 0.1)',
                            padding: '2px 4px',
                            borderRadius: 3,
                            cursor: 'help',
                          }}
                        >
                          {part.content}*
                        </span>
                      );
                    return part.content;
                  })}
                </p>
              )}

              {/* Buttons */}
              {buttons.length > 0 && (
                <div className="message-buttons">
                  {buttons.map((btn, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="action-button"
                    >
                      {btn.buttonText || 'Botão ' + (idx + 1)}
                    </motion.button>
                  ))}
                </div>
              )}

              {showTimestamp && (
                <div className="message-timestamp">
                  <span>9:41</span>
                  <CheckCheck size={12} />
                </div>
              )}
            </motion.div>
          )}

          {!message && (
            <div className="preview-empty">
              <p>👇 Digite sua mensagem acima para ver o preview</p>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="input-area">
          <button className="input-btn">
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            placeholder="Escrever uma mensagem..."
            disabled
          />
          <button className="input-btn">🎙️</button>
        </div>
      </motion.div>

      <style jsx>{`
        .phone-preview {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          padding: 20px;
        }

        .phone-frame {
          width: 100%;
          max-width: 320px;
          height: 600px;
          background: #fff;
          border-radius: 40px;
          border: 12px solid #000;
          border-top-width: 26px;
          border-bottom-width: 26px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          position: relative;
        }

        .phone-frame::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 140px;
          height: 24px;
          background: #000;
          border-radius: 0 0 20px 20px;
          z-index: 10;
        }

        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px 4px;
          font-size: 12px;
          color: #000;
          font-weight: 600;
          background: #f5f5f5;
        }

        .status-icons {
          display: flex;
          gap: 4px;
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: linear-gradient(135deg, #075e54 0%, #128c7e 100%);
          color: white;
        }

        .contact-info {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .contact-name {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .contact-status {
          margin: 0;
          font-size: 12px;
          opacity: 0.8;
        }

        .chat-actions {
          display: flex;
          gap: 16px;
        }

        .chat-actions button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
        }

        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 12px 8px;
          background: #ece5dd;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .messages-area::-webkit-scrollbar {
          width: 4px;
        }

        .messages-area::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 2px;
        }

        .message-bubble {
          max-width: 85%;
          padding: 8px 12px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.4;
          word-wrap: break-word;
          animation: slideIn 0.3s ease;
        }

        .message-bubble.received {
          background: #fff;
          color: #000;
          align-self: flex-start;
          border-bottom-left-radius: 2px;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
        }

        .message-text {
          margin: 0 0 4px 0;
          word-break: break-word;
        }

        .message-media {
          width: 100%;
          max-height: 150px;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 8px;
          background: rgba(0, 0, 0, 0.1);
        }

        .message-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .media-placeholder {
          width: 100%;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ddd 0%, #999 100%);
          color: #666;
          font-weight: 600;
          font-size: 14px;
        }

        .message-buttons {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 8px;
        }

        .action-button {
          padding: 10px 16px;
          background: #075e54;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-button:hover {
          background: #054a3d;
        }

        .message-timestamp {
          display: flex;
          gap: 4px;
          align-items: center;
          font-size: 11px;
          color: #999;
          margin-top: 2px;
        }

        .preview-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #999;
          font-size: 14px;
          text-align: center;
        }

        .input-area {
          display: flex;
          gap: 8px;
          padding: 8px 12px;
          background: #f5f5f5;
          border-top: 1px solid #e0e0e0;
          align-items: center;
        }

        .input-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #075e54;
        }

        .input-area input {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 20px;
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
          background: white;
        }

        @media (max-width: 480px) {
          .phone-preview {
            padding: 0;
          }

          .phone-frame {
            border-radius: 0;
            border: none;
            max-width: 100%;
          }

          .phone-frame::before {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
