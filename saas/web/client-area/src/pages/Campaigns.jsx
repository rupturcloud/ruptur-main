import { useState, useEffect, useRef } from 'react';
/* eslint-disable no-unused-vars */
import { Plus, MessageSquare, Clock, Trash2, Play, Pause, Square } from 'lucide-react';
import { apiService } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { AnimatePresence } from 'framer-motion';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import CampaignEditor from '../components/CampaignEditor';
import { formatError } from '../utils/errorHelper';

const initialCampaignState = {
  name: '',
  message: '',
  list: 'leads',
  interval: 15,
  mediaType: 'text',
  mediaUrl: '',
  enableSpinText: true,
  buttonType: '',
  buttons: [{ buttonId: '', buttonText: '' }],
  sections: [{ title: '', rows: [{ title: '', description: '', rowId: '' }] }]
};

const parseCsvContacts = (csvText) => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const firstColumns = lines[0].split(',').map((column) => column.trim().toLowerCase());
  const hasHeader = firstColumns.some((column) => ['phone', 'telefone', 'name', 'nome', 'email'].includes(column));
  const headers = hasHeader ? firstColumns : ['phone', 'name', 'email'];
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .map((line) => {
      const values = line.split(',').map((value) => value.trim());
      const contact = headers.reduce((acc, header, index) => {
        acc[header] = values[index] || '';
        return acc;
      }, {});

      return {
        phone: contact.phone || contact.telefone || values[0] || '',
        name: contact.name || contact.nome || values[1] || '',
        email: contact.email || values[2] || ''
      };
    })
    .filter((contact) => contact.phone);
};

