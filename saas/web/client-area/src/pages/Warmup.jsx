import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Clock,
  Flame,
  Gauge,
  History,
  ListChecks,
  Loader2,
  MessageSquareText,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Smartphone,
  Square,
  Zap,
} from 'lucide-react';
import { apiService } from '../services/api';
import Toast from '../components/Toast';
import { formatError } from '../utils/errorHelper';

const TABS = [
  { key: 'overview', label: 'Visão geral', icon: BarChart3 },
  { key: 'instances', label: 'Instâncias', icon: Smartphone },
  { key: 'routines', label: 'Rotinas', icon: ListChecks },
  { key: 'pool', label: 'Grupos & pool', icon: Activity },
  { key: 'telemetry', label: 'Telemetria', icon: Gauge },
  { key: 'regeneration', label: 'Auto-regeneração', icon: RotateCcw },
  { key: 'settings', label: 'Configurações', icon: Settings },
];

const DEFAULT_SETTINGS = {
  warmupMinIntervalMs: 120000,
  warmupMaxDailyPerInstance: 250,
  warmupCooldownRounds: 1,
  antiBanMaxPerMinute: 8,
  warmupReadChat: false,
  warmupReadMessages: false,
  warmupAsync: true,
};

function toDateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function stageLabel(stage) {
  const map = {
    eligible: 'Elegível',
    waiting: 'Aguardando',
    blocked: 'Bloqueada',
    regenerating: 'Regenerando',
  };
  return map[stage] || stage || 'Sem dados';
}

function schedulerLabel(status) {
  const map = { active: 'Ativo', paused: 'Pausado', stopped: 'Parado', error: 'Erro' };
  return map[status] || status || 'Indefinido';
}

function normalizeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    warmupMinIntervalMs: Number(settings.warmupMinIntervalMs ?? DEFAULT_SETTINGS.warmupMinIntervalMs),
    warmupMaxDailyPerInstance: Number(settings.warmupMaxDailyPerInstance ?? DEFAULT_SETTINGS.warmupMaxDailyPerInstance),
    warmupCooldownRounds: Number(settings.warmupCooldownRounds ?? DEFAULT_SETTINGS.warmupCooldownRounds),
    antiBanMaxPerMinute: Number(settings.antiBanMaxPerMinute ?? DEFAULT_SETTINGS.antiBanMaxPerMinute),
    warmupReadChat: Boolean(settings.warmupReadChat),
    warmupReadMessages: Boolean(settings.warmupReadMessages),
    warmupAsync: settings.warmupAsync !== false,
  };
}

function makeRoutine() {
  return {
    id: `client-routine-${Date.now()}`,
    name: 'Nova rotina de aquecimento',
    mode: 'one-to-one',
    senderInstances: [],
    receiverInstances: [],
    messages: [],
    delayMin: 8,
    delayMax: 20,
    isActive: true,
    createdAt: new Date().toISOString(),
    totalSent: 0,
  };
}

function makeMessage() {
  return {
    id: `client-message-${Date.now()}`,
    name: 'Nova mensagem',
    text: 'Oi, tudo certo por aí?',
    category: 'Saudação',
    createdAt: new Date().toISOString(),
  };
}

