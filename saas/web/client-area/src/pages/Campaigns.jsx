import React, { useState, useEffect } from 'react';
import { Send, Plus, Users, MessageSquare, Clock, Filter, Trash2, Play, Pause, Upload, Layout, List } from 'lucide-react';
import { apiService } from '../services/api';
import { useApi } from '../hooks/useApi';
import { motion, AnimatePresence } from 'framer-motion';

const Campaigns = ({ tenantId }) => {
  const [showWizard, setShowWizard] = useState(false);
  const { data: campaigns, loading, request: fetchCampaigns } = useApi(apiService.getCampaigns);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    message: '',
    list: 'leads',
    interval: 15
  });
  const [csvContacts, setCsvContacts] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchCampaigns(tenantId);
  }, [tenantId, fetchCampaigns]);

   const handleCreate = async () => {
     if (!newCampaign.name || !newCampaign.message) return alert("Preencha os campos obrigatórios");
     
     // Prepare campaign data with CSV contacts if applicable
     const campaignData = {
       ...newCampaign,
       list: newCampaign.list === 'custom' && csvContacts.length > 0 ? 'custom' : newCampaign.list,
       customNumbers: newCampaign.list === 'custom' ? csvContacts.map(c => c.phone) : []
     };

     try {
       await apiService.createCampaign(tenantId, campaignData);
       setShowWizard(false);
       fetchCampaigns(tenantId);
       setNewCampaign({ name: '', message: '', list: 'leads', interval: 15 });
       setCsvContacts([]);
       if (fileInputRef.current) {
         fileInputRef.current.value = '';
       }
     } catch (err) {
       alert(err.message);
     }
   };

  const handleLaunch = async (campaignId) => {
    try {
      await apiService.launchCampaign(tenantId, campaignId);
      fetchCampaigns(tenantId);
    } catch (err) {
      alert(err.message);
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
                    placeholder="Use {{name}} para personalizar..." 
                    rows="5"
                    value={newCampaign.message}
                    onChange={e => setNewCampaign({...newCampaign, message: e.target.value})}
                  ></textarea>
                  <span className="hint">Dica: Use variações para evitar bloqueios.</span>
                </div>

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
                       {csvContacts && (
                         <div className="upload-results">
                           <p>{csvContacts.length} contatos carregados do CSV</p>
                           <button className="btn-secondary" onClear={handleClearCsv}>
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
                      <td className="text-muted">{new Date(c.createdAt || Date.now()).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div className="row-actions">
                          {c.status === 'draft' && (
                            <button className="btn-launch" onClick={() => handleLaunch(c.id)}>
                              <Play size={14} /> Disparar
                            </button>
                          )}
                          <button className="icon-btn"><Clock size={16} /></button>
                          <button className="icon-btn danger"><Trash2 size={16} /></button>
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
      `}</style>
    </div>
  );
};

export default Campaigns;
