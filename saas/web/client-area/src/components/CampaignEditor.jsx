import { X, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import MessageComposer from './MessageComposer';
import PhonePreview from './PhonePreview';
import ButtonBuilder from './ButtonBuilder';

export default function CampaignEditor({
  campaign,
  onCampaignChange,
  onSave,
  onCancel,
  fileInputRef,
  onFileUpload,
  csvContacts,
  onClearCsv,
  loading,
}) {

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="campaign-editor-overlay"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="campaign-editor-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="editor-header">
          <div>
            <h2>✨ Criar Nova Campanha</h2>
            <p>Editor visual com preview em tempo real</p>
          </div>
          <button className="close-btn" onClick={onCancel} title="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="editor-body">
          {/* LEFT: Form */}
          <div className="editor-left">
            {/* Basic Info */}
            <section className="form-section">
              <h4 className="section-title">📋 Informações Básicas</h4>
              <div className="form-group">
                <label>Nome da Campanha</label>
                <input
                  type="text"
                  placeholder="Ex: Oferta Especial Maio"
                  value={campaign.name}
                  onChange={(e) => onCampaignChange({ ...campaign, name: e.target.value })}
                  maxLength={50}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de Mensagem</label>
                  <select
                    value={campaign.mediaType}
                    onChange={(e) => onCampaignChange({ ...campaign, mediaType: e.target.value })}
                  >
                    <option value="text">📝 Texto Simples</option>
                    <option value="image">🖼️ Imagem (JPG/PNG)</option>
                    <option value="video">🎬 Vídeo (MP4)</option>
                    <option value="audio">🎵 Áudio (MP3)</option>
                    <option value="document">📄 Documento (PDF)</option>
                  </select>
                </div>

                {campaign.mediaType !== 'text' && (
                  <div className="form-group">
                    <label>URL da Mídia</label>
                    <input
                      type="text"
                      placeholder="https://seu-dominio.com/arquivo.jpg"
                      value={campaign.mediaUrl}
                      onChange={(e) =>
                        onCampaignChange({ ...campaign, mediaUrl: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Message Composer */}
            <section className="form-section">
              <h4 className="section-title">💬 Conteúdo da Mensagem</h4>
              <MessageComposer
                value={campaign.message}
                onChange={(text) => onCampaignChange({ ...campaign, message: text })}
              />
            </section>

            {/* Buttons */}
            <section className="form-section">
              <h4 className="section-title">🔘 Botões Interativos</h4>
              <ButtonBuilder
                buttons={campaign.buttons}
                onChange={(btns) => onCampaignChange({ ...campaign, buttons: btns })}
                maxButtons={3}
                mode="quick"
              />
            </section>

            {/* Target Audience */}
            <section className="form-section">
              <h4 className="section-title">📊 Público-Alvo</h4>
              <div className="form-group">
                <label>Selecione o público</label>
                <select
                  value={campaign.list}
                  onChange={(e) => onCampaignChange({ ...campaign, list: e.target.value })}
                >
                  <option value="leads">👥 Leads Orgânicos (1.2k)</option>
                  <option value="clients">⭐ Clientes Base (450)</option>
                  <option value="custom">📤 Upload Manual (CSV)</option>
                </select>
              </div>

              {campaign.list === 'custom' && (
                <div className="form-group">
                  <label>Upload de Contatos</label>
                  <div
                    className="upload-area"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <p>📤 Arraste ou clique para selecionar</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      CSV com colunas: phone, name, email
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={onFileUpload}
                      style={{ display: 'none' }}
                    />
                  </div>
                  {csvContacts.length > 0 && (
                    <div className="upload-status">
                      <p>✅ {csvContacts.length} contatos carregados</p>
                      <button className="btn-small" onClick={onClearCsv}>
                        Limpar
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Intervalo entre envios</label>
                <div className="input-group">
                  <input
                    type="number"
                    value={campaign.interval}
                    onChange={(e) =>
                      onCampaignChange({
                        ...campaign,
                        interval: parseInt(e.target.value) || 15,
                      })
                    }
                    min={1}
                    max={300}
                  />
                  <span className="unit">segundos</span>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT: Preview */}
          <div className="editor-right">
            <div className="preview-card">
              <h4 className="preview-title">📱 Preview do Celular</h4>
              <PhonePreview
                message={campaign.message}
                mediaUrl={campaign.mediaUrl}
                mediaType={campaign.mediaType}
                buttons={campaign.buttons}
                showTimestamp={true}
              />
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="editor-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={loading}>
            <Plus size={18} /> {loading ? 'Criando...' : 'Criar Campanha'}
          </button>
        </div>

        <style jsx>{`
          .campaign-editor-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }

          .campaign-editor-modal {
            width: 100%;
            max-width: 1200px;
            max-height: 90vh;
            background: linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(10, 15, 25, 0.95) 100%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .editor-header h2 {
            margin: 0;
            font-size: 1.3rem;
            color: white;
          }

          .editor-header p {
            margin: 6px 0 0 0;
            color: var(--text-muted);
            font-size: 0.9rem;
          }

          .close-btn {
            background: none;
            border: none;
            color: var(--text-dim);
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s;
          }

          .close-btn:hover {
            color: white;
          }

          .editor-body {
            display: grid;
            grid-template-columns: 1fr 380px;
            gap: 24px;
            padding: 24px;
            overflow-y: auto;
            flex: 1;
          }

          .editor-left {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .editor-right {
            position: sticky;
            top: 0;
            height: fit-content;
          }

          .form-section {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
          }

          .section-title {
            margin: 0 0 12px 0;
            font-size: 0.95rem;
            font-weight: 600;
            color: white;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 12px;
          }

          .form-group:last-child {
            margin-bottom: 0;
          }

          .form-group label {
            font-size: 0.8rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
          }

          .form-group input,
          .form-group select,
          .form-group textarea {
            width: 100%;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: white;
            font-size: 0.85rem;
            font-family: inherit;
            transition: all 0.2s;
          }

          .form-group input:focus,
          .form-group select:focus,
          .form-group textarea:focus {
            outline: none;
            border-color: rgba(0, 242, 255, 0.5);
            background: rgba(0, 242, 255, 0.05);
            box-shadow: 0 0 12px rgba(0, 242, 255, 0.1);
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .input-group {
            position: relative;
            display: flex;
            align-items: center;
          }

          .input-group input {
            width: 100%;
            padding-right: 60px;
          }

          .unit {
            position: absolute;
            right: 12px;
            font-size: 0.8rem;
            color: var(--text-muted);
            pointer-events: none;
          }

          .upload-area {
            border: 2px dashed rgba(0, 242, 255, 0.3);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
          }

          .upload-area:hover {
            border-color: rgba(0, 242, 255, 0.5);
            background: rgba(0, 242, 255, 0.05);
          }

          .upload-area p {
            margin: 0;
            color: white;
            font-weight: 500;
          }

          .upload-status {
            margin-top: 12px;
            padding: 12px;
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid rgba(0, 255, 136, 0.3);
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .upload-status p {
            margin: 0;
            color: #00ff88;
            font-size: 0.85rem;
            font-weight: 500;
          }

          .btn-small {
            padding: 6px 12px;
            background: rgba(0, 242, 255, 0.1);
            border: 1px solid rgba(0, 242, 255, 0.3);
            border-radius: 6px;
            color: var(--primary);
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.2s;
          }

          .btn-small:hover {
            background: rgba(0, 242, 255, 0.2);
            border-color: rgba(0, 242, 255, 0.5);
          }

          .preview-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
          }

          .preview-title {
            margin: 0 0 12px 0;
            font-size: 0.95rem;
            font-weight: 600;
            color: white;
          }

          .editor-footer {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            padding: 16px 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.02);
          }

          .btn {
            padding: 10px 20px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 500;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
          }

          .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .btn-primary {
            background: rgba(0, 242, 255, 0.8);
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background: rgba(0, 242, 255, 1);
            box-shadow: 0 0 20px rgba(0, 242, 255, 0.3);
          }

          .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
          }

          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
          }

          @media (max-width: 1024px) {
            .editor-body {
              grid-template-columns: 1fr;
            }

            .editor-right {
              position: relative;
            }
          }

          @media (max-width: 768px) {
            .campaign-editor-modal {
              max-height: 95vh;
            }

            .editor-body {
              gap: 16px;
              padding: 16px;
            }

            .form-row {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </motion.div>
    </motion.div>
  );
}