function StatCard({ icon, label, value, hint, tone = 'cyan' }) {
  return (
    <div className={`warmup-stat glass ${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="warmup-empty">
      {icon}
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

export default function Warmup() {
  const [activeTab, setActiveTab] = useState('overview');
  const [snapshot, setSnapshot] = useState(null);
  const [config, setConfig] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [routines, setRoutines] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState('');
  const [toast, setToast] = useState(null);

  async function loadWarmup({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const [stateData, configData] = await Promise.all([
        apiService.getWarmupState(),
        apiService.getWarmupConfig(),
      ]);
      setSnapshot(stateData);
      setConfig(configData);
      setSettings(normalizeSettings(configData.settings));
      setRoutines(Array.isArray(configData.routines) ? configData.routines : []);
      setMessages(Array.isArray(configData.messages) ? configData.messages : []);
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'warmup') });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadWarmup());
  }, []);

  const summary = snapshot?.summary || {};
  const scheduler = snapshot?.scheduler || {};
  const instances = useMemo(() => snapshot?.instanceStates || [], [snapshot]);
  const logs = snapshot?.recentLogs || [];
  const auditTrail = snapshot?.auditTrail || [];

  const health = useMemo(() => {
    if (!instances.length) return { avg: 0, eligible: 0, blocked: 0, waiting: 0 };
    const avg = Math.round(instances.reduce((sum, instance) => sum + Number(instance.heatScore || 0), 0) / instances.length);
    return {
      avg,
      eligible: instances.filter((instance) => instance.eligibleNow).length,
      blocked: instances.filter((instance) => instance.heatStage === 'blocked').length,
      waiting: instances.filter((instance) => ['waiting', 'regenerating'].includes(instance.heatStage)).length,
    };
  }, [instances]);

  async function runControl(kind) {
    if ((kind === 'pause' || kind === 'stop') && !window.confirm(`Tem certeza? O aquecimento será ${kind === 'pause' ? 'pausado' : 'parado'}.`)) {
      return;
    }

    setAction(kind);
    try {
      const reason = `Ação ${kind} executada pelo dashboard do cliente`;
      let result;
      if (kind === 'start') result = await apiService.startWarmup(reason);
      if (kind === 'pause') result = await apiService.pauseWarmup(reason);
      if (kind === 'stop') result = await apiService.stopWarmup(reason);
      if (kind === 'restart') result = await apiService.restartWarmup(reason);
      if (kind === 'tick') result = await apiService.tickWarmup(reason);
      setSnapshot(result);
      setToast({ type: 'success', message: 'Ação executada com sucesso.' });
      await loadWarmup({ silent: true });
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'warmup') });
    } finally {
      setAction('');
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const result = await apiService.syncWarmupConfig({ settings, routines, messages });
      setSnapshot(result);
      setToast({ type: 'success', message: 'Configuração salva com sucesso.' });
      await loadWarmup({ silent: true });
    } catch (err) {
      setToast({ type: 'error', message: formatError(err, 'warmup') });
    } finally {
      setSaving(false);
    }
  }

  function updateRoutine(index, patch) {
    setRoutines((current) => current.map((routine, idx) => idx === index ? { ...routine, ...patch } : routine));
  }

  function updateMessage(index, patch) {
    setMessages((current) => current.map((message, idx) => idx === index ? { ...message, ...patch } : message));
  }

  return (
    <div className="warmup-page">
      <header className="warmup-hero glass">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="hero-title-row">
            <div className="hero-icon"><Flame size={24} /></div>
            <div>
              <h1>Aquecimento de <span>contas WhatsApp</span></h1>
              <p>Controle o Warmup 24/7 dentro da área do cliente: saúde das instâncias, rotinas, mensagens, cadência, logs e operação segura.</p>
            </div>
          </div>
        </motion.div>
        <div className="hero-actions">
          <button className="neon-btn outline" onClick={() => loadWarmup()} disabled={loading}>
            {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Atualizar
          </button>
          <button className="neon-btn cyan" onClick={() => runControl('tick')} disabled={Boolean(action)}>
            {action === 'tick' ? <Loader2 className="spin" size={16} /> : <Zap size={16} />} Pulso agora
          </button>
        </div>
      </header>

      <section className="warmup-controls glass">
        <div>
          <span className={`runtime-dot ${scheduler.enabled ? 'active' : 'paused'}`} />
          <strong>{schedulerLabel(scheduler.status)}</strong>
          <small>Último pulso: {toDateLabel(scheduler.lastTickAt)}</small>
        </div>
        <div className="control-buttons">
          <button onClick={() => runControl('start')} disabled={Boolean(action) || scheduler.enabled}>{action === 'start' ? <Loader2 className="spin" size={15} /> : <Play size={15} />} Iniciar</button>
          <button onClick={() => runControl('pause')} disabled={Boolean(action) || !scheduler.enabled}>{action === 'pause' ? <Loader2 className="spin" size={15} /> : <Pause size={15} />} Pausar</button>
          <button onClick={() => runControl('stop')} disabled={Boolean(action)}>{action === 'stop' ? <Loader2 className="spin" size={15} /> : <Square size={15} />} Parar</button>
          <button onClick={() => runControl('restart')} disabled={Boolean(action)}>{action === 'restart' ? <Loader2 className="spin" size={15} /> : <RotateCcw size={15} />} Reiniciar</button>
        </div>
      </section>

      <nav className="warmup-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </nav>

      {loading ? (
        <div className="warmup-loading glass"><Loader2 className="spin" /> Carregando aquecimento...</div>
      ) : (
        <main className="warmup-surface">
          {activeTab === 'overview' && (
            <>
              <section className="warmup-stats-grid">
                <StatCard icon={<Smartphone size={22} />} label="Instâncias" value={summary.totalInstances || instances.length || 0} hint={`${health.eligible} elegíveis`} />
                <StatCard icon={<Flame size={22} />} label="Aquecendo agora" value={summary.heatingNow || 0} hint={`${summary.queuedEntries || 0} na fila`} tone="green" />
                <StatCard icon={<Gauge size={22} />} label="Saúde média" value={`${health.avg}%`} hint={`${health.blocked} bloqueadas`} tone="purple" />
                <StatCard icon={<MessageSquareText size={22} />} label="Enviadas hoje" value={summary.sentToday || 0} hint={`${routines.filter((r) => r.isActive).length} rotinas ativas`} tone="orange" />
              </section>

              <section className="warmup-two-col">
                <div className="warmup-panel glass">
                  <h3><Activity size={18} /> Operação em tempo real</h3>
                  <div className="operation-grid">
                    <div><span>Status</span><strong>{schedulerLabel(scheduler.status)}</strong></div>
                    <div><span>Rodada</span><strong>{scheduler.round || 0}</strong></div>
                    <div><span>Cadência</span><strong>{summary.cadenceBpm || 0}/min</strong></div>
                    <div><span>Pool persistente</span><strong>{summary.persistentPoolSize || 0}</strong></div>
                  </div>
                </div>
                <div className="warmup-panel glass">
                  <h3><ShieldAlert size={18} /> Proteção anti-ban</h3>
                  <p>O runtime respeita intervalo mínimo, limite diário por instância, cooldown, elegibilidade, saúde da conta e kill switch operacional.</p>
                  <div className="risk-row"><span>Intervalo mínimo</span><strong>{Math.round(Number(settings.warmupMinIntervalMs || 0) / 60000)} min</strong></div>
                  <div className="risk-row"><span>Limite diário</span><strong>{settings.warmupMaxDailyPerInstance}/instância</strong></div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'instances' && (
            <section className="warmup-panel glass">
              <h3><Smartphone size={18} /> Instâncias em aquecimento</h3>
              {instances.length ? (
                <div className="warmup-table instances">
                  {instances.map((instance) => (
                    <article key={instance.instanceToken || instance.instanceName}>
                      <div>
                        <strong>{instance.instanceName || 'Instância'}</strong>
                        <small>{instance.resolvedNumber || 'Número não resolvido'}</small>
                      </div>
                      <span className={`stage ${instance.heatStage || 'blocked'}`}>{stageLabel(instance.heatStage)}</span>
                      <div className="heatbar"><span style={{ width: `${Math.max(0, Math.min(100, Number(instance.heatScore || 0)))}%` }} /></div>
                      <span>{instance.sentToday || 0} hoje</span>
                      <small>{instance.eligibilityReason || 'Sem motivo registrado'}</small>
                    </article>
                  ))}
                </div>
              ) : <EmptyState icon={<Smartphone size={42} />} title="Nenhuma instância do tenant" text="Conecte uma instância para começar o aquecimento." />}
            </section>
          )}

          {activeTab === 'routines' && (
            <section className="warmup-panel glass">
              <div className="panel-toolbar">
                <h3><ListChecks size={18} /> Rotinas de aquecimento</h3>
                <button onClick={() => setRoutines((current) => [...current, makeRoutine()])}><ListChecks size={15} /> Nova rotina</button>
              </div>
              <div className="editor-list">
                {routines.map((routine, index) => (
                  <article className="editor-card" key={routine.id || index}>
                    <input value={routine.name || ''} onChange={(e) => updateRoutine(index, { name: e.target.value })} placeholder="Nome da rotina" />
                    <div className="editor-row">
                      <select value={routine.mode || 'one-to-one'} onChange={(e) => updateRoutine(index, { mode: e.target.value })}>
                        <option value="one-to-one">1 para 1</option>
                        <option value="group">Grupo</option>
                      </select>
                      <label><input type="checkbox" checked={routine.isActive !== false} onChange={(e) => updateRoutine(index, { isActive: e.target.checked })} /> Ativa</label>
                      <input type="number" min="1" value={routine.delayMin || 8} onChange={(e) => updateRoutine(index, { delayMin: Number(e.target.value) })} />
                      <input type="number" min="1" value={routine.delayMax || 20} onChange={(e) => updateRoutine(index, { delayMax: Number(e.target.value) })} />
                    </div>
                    <small>{routine.senderCount ?? (routine.senderInstances || []).length} origens · {routine.receiverCount ?? (routine.receiverInstances || []).length} destinos · {routine.messageCount ?? (routine.messages || []).length} mensagens · {routine.totalSent || 0} envios</small>
                  </article>
                ))}
                {!routines.length && <EmptyState icon={<ListChecks size={42} />} title="Sem rotinas" text="Crie uma rotina para organizar ciclos de aquecimento." />}
              </div>
              <button className="save-config" onClick={saveConfig} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Salvar rotinas</button>
            </section>
          )}

          {activeTab === 'messages' && (
            <section className="warmup-panel glass">
              <div className="panel-toolbar">
                <h3><MessageSquareText size={18} /> Biblioteca de mensagens</h3>
                <button onClick={() => setMessages((current) => [...current, makeMessage()])}><MessageSquareText size={15} /> Nova mensagem</button>
              </div>
              <div className="editor-list">
                {messages.map((message, index) => (
                  <article className="editor-card message" key={message.id || index}>
                    <div className="editor-row">
                      <input value={message.name || ''} onChange={(e) => updateMessage(index, { name: e.target.value })} placeholder="Nome" />
                      <input value={message.category || ''} onChange={(e) => updateMessage(index, { category: e.target.value })} placeholder="Categoria" />
                    </div>
                    <textarea value={message.text || ''} onChange={(e) => updateMessage(index, { text: e.target.value })} placeholder="Texto da mensagem" rows={3} />
                  </article>
                ))}
                {!messages.length && <EmptyState icon={<MessageSquareText size={42} />} title="Sem mensagens" text="Cadastre variações naturais para reduzir padrão repetitivo." />}
              </div>
              <button className="save-config" onClick={saveConfig} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Salvar mensagens</button>
            </section>
          )}

          {activeTab === 'pool' && (
            <section className="warmup-two-col">
              <div className="warmup-panel glass">
                <h3><Activity size={18} /> Pool persistente</h3>
                <div className="operation-grid">
                  <div><span>Tokens saudáveis</span><strong>{snapshot?.currentPool?.persistent?.healthyTokens?.length || summary.persistentPoolSize || 0}</strong></div>
                  <div><span>Tokens prontos</span><strong>{snapshot?.currentPool?.persistent?.readyTokens?.length || 0}</strong></div>
                  <div><span>Subpools</span><strong>{summary.subpoolCount || 0}</strong></div>
                  <div><span>Fila atual</span><strong>{snapshot?.currentPool?.entries?.length || summary.queuedEntries || 0}</strong></div>
                </div>
              </div>
              <div className="warmup-panel glass">
                <h3><ListChecks size={18} /> Próximos pares</h3>
                <div className="log-list">
                  {(snapshot?.currentPool?.entries || []).slice(0, 40).map((entry, index) => (
                    <div key={entry.trackId || index}>
                      <strong>{entry.senderName || entry.senderToken || 'Origem'} → {entry.receiverName || entry.receiverToken || 'Destino'}</strong>
                      <span>{entry.routineName || 'Rotina'} · {entry.status || 'na fila'}</span>
                    </div>
                  ))}
                  {!(snapshot?.currentPool?.entries || []).length && <EmptyState icon={<Activity size={42} />} title="Pool sem fila" text="Quando houver instâncias elegíveis, os pares de aquecimento aparecerão aqui." />}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'telemetry' && (
            <section className="warmup-two-col">
              <div className="warmup-panel glass">
                <h3><Gauge size={18} /> Telemetria do runtime</h3>
                <div className="operation-grid">
                  <div><span>Janela de atividade</span><strong>{toDateLabel(snapshot?.activityMeta?.windowStartedAt)}</strong></div>
                  <div><span>Versão da janela</span><strong>{snapshot?.activityMeta?.windowVersion || '—'}</strong></div>
                  <div><span>Tick interval</span><strong>{Math.round(Number(scheduler.tickIntervalMs || 0) / 1000)}s</strong></div>
                  <div><span>Última sincronização</span><strong>{toDateLabel(config?.lastSyncedAt || snapshot?.configMeta?.lastSyncedAt)}</strong></div>
                </div>
              </div>
              <div className="warmup-panel glass">
                <h3><ShieldAlert size={18} /> Device Lab / Proxy</h3>
                <div className="warmup-table instances">
                  {instances.map((instance) => (
                    <article key={`proxy-${instance.instanceToken || instance.instanceName}`}>
                      <div><strong>{instance.instanceName || 'Instância'}</strong><small>{instance.resolvedNumber || 'sem número'}</small></div>
                      <span className={`stage ${instance.proxyStatus === 'error' ? 'blocked' : 'eligible'}`}>{instance.proxyStatus || 'unknown'}</span>
                      <div className="heatbar"><span style={{ width: `${instance.proxyStatus === 'error' ? 20 : 85}%` }} /></div>
                      <span>{instance.proxy?.managed ? 'managed' : instance.proxy?.proxy_url ? 'custom' : 'interno'}</span>
                      <small>{instance.proxy?.validation_error || instance.proxy?.proxy_url || 'Sem alerta de proxy'}</small>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'regeneration' && (
            <section className="warmup-panel glass">
              <h3><RotateCcw size={18} /> Auto-regeneração e kill switch</h3>
              <div className="warmup-table instances">
                {instances.filter((instance) => instance.heatStage === 'regenerating' || Number(instance.heatScore || 0) < 40 || String(instance.eligibilityReason || '').includes('KILL SWITCH')).map((instance) => (
                  <article key={`regen-${instance.instanceToken || instance.instanceName}`}>
                    <div><strong>{instance.instanceName || 'Instância'}</strong><small>{instance.resolvedNumber || 'Número não resolvido'}</small></div>
                    <span className={`stage ${instance.heatStage || 'blocked'}`}>{stageLabel(instance.heatStage)}</span>
                    <div className="heatbar"><span style={{ width: `${Math.max(0, Math.min(100, Number(instance.heatScore || 0)))}%` }} /></div>
                    <span>{instance.heatScore || 0}%</span>
                    <small>{instance.eligibilityReason || 'Aguardando leitura da próxima rodada'}</small>
                  </article>
                ))}
                {!instances.some((instance) => instance.heatStage === 'regenerating' || Number(instance.heatScore || 0) < 40 || String(instance.eligibilityReason || '').includes('KILL SWITCH')) && (
                  <EmptyState icon={<RotateCcw size={42} />} title="Sem regeneração ativa" text="Nenhuma instância do tenant está em regeneração ou kill switch agora." />
                )}
              </div>
            </section>
          )}

          {activeTab === 'reports' && (
            <section className="warmup-two-col">
              <div className="warmup-panel glass">
                <h3><BarChart3 size={18} /> Relatório operacional</h3>
                <div className="operation-grid">
                  <div><span>Enviadas hoje</span><strong>{summary.sentToday || 0}</strong></div>
                  <div><span>Elegíveis</span><strong>{health.eligible}</strong></div>
                  <div><span>Aguardando</span><strong>{health.waiting}</strong></div>
                  <div><span>Bloqueadas</span><strong>{health.blocked}</strong></div>
                </div>
              </div>
              <div className="warmup-panel glass">
                <h3><Clock size={18} /> Próximas elegibilidades</h3>
                <div className="log-list">
                  {instances.filter((instance) => instance.nextEligibleAt).sort((a, b) => new Date(a.nextEligibleAt) - new Date(b.nextEligibleAt)).slice(0, 30).map((instance) => (
                    <div key={`next-${instance.instanceToken || instance.instanceName}`}>
                      <strong>{instance.instanceName || 'Instância'}</strong>
                      <span>{toDateLabel(instance.nextEligibleAt)} · {instance.eligibilityReason || 'aguardando'}</span>
                    </div>
                  ))}
                  {!instances.some((instance) => instance.nextEligibleAt) && <EmptyState icon={<Clock size={42} />} title="Sem agenda pendente" text="As próximas janelas aparecem depois dos primeiros ciclos." />}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'logs' && (
            <section className="warmup-two-col logs">
              <div className="warmup-panel glass">
                <h3><History size={18} /> Logs recentes</h3>
                <div className="log-list">
                  {logs.map((log, index) => <div key={`${log.createdAt || log.timestamp || index}`}><strong>{log.message || log.status || 'Evento'}</strong><span>{log.instanceName || 'Runtime'} · {toDateLabel(log.createdAt || log.timestamp)}</span></div>)}
                  {!logs.length && <EmptyState icon={<History size={42} />} title="Sem logs" text="Os eventos aparecerão aqui quando o runtime operar." />}
                </div>
              </div>
              <div className="warmup-panel glass">
                <h3><ShieldAlert size={18} /> Auditoria</h3>
                <div className="log-list">
                  {auditTrail.slice(0, 30).map((item, index) => <div key={`${item.createdAt || item.timestamp || index}`}><strong>{item.action || item.type || 'Ação'}</strong><span>{item.actor || 'Sistema'} · {toDateLabel(item.createdAt || item.timestamp)}</span></div>)}
                  {!auditTrail.length && <EmptyState icon={<ShieldAlert size={42} />} title="Sem auditoria" text="Ações manuais e overrides aparecerão aqui." />}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="warmup-panel glass settings-panel">
              <h3><Settings size={18} /> Configurações seguras do aquecimento</h3>
              <p>Por segurança, credenciais do runtime e token administrativo não aparecem aqui. O cliente controla cadência, limites, leitura e modo assíncrono.</p>
              <div className="settings-grid">
                <label>Intervalo mínimo entre envios (min)<input type="number" min="1" value={Math.round(Number(settings.warmupMinIntervalMs || 0) / 60000)} onChange={(e) => setSettings({ ...settings, warmupMinIntervalMs: Number(e.target.value) * 60000 })} /></label>
                <label>Limite diário por instância<input type="number" min="1" value={settings.warmupMaxDailyPerInstance || 1} onChange={(e) => setSettings({ ...settings, warmupMaxDailyPerInstance: Number(e.target.value) })} /></label>
                <label>Cooldown em rodadas<input type="number" min="0" value={settings.warmupCooldownRounds || 0} onChange={(e) => setSettings({ ...settings, warmupCooldownRounds: Number(e.target.value) })} /></label>
                <label>Anti-ban máximo por minuto<input type="number" min="1" value={settings.antiBanMaxPerMinute || 1} onChange={(e) => setSettings({ ...settings, antiBanMaxPerMinute: Number(e.target.value) })} /></label>
              </div>
              <div className="toggle-grid">
                <label><input type="checkbox" checked={settings.warmupReadChat} onChange={(e) => setSettings({ ...settings, warmupReadChat: e.target.checked })} /> Simular leitura de chat</label>
                <label><input type="checkbox" checked={settings.warmupReadMessages} onChange={(e) => setSettings({ ...settings, warmupReadMessages: e.target.checked })} /> Simular leitura de mensagens</label>
                <label><input type="checkbox" checked={settings.warmupAsync} onChange={(e) => setSettings({ ...settings, warmupAsync: e.target.checked })} /> Envio assíncrono</label>
              </div>
              <button className="save-config" onClick={saveConfig} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Salvar configurações</button>
            </section>
          )}
        </main>
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <style>{`
        .warmup-page { display: flex; flex-direction: column; gap: 22px; }
        .warmup-hero { border-radius: 28px; padding: 28px; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; background: linear-gradient(135deg, rgba(255,122,0,.12), rgba(0,242,255,.04)); }
        .hero-title-row { display: flex; gap: 16px; align-items: flex-start; }
        .hero-icon { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; color: #000; background: linear-gradient(135deg, #ffcc00, #ff6b00); box-shadow: 0 0 28px rgba(255,122,0,.28); flex-shrink: 0; }
        .warmup-hero h1 { font-size: clamp(2rem, 4vw, 3.4rem); line-height: .95; letter-spacing: -.06em; margin: 0; }
        .warmup-hero h1 span { color: #ffcc00; }
        .warmup-hero p { margin-top: 10px; max-width: 760px; color: var(--text-muted); line-height: 1.6; }
        .hero-actions, .control-buttons, .panel-toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .warmup-notice { display: flex; gap: 10px; align-items: center; padding: 14px 16px; border-radius: 16px; }
        .warmup-notice.error { color: #ff7b7b; border: 1px solid rgba(255,123,123,.24); }
        .warmup-notice.success { color: #00ff88; border: 1px solid rgba(0,255,136,.24); }
        .warmup-controls { border-radius: 20px; padding: 16px; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
        .warmup-controls > div:first-child { display: flex; align-items: center; gap: 10px; }
        .warmup-controls small { color: var(--text-muted); }
        .runtime-dot { width: 10px; height: 10px; border-radius: 999px; background: #94a3b8; box-shadow: 0 0 12px currentColor; }
        .runtime-dot.active { background: #00ff88; color: #00ff88; }
        .runtime-dot.paused { background: #ffcc00; color: #ffcc00; }
        .control-buttons button, .panel-toolbar button, .save-config { display: inline-flex; gap: 7px; align-items: center; border-radius: 999px; border: 1px solid rgba(255,255,255,.11); background: rgba(255,255,255,.04); color: var(--text-main); padding: 9px 13px; font-weight: 800; cursor: pointer; }
        .control-buttons button:disabled, .save-config:disabled { opacity: .55; cursor: wait; }
        .warmup-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .warmup-tabs button { display: inline-flex; align-items: center; gap: 7px; padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.03); color: var(--text-muted); font-weight: 800; cursor: pointer; }
        .warmup-tabs button.active { color: #001014; background: #00f2ff; border-color: #00f2ff; }
        .warmup-loading { padding: 40px; border-radius: 22px; display: flex; gap: 10px; align-items: center; justify-content: center; color: var(--text-muted); }
        .warmup-surface { display: flex; flex-direction: column; gap: 22px; }
        .warmup-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
        .warmup-stat { border-radius: 20px; padding: 20px; display: flex; gap: 14px; align-items: center; }
        .warmup-stat .stat-icon { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; color: #00f2ff; background: rgba(0,242,255,.08); }
        .warmup-stat.green .stat-icon { color: #00ff88; background: rgba(0,255,136,.08); }
        .warmup-stat.purple .stat-icon { color: #a855f7; background: rgba(168,85,247,.1); }
        .warmup-stat.orange .stat-icon { color: #ffcc00; background: rgba(255,204,0,.1); }
        .warmup-stat span, .warmup-stat small { color: var(--text-muted); display: block; }
        .warmup-stat strong { display: block; font-size: 1.8rem; font-family: Outfit, sans-serif; }
        .warmup-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .warmup-panel { border-radius: 24px; padding: 24px; }
        .warmup-panel h3 { display: flex; gap: 9px; align-items: center; margin-bottom: 18px; }
        .operation-grid, .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
        .operation-grid div, .risk-row { border-radius: 16px; padding: 14px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.06); }
        .operation-grid span, .risk-row span { color: var(--text-muted); font-size: .78rem; display: block; }
        .operation-grid strong, .risk-row strong { margin-top: 5px; display: block; }
        .warmup-table { display: flex; flex-direction: column; gap: 10px; }
        .warmup-table article { display: grid; grid-template-columns: minmax(180px,1fr) 110px 150px 80px minmax(180px,1fr); gap: 12px; align-items: center; padding: 14px; border-radius: 16px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); }
        .warmup-table small, .editor-card small { color: var(--text-muted); }
        .stage { width: max-content; border-radius: 999px; padding: 6px 10px; font-size: .72rem; font-weight: 900; background: rgba(255,255,255,.07); }
        .stage.eligible { color: #00ff88; background: rgba(0,255,136,.1); }
        .stage.waiting, .stage.regenerating { color: #ffcc00; background: rgba(255,204,0,.1); }
        .stage.blocked { color: #ff7b7b; background: rgba(255,123,123,.1); }
        .heatbar { height: 9px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; }
        .heatbar span { height: 100%; display: block; border-radius: inherit; background: linear-gradient(90deg, #ff4466, #ffcc00, #00ff88); }
        .editor-list { display: flex; flex-direction: column; gap: 14px; }
        .editor-card { border-radius: 18px; padding: 16px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.035); display: flex; flex-direction: column; gap: 12px; }
        .editor-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; align-items: center; }
        input, select, textarea { width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.18); color: var(--text-main); padding: 11px 12px; outline: none; }
        textarea { resize: vertical; }
        label { color: var(--text-muted); font-size: .82rem; font-weight: 800; display: flex; flex-direction: column; gap: 7px; }
        label input[type="checkbox"] { width: auto; }
        .toggle-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 16px; }
        .toggle-grid label, .editor-row label { flex-direction: row; align-items: center; padding: 12px; border-radius: 14px; background: rgba(255,255,255,.035); }
        .save-config { margin-top: 18px; color: #001014; background: #00f2ff; border-color: #00f2ff; }
        .log-list { display: flex; flex-direction: column; gap: 10px; max-height: 540px; overflow: auto; }
        .log-list div { padding: 12px; border-radius: 14px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.05); }
        .log-list span { display: block; color: var(--text-muted); font-size: .78rem; margin-top: 4px; }
        .warmup-empty { padding: 34px; border-radius: 20px; border: 1px dashed rgba(255,255,255,.14); display: grid; place-items: center; text-align: center; gap: 8px; color: var(--text-muted); }
        .warmup-empty strong { color: var(--text-main); }
        .settings-panel p { color: var(--text-muted); margin-bottom: 18px; line-height: 1.6; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 960px) { .warmup-hero, .warmup-controls { flex-direction: column; } .warmup-two-col { grid-template-columns: 1fr; } .warmup-table article { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