const Campaigns = () => {
  const { tenantId } = useAuth();
  const [showWizard, setShowWizard] = useState(false);
  const { data: campaigns, loading, request: fetchCampaigns } = useApi(apiService.getCampaigns);
  const [newCampaign, setNewCampaign] = useState(initialCampaignState);
  const [csvContacts, setCsvContacts] = useState([]);
  const [campaignAction, setCampaignAction] = useState('');
  const [toast, setToast] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (tenantId) fetchCampaigns(tenantId);
  }, [tenantId, fetchCampaigns]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const contacts = parseCsvContacts(text);
      setCsvContacts(contacts);

      if (contacts.length === 0) {
        setToast({ type: 'warning', message: 'Nenhum contato válido encontrado. Use colunas: phone, name, email.' });
      } else {
        setToast({ type: 'success', message: `${contacts.length} contatos carregados com sucesso.` });
      }
    } catch (err) {
      setToast({ type: 'error', message: `Não conseguimos ler o CSV. Tente novamente.` });
    }
  };

  const handleClearCsv = () => {
    setCsvContacts([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

   const handleCreate = async () => {
     if (!newCampaign.name || !newCampaign.message) {
       setToast({ type: 'error', message: 'Preencha o nome e a mensagem da campanha.' });
       return;
     }

     // Prepare campaign data with CSV contacts if applicable
     const campaignData = {
       ...newCampaign,
       list: newCampaign.list === 'custom' && csvContacts.length > 0 ? 'custom' : newCampaign.list,
       customNumbers: newCampaign.list === 'custom' ? csvContacts.map(c => c.phone) : []
     };

     try {
       await apiService.createCampaign(tenantId, campaignData);
       setToast({ type: 'success', message: `Campanha "${newCampaign.name}" criada com sucesso.` });
       setShowWizard(false);
       fetchCampaigns(tenantId);
       setNewCampaign(initialCampaignState);
       setCsvContacts([]);
       if (fileInputRef.current) {
         fileInputRef.current.value = '';
       }
     } catch (err) {
       setToast({ type: 'error', message: formatError(err, 'campaign') });
     }
   };

  const handleLaunch = async (campaignId) => {
    setCampaignAction(`launch:${campaignId}`);
    try {
      await apiService.launchCampaign(tenantId, campaignId);
      setToast({ type: 'success', message: 'Campanha iniciada.' });
      fetchCampaigns(tenantId);
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'campaign') });
    } finally {
      setCampaignAction('');
    }
  };

  const handlePause = async (campaignId) => {
    if (!window.confirm('Pausar esta campanha? Os disparos em fila serão interrompidos.')) return;
    setCampaignAction(`pause:${campaignId}`);
    try {
      await apiService.pauseCampaign(tenantId, campaignId);
      setToast({ type: 'success', message: 'Campanha pausada.' });
      fetchCampaigns(tenantId);
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'campaign') });
    } finally {
      setCampaignAction('');
    }
  };

  const handleStop = async (campaignId) => {
    if (!window.confirm('Parar esta campanha agora? A fila pendente será cancelada.')) return;
    setCampaignAction(`stop:${campaignId}`);
    try {
      await apiService.stopCampaign(tenantId, campaignId);
      setToast({ type: 'success', message: 'Campanha parada.' });
      fetchCampaigns(tenantId);
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'campaign') });
    } finally {
      setCampaignAction('');
    }
  };

  const handleDeleteClick = (campaignId) => {
    setConfirmDelete(campaignId);
  };

  const confirmDeleteCampaign = async () => {
    if (!confirmDelete) return;
    setCampaignAction(`delete:${confirmDelete}`);
    try {
      await apiService.deleteCampaign(tenantId, confirmDelete);
      setToast({ type: 'success', message: 'Campanha deletada com sucesso.' });
      fetchCampaigns(tenantId);
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'campaign') });
    } finally {
      setCampaignAction('');
      setConfirmDelete(null);
    }
  };

  return (
    <div className="campaigns-page">
      <header className="page-header">
        <div className="header-info">
          <h1>Minhas <span>Campanhas</span></h1>
          <p>Gerencie seus disparos em massa e sequências automáticas.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowWizard(true)}>
          <Plus size={20} /> Nova Campanha
        </button>
      </header>

      <AnimatePresence>
        {showWizard && (
          <CampaignEditor
            campaign={newCampaign}
            onCampaignChange={setNewCampaign}
            onSave={handleCreate}
            onCancel={() => setShowWizard(false)}
            fileInputRef={fileInputRef}
            onFileUpload={handleFileUpload}
            csvContacts={csvContacts}
            onClearCsv={handleClearCsv}
            loading={campaignAction.startsWith('create')}
          />
        )}
      </AnimatePresence>

      {/* CONFIRMAÇÃO DE DELETE */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Deletar campanha?"
        message="Esta ação não pode ser desfeita. A campanha, seu histórico e todas as métricas serão removidos permanentemente."
        confirmLabel="Deletar"
        cancelLabel="Cancelar"
        isDangerous={true}
        onConfirm={confirmDeleteCampaign}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* WIZARD ANTIGO - COMENTADO PARA FUTURE USE */}
      {/*
      <AnimatePresence>
        {showWizard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="wizard-overlay"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="wizard-modal glass"
            >
              <div className="wizard-header">
                <h2>Nova Campanha</h2>
                <p className="text-muted">Configure o seu disparo em massa</p>
              </div>
              
              <div className="wizard-body">
                <div className="form-group">
                  <label>Nome da Campanha</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Oferta Relâmpago" 
                    value={newCampaign.name}
                    onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Mensagem Principal</label>
                  <textarea 
                    placeholder="Use {{name}} para personalizar... Use {opção1|opção2} para spintext" 
                    rows="5"
                    value={newCampaign.message}
                    onChange={e => setNewCampaign({...newCampaign, message: e.target.value})}
                  ></textarea>
                  <span className="hint">{'Dica: Use variações {opção1|opção2|opção3} para evitar bloqueios por spam. Suporta {{name}}, {{phone}}, {{email}}.'}</span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de Mensagem</label>
                    <select 
                      value={newCampaign.mediaType}
                      onChange={e => setNewCampaign({...newCampaign, mediaType: e.target.value})}
                    >
                      <option value="text">Texto Simples</option>
                      <option value="image">Imagem (JPG)</option>
                      <option value="video">Vídeo (MP4)</option>
                      <option value="videoplay">Vídeo com Autoplay</option>
                      <option value="audio">Áudio (MP3/OGG)</option>
                      <option value="myaudio">Mensagem de Voz (WhatsApp)</option>
                      <option value="ptt">Vídeo Push-to-Talk</option>
                      <option value="document">Documento (PDF, DOCX, XLSX)</option>
                      <option value="sticker">Figurinha/Sticker</option>
                    </select>
                  </div>

                  {newCampaign.mediaType !== 'text' && (
                    <div className="form-group">
                      <label>URL da Mídia</label>
                      <input 
                        type="text" 
                        placeholder="https://exemplo.com/arquivo.jpg"
                        value={newCampaign.mediaUrl}
                        onChange={e => setNewCampaign({...newCampaign, mediaUrl: e.target.value})}
                      />
                      <span className="hint">URL pública ou base64 da mídia</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox"
                      checked={newCampaign.enableSpinText}
                      onChange={e => setNewCampaign({...newCampaign, enableSpinText: e.target.checked})}
                    />
                    <span>Ativar SpinText (rotação de variações)</span>
                  </label>
                  <span className="hint">Use {'{opção1|opção2}'} na mensagem para variações automáticas</span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de Botão</label>
                    <select 
                      value={newCampaign.buttonType}
                      onChange={e => setNewCampaign({...newCampaign, buttonType: e.target.value})}
                    >
                      <option value="">Sem Botão</option>
                      <option value="button">Botões de Resposta Rápida</option>
                      <option value="list">Lista de Opções</option>
                    </select>
                  </div>
                </div>

                {newCampaign.buttonType === 'button' && (
                  <div className="form-group">
                    <label>Botões (máximo 3)</label>
                    {newCampaign.buttons.map((btn, idx) => (
                      <div key={idx} className="button-config">
                        <input 
                          type="text" 
                          placeholder="ID do botão"
                          value={btn.buttonId}
                          onChange={e => {
                            const newBtns = [...newCampaign.buttons];
                            newBtns[idx] = {...btn, buttonId: e.target.value};
                            setNewCampaign({...newCampaign, buttons: newBtns});
                          }}
                        />
                        <input 
                          type="text" 
                          placeholder="Texto do botão"
                          value={btn.buttonText}
                          onChange={e => {
                            const newBtns = [...newCampaign.buttons];
                            newBtns[idx] = {...btn, buttonText: e.target.value};
                            setNewCampaign({...newCampaign, buttons: newBtns});
                          }}
                        />
                        {idx < 2 && (
                          <button type="button" onClick={() => {
                            const newBtns = [...newCampaign.buttons, { buttonId: '', buttonText: '' }];
                            setNewCampaign({...newCampaign, buttons: newBtns});
                          }}>+</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {newCampaign.buttonType === 'list' && (
                  <div className="form-group">
                    <label>Seções da Lista</label>
                    {newCampaign.sections.map((section, sIdx) => (
                      <div key={sIdx} className="section-config">
                        <input 
                          type="text" 
                          placeholder="Título da seção"
                          value={section.title}
                          onChange={e => {
                            const newSects = [...newCampaign.sections];
                            newSects[sIdx] = {...section, title: e.target.value};
                            setNewCampaign({...newCampaign, sections: newSects});
                          }}
                        />
                        {section.rows.map((row, rIdx) => (
                          <div key={rIdx} className="row-config">
                            <input placeholder="ID da linha" value={row.rowId} onChange={e => {
                              const newSects = [...newCampaign.sections];
                              newSects[sIdx].rows[rIdx] = {...row, rowId: e.target.value};
                              setNewCampaign({...newCampaign, sections: newSects});
                            }} />
                            <input placeholder="Título" value={row.title} onChange={e => {
                              const newSects = [...newCampaign.sections];
                              newSects[sIdx].rows[rIdx] = {...row, title: e.target.value};
                              setNewCampaign({...newCampaign, sections: newSects});
                            }} />
                            <input placeholder="Descrição" value={row.description} onChange={e => {
                              const newSects = [...newCampaign.sections];
                              newSects[sIdx].rows[rIdx] = {...row, description: e.target.value};
                              setNewCampaign({...newCampaign, sections: newSects});
                            }} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                 <div className="form-row">
                   <div className="form-group">
                     <label>Público Alvo</label>
                     <select 
                       value={newCampaign.list}
                       onChange={e => setNewCampaign({...newCampaign, list: e.target.value})}
                     >
                       <option value="leads">Leads Orgânicos (1.2k)</option>
                       <option value="clients">Clientes Base (450)</option>
                       <option value="custom">Upload Manual (.csv)</option>
                     </select>
                   </div>
                   {newCampaign.list === 'custom' && (
                     <div className="form-group">
                       <label>Upload Contatos CSV</label>
                       <div className="upload-area glass" onClick={() => fileInputRef.current?.click()}>
                         <Upload size={24} />
                         <p>Arraste e solte ou clique para selecionar</p>
                         <p className="text-muted">Formato CSV com colunas: phone, name, email</p>
                         <input
                           type="file"
                           accept=".csv"
                           ref={fileInputRef}
                           onChange={handleFileUpload}
                           style={{ display: 'none' }}
                         />
                       </div>
                       {csvContacts.length > 0 && (
                         <div className="upload-results">
                           <p>{csvContacts.length} contatos carregados do CSV</p>
                           <button type="button" className="btn-secondary" onClick={handleClearCsv}>
                             Limpar
                           </button>
                         </div>
                       )}
                     </div>
                   )}
                   <div className="form-group">
                     <label>Intervalo entre envios</label>
                     <div className="input-with-unit">
                       <input 
                         type="number" 
                         value={newCampaign.interval}
                         onChange={e => setNewCampaign({...newCampaign, interval: parseInt(e.target.value)})}
                       />
                       <span>seg</span>
                     </div>
                   </div>
                 </div>
              </div>

              <div className="wizard-actions">
                <button className="btn-secondary" onClick={() => setShowWizard(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleCreate}>
                  <Plus size={18} /> Criar Campanha
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="campaigns-grid">
        {loading ? (
          <div className="loading-state">Carregando campanhas...</div>
        ) : (
          <div className="table-container glass">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th>Data</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {campaigns?.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <div className="campaign-empty-state">
                        <MessageSquare size={34} />
                        <strong>Nenhuma campanha criada ainda</strong>
                        <span>Clique em “Nova Campanha” para configurar seu primeiro disparo.</span>
                      </div>
                    </td>
                  </tr>
                )}
                {campaigns?.map((c) => {
                  const sent = c.metrics?.sentCount || 0;
                  const total = c.metrics?.totalRecipients || 1;
                  const progress = Math.min(100, Math.round((sent / total) * 100));
                  
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="campaign-info">
                          <span className="name">{c.name}</span>
                          <span className="details">{total} contatos</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${c.status}`}>
                          {c.status === 'active' || c.status === 'running' ? <Play size={10} /> : <Pause size={10} />}
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <div className="progress-container">
                          <div className="progress-bar">
                            <div className="fill" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="percent">{sent} / {total}</span>
                        </div>
                      </td>
                      <td className="text-muted">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                      <td>
                        <div className="row-actions">
                          {c.status === 'draft' && (
                            <button className="btn-launch" onClick={() => handleLaunch(c.id)} disabled={campaignAction === `launch:${c.id}`}>
                              <Play size={14} /> Disparar
                            </button>
                          )}
                          {(c.status === 'active' || c.status === 'running') && (
                            <>
                              <button className="icon-btn" title="Pausar campanha" onClick={() => handlePause(c.id)} disabled={campaignAction === `pause:${c.id}`}>
                                <Pause size={16} />
                              </button>
                              <button className="icon-btn danger" title="Parar campanha" onClick={() => handleStop(c.id)} disabled={campaignAction === `stop:${c.id}`}>
                                <Square size={16} />
                              </button>
                            </>
                          )}
                          <button className="icon-btn" title="Histórico" disabled>
                            <Clock size={16} />
                          </button>
                          <button
                            className="icon-btn danger"
                            title="Deletar campanha"
                            onClick={() => handleDeleteClick(c.id)}
                            disabled={campaignAction === `delete:${c.id}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx="true">{`
        .campaigns-page { display: flex; flex-direction: column; gap: 30px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; }
        
        .table-container { padding: 10px; border-radius: 20px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 15px; text-align: left; color: var(--text-dim); font-size: 0.8rem; text-transform: uppercase; border-bottom: 1px solid var(--border-glass); }
        td { padding: 20px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); }

        .campaign-info { display: flex; flex-direction: column; gap: 4px; }
        .campaign-info .name { font-weight: 600; color: white; }
        .campaign-info .details { font-size: 0.8rem; color: var(--text-muted); }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-badge.active { background: rgba(0, 242, 255, 0.1); color: var(--primary); border: 1px solid rgba(0, 242, 255, 0.2); }
        .status-badge.paused { background: rgba(255, 200, 0, 0.1); color: #ffc800; border: 1px solid rgba(255, 200, 0, 0.2); }
        .status-badge.completed { background: rgba(0, 255, 122, 0.1); color: #00ff7a; border: 1px solid rgba(0, 255, 122, 0.2); }

        .progress-container { width: 150px; display: flex; flex-direction: column; gap: 6px; }
        .progress-bar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; }
        .progress-bar .fill { height: 100%; background: var(--primary); box-shadow: 0 0 10px var(--primary-glow); }
        .percent { font-size: 0.7rem; color: var(--text-muted); }

        .row-actions { display: flex; justify-content: flex-end; gap: 10px; }
        .icon-btn { 
          width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-glass); 
          background: transparent; color: var(--text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: 0.2s;
        }
        .icon-btn:hover { background: rgba(255,255,255,0.05); color: white; }
        .icon-btn.danger:hover { background: rgba(255, 0, 122, 0.1); color: var(--accent); border-color: var(--accent); }

        .input-with-unit { position: relative; display: flex; align-items: center; }
        .input-with-unit span { position: absolute; right: 12px; font-size: 0.8rem; color: var(--text-muted); }
        .hint { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }

        .wizard-header { margin-bottom: 25px; }
        .wizard-body { display: flex; flex-direction: column; gap: 20px; }
        .campaign-empty-state {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--text-muted);
          text-align: center;
        }
        .campaign-empty-state svg { color: var(--primary); filter: drop-shadow(0 0 12px var(--primary-glow)); }
        .campaign-empty-state strong { color: white; font-size: 1rem; }
        .upload-results { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }

        @media (max-width: 768px) {
          .page-header { align-items: stretch; flex-direction: column; gap: 16px; }
          .table-container { overflow-x: auto; }
          table { min-width: 720px; }
        }
      `}</style>
      */}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Campaigns;
