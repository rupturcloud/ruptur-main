import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { apiService } from '../services/api';
import Toast from '../components/Toast';
import QRScanner from '../components/QRScanner';
import { formatError } from '../utils/errorHelper';
import { useInstancesRealtime } from '../hooks/useInstancesRealtime';

function getInstanceKey(instance) {
  return instance?.token || instance?.id || instance?.name;
}

function getStatusLabel(instance) {
  const status = String(instance?.status || '').toLowerCase();
  if (instance?.connected || status === 'connected' || status === 'open') return 'Conectada';
  if (status === 'connecting') return 'Aguardando conexão';
  return 'Desconectada';
}

function getStatusClass(instance) {
  const status = String(instance?.status || '').toLowerCase();
  if (instance?.connected || status === 'connected' || status === 'open') return 'connected';
  if (status === 'connecting') return 'connecting';
  return 'disconnected';
}

export default function Instances() {
  const { instances, loading, reload: loadInstances } = useInstancesRealtime();
  const [saving, setSaving] = useState(false);
  const [connectingKey, setConnectingKey] = useState('');
  const [toast, setToast] = useState(null);
  const [connectionPayload, setConnectionPayload] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerInstance, setScannerInstance] = useState(null);

  const totals = useMemo(() => {
    const connected = instances.filter((instance) => getStatusClass(instance) === 'connected').length;
    const connecting = instances.filter((instance) => getStatusClass(instance) === 'connecting').length;
    return { connected, connecting, total: instances.length };
  }, [instances]);

  async function handleCreate(event) {
    event.preventDefault();
    setConnectionPayload(null);

    const name = form.name.trim();
    if (!name) {
      setToast({ type: 'error', message: 'Informe um nome para a instância.' });
      return;
    }

    setSaving(true);
    try {
      const created = await apiService.createInstance({ name, systemName: 'ruptur-dashboard' });
      const instance = created.instance || created;
      setToast({ type: 'success', message: `Instância criada. Conectando pelo QR code...` });
      setForm((current) => ({ ...current, name: '' }));
      await loadInstances({ silent: true });

      const key = getInstanceKey(instance);
      if (key) {
        await handleConnect(instance, { phone: form.phone });
      }
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'instance') });
    } finally {
      setSaving(false);
    }
  }

  async function handleConnect(instance, options = {}) {
    const key = getInstanceKey(instance);
    if (!key) return;

    setConnectingKey(key);
    try {
      const phone = String(options.phone ?? form.phone ?? '').replace(/\D/g, '');
      const result = await apiService.connectInstance(key, phone ? { phone } : {});
      setConnectionPayload({ ...result, instance: result.instance || instance });
      setToast({ type: 'success', message: phone ? 'Código de pareamento solicitado.' : 'QR code solicitado. Escaneie no WhatsApp para conectar.' });
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'instance') });
    } finally {
      setConnectingKey('');
    }
  }

  async function refreshStatus(instance) {
    const key = getInstanceKey(instance);
    if (!key) return;
    setConnectingKey(key);
    try {
      const result = await apiService.getInstanceStatus(key);
      setConnectionPayload({ ...result, instance: result.instance || instance });
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'instance') });
    } finally {
      setConnectingKey('');
    }
  }

  function openQRScanner(instance) {
    setScannerInstance(instance);
    setShowQRScanner(true);
  }

  async function handleQRScanned() {
    setShowQRScanner(false);
    setToast({ type: 'success', message: 'QR code detectado! Conectando...' });

    // Se o valor for um token de instância, conectar automaticamente
    if (scannerInstance) {
      await handleConnect(scannerInstance, { refreshList: true });
    }

    setScannerInstance(null);
  }

  const qrCode = connectionPayload?.instance?.qrcode || connectionPayload?.qrcode;
  const paircode = connectionPayload?.instance?.paircode || connectionPayload?.paircode;

  return (
    <div className="instances-page">
      <header className="page-header instances-header">
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="eyebrow">UazAPI • instâncias WhatsApp</p>
          <h1>Conectar <span>WhatsApp</span></h1>
          <p>Crie instâncias diretamente no painel. O backend usa <code>/instance/create</code>, salva o tenant nos campos administrativos e inicia <code>/instance/connect</code>.</p>
        </motion.div>
        <button className="neon-btn outline" onClick={() => loadInstances()} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
          Atualizar
        </button>
      </header>

      <section className="stats-grid mini">
        <div className="stat-card glass"><Wifi size={20} /><strong>{totals.connected}</strong><span>online</span></div>
        <div className="stat-card glass"><QrCode size={20} /><strong>{totals.connecting}</strong><span>conectando</span></div>
        <div className="stat-card glass"><Smartphone size={20} /><strong>{totals.total}</strong><span>instâncias</span></div>
      </section>

      <div className="instances-grid">
        <section className="create-card glass neon-border">
          <h3><Plus size={18} /> Nova instância</h3>
          <p>Use um nome claro para identificar o número no dashboard, warmup, inbox e campanhas.</p>
          <form onSubmit={handleCreate}>
            <label>
              Nome da instância
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Suporte 01" />
            </label>
            <label>
              Telefone para pareamento (opcional)
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="5511999999999" inputMode="numeric" />
              <small>Sem telefone, a UazAPI retorna QR code. Com telefone, retorna código de pareamento quando disponível.</small>
            </label>
            <button className="neon-btn cyan" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
              Criar e conectar
            </button>
          </form>
        </section>

        <section className="connection-card glass">
          <h3><QrCode size={18} /> Conexão atual</h3>
          {connectionPayload ? (
            <div className="connection-box">
              <strong>{connectionPayload.instance?.name || 'Instância'}</strong>
              {qrCode ? <img src={qrCode} alt="QR code de conexão WhatsApp" /> : null}
              {paircode ? <div className="pair-code"><span>Código</span><code>{paircode}</code></div> : null}
              {!qrCode && !paircode ? <p className="text-muted">Status consultado. Se a instância estiver aguardando login, atualize em alguns segundos.</p> : null}
            </div>
          ) : (
            <div className="empty-state small">
              <QrCode size={42} />
              <p>Crie ou conecte uma instância para exibir QR code/código aqui.</p>
            </div>
          )}
        </section>
      </div>

      <section className="instances-list-card glass">
        <div className="section-header"><h3>Instâncias do tenant</h3></div>
        {loading ? (
          <div className="loading-state"><Loader2 className="spin" /> Carregando instâncias...</div>
        ) : instances.length === 0 ? (
          <div className="empty-state"><Smartphone size={42} /><p>Nenhuma instância vinculada a este tenant ainda.</p></div>
        ) : (
          <div className="instance-table">
            {instances.map((instance) => {
              const key = getInstanceKey(instance);
              const statusClass = getStatusClass(instance);
              const busy = connectingKey === key;
              return (
                <article key={key || instance.name} className="instance-row">
                  <div className={`status-orb ${statusClass}`}>{statusClass === 'connected' ? <Wifi size={16} /> : <WifiOff size={16} />}</div>
                  <div className="instance-main">
                    <strong>{instance.name || instance.id || 'Instância'}</strong>
                    <span>{instance.phone || instance.owner || instance.profileName || 'Aguardando WhatsApp'}</span>
                  </div>
                  <span className={`status-pill ${statusClass}`}>{getStatusLabel(instance)}</span>
                  <div className="row-actions">
                    <button onClick={() => refreshStatus(instance)} disabled={busy}>{busy ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />} Status</button>
                    <button onClick={() => handleConnect(instance)} disabled={busy || statusClass === 'connected'}>{busy ? <Loader2 className="spin" size={15} /> : <QrCode size={15} />} Conectar</button>
                    <button onClick={() => openQRScanner(instance)} disabled={busy || statusClass === 'connected'} title="Escanear QR code com câmera">{busy ? <Loader2 className="spin" size={15} /> : <QrCode size={15} />} Escanear</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {showQRScanner && (
        <QRScanner
          title={`Escanear QR Code — ${scannerInstance?.name || 'Instância'}`}
          onScanned={handleQRScanned}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      <style>{`
        .instances-page { display: flex; flex-direction: column; gap: 24px; }
        .instances-header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
        .eyebrow { color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; font-size: 0.75rem; font-weight: 800; margin-bottom: 8px; }
        code { color: var(--primary); background: rgba(0,242,255,0.08); padding: 2px 6px; border-radius: 6px; }
        .mini { grid-template-columns: repeat(3, minmax(150px, 1fr)); }
        .mini .stat-card { gap: 10px; padding: 18px; }
        .mini .stat-card strong { font-size: 1.6rem; }
        .mini .stat-card span { color: var(--text-muted); }
        .notice { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-radius: 14px; }
        .notice.error { color: #ff7b7b; border: 1px solid rgba(255, 123, 123, 0.22); }
        .notice.success { color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.22); }
        .instances-grid { display: grid; grid-template-columns: minmax(320px, 0.9fr) minmax(320px, 1.1fr); gap: 24px; }
        .create-card, .connection-card, .instances-list-card { border-radius: 24px; padding: 28px; }
        .create-card h3, .connection-card h3 { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .create-card p { color: var(--text-muted); font-size: 0.92rem; margin-bottom: 20px; }
        form { display: flex; flex-direction: column; gap: 16px; }
        label { display: flex; flex-direction: column; gap: 8px; color: var(--text-muted); font-size: 0.82rem; font-weight: 700; }
        input { width: 100%; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: var(--text-main); padding: 13px 14px; outline: none; }
        input:focus { border-color: rgba(0,242,255,0.45); box-shadow: 0 0 0 3px rgba(0,242,255,0.08); }
        small { color: var(--text-muted); font-weight: 500; line-height: 1.4; }
        .connection-box { display: grid; gap: 16px; place-items: center; min-height: 260px; }
        .connection-box img { max-width: 240px; width: 100%; border-radius: 18px; background: white; padding: 10px; }
        .pair-code { display: flex; flex-direction: column; gap: 8px; align-items: center; padding: 18px; border-radius: 16px; background: rgba(0,242,255,0.06); }
        .pair-code code { font-size: 1.8rem; letter-spacing: 2px; }
        .instance-table { display: flex; flex-direction: column; gap: 12px; }
        .instance-row { display: grid; grid-template-columns: 42px minmax(180px, 1fr) auto auto; gap: 14px; align-items: center; padding: 16px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
        .status-orb { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; }
        .status-orb.connected { color: #00140a; background: #00ff88; }
        .status-orb.connecting { color: #000; background: #ffcc00; }
        .status-orb.disconnected { color: var(--text-muted); background: rgba(255,255,255,0.06); }
        .instance-main { display: flex; flex-direction: column; gap: 3px; }
        .instance-main span { color: var(--text-muted); font-size: 0.83rem; }
        .status-pill { border-radius: 999px; padding: 6px 10px; font-size: 0.75rem; font-weight: 800; }
        .status-pill.connected { color: #00ff88; background: rgba(0,255,136,0.1); }
        .status-pill.connecting { color: #ffcc00; background: rgba(255,204,0,0.1); }
        .status-pill.disconnected { color: var(--text-muted); background: rgba(255,255,255,0.06); }
        .row-actions { display: flex; gap: 8px; }
        .row-actions button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: var(--text-main); border-radius: 10px; padding: 9px 11px; cursor: pointer; }
        .row-actions button:disabled, .neon-btn:disabled { opacity: 0.55; cursor: wait; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 980px) { .instances-header, .instances-grid { grid-template-columns: 1fr; display: grid; } .mini { grid-template-columns: 1fr; } .instance-row { grid-template-columns: 42px 1fr; } .status-pill, .row-actions { grid-column: 2; justify-self: start; } }
      `}</style>
    </div>
  );
}
