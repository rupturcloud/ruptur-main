import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, CreditCard, Database, Loader2, Plus, RefreshCw, Search, Server, Shield, Smartphone, Users, Zap } from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STATUS_MAP = {
  active: { label: 'Ativo', color: '#00ff88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)' },
  pending: { label: 'Pendente', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', border: 'rgba(255,170,0,0.3)' },
  suspended: { label: 'Suspenso', color: '#ff4466', bg: 'rgba(255,68,102,0.1)', border: 'rgba(255,68,102,0.3)' },
  cancelled: { label: 'Cancelado', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
  connected: { label: 'Conectada', color: '#00ff88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)' },
  disconnected: { label: 'Desconectada', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
  connecting: { label: 'Conectando', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', border: 'rgba(255,170,0,0.3)' },
  capacity_full: { label: 'Capacidade cheia', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', border: 'rgba(255,170,0,0.3)' },
  draining: { label: 'Drenando', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  disabled: { label: 'Desativada', color: '#ff4466', bg: 'rgba(255,68,102,0.1)', border: 'rgba(255,68,102,0.3)' },
  expired: { label: 'Expirada', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
  testing: { label: 'Em teste', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
};

const GATEWAY_OPTIONS = {
  cakto: {
    label: 'Cakto',
    defaultName: 'Cakto Produção',
    baseUrl: 'https://api.cakto.com.br',
    webhookUrl: 'https://api.ruptur.cloud/api/webhooks/cakto',
    paymentMethods: [
      ['pix', 'Pix'],
      ['pix_auto', 'Pix Automático'],
      ['boleto', 'Boleto'],
      ['credit_card', 'Cartão de crédito'],
      ['debit_card', 'Cartão de débito'],
      ['picpay', 'PicPay'],
      ['nupay', 'NuPay'],
      ['applepay', 'Apple Pay'],
      ['googlepay', 'Google Pay'],
      ['openfinance_nubank', 'Open Finance/Nubank'],
    ],
    features: [
      ['transparent_checkout', 'Checkout transparente'],
      ['hosted_checkout', 'Checkout hospedado'],
      ['subscriptions', 'Assinaturas'],
      ['tokenization', 'Tokenização'],
      ['split', 'Split'],
      ['webhooks', 'Webhooks'],
      ['refunds', 'Reembolsos'],
      ['chargebacks', 'Chargebacks'],
      ['coupons', 'Cupons'],
      ['order_bump', 'Order bump'],
      ['upsell', 'Upsell'],
      ['affiliate', 'Afiliados/coprodutores'],
      ['receivables_anticipation', 'Antecipação de recebíveis'],
      ['interest_pass_through', 'Repasse de juros'],
    ],
  },
  getnet: {
    label: 'Getnet',
    defaultName: 'Getnet Produção',
    baseUrl: 'https://api.getnet.com.br',
    webhookUrl: 'https://api.ruptur.cloud/api/webhooks/getnet',
    paymentMethods: [
      ['pix', 'Pix'],
      ['boleto', 'Boleto'],
      ['credit_card', 'Cartão de crédito'],
      ['debit_card', 'Cartão de débito'],
      ['wallets', 'Carteiras digitais'],
    ],
    features: [
      ['transparent_checkout', 'Checkout transparente'],
      ['hosted_checkout', 'Link/checkout hospedado'],
      ['subscriptions', 'Assinaturas'],
      ['tokenization', 'Tokenização'],
      ['vault', 'Cofre de cartão'],
      ['webhooks', 'Webhooks'],
      ['refunds', 'Estornos/reembolsos'],
      ['chargebacks', 'Chargebacks'],
      ['reconciliation', 'Conciliação'],
      ['receivables_anticipation', 'Antecipação de recebíveis'],
    ],
  },
};

function defaultGatewayForm(provider = 'cakto') {
  const option = GATEWAY_OPTIONS[provider];
  return {
    provider,
    label: option.defaultName,
    environment: 'production',
    status: 'testing',
    clientId: '',
    clientSecret: '',
    sellerId: '',
    baseUrl: option.baseUrl,
    webhookUrl: option.webhookUrl,
    webhookSecret: '',
    paymentMethods: option.paymentMethods.map(([value]) => value),
    features: option.features.map(([value]) => value),
    receivablesEnabled: true,
    anticipationEnabled: false,
    settlementPlan: 'standard',
    pixRelease: provider === 'cakto' ? 'até 24h / D+1' : '',
    cardRelease: provider === 'cakto' ? '15 dias padrão; até 2 dias com antecipação' : '',
    boletoRelease: provider === 'cakto' ? '2 dias após aprovação' : '',
    passInterestToCustomer: false,
    reservePolicy: 'provider_default',
  };
}

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [activeView, setActiveView] = useState('overview');
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [instances, setInstances] = useState([]);
  const [providerAccounts, setProviderAccounts] = useState([]);
  const [paymentGateways, setPaymentGateways] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creditTenant, setCreditTenant] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDescription, setCreditDescription] = useState('Crédito administrativo');
  const [savingCredit, setSavingCredit] = useState(false);
  const [providerForm, setProviderForm] = useState({ label: '', serverUrl: 'https://free.uazapi.com', accountKind: 'free', planLabel: '', capacityInstances: 1, adminToken: '', expiresAt: '' });
  const [gatewayForm, setGatewayForm] = useState(defaultGatewayForm('cakto'));
  const [instanceForm, setInstanceForm] = useState({ tenantId: '', providerAccountId: '', accountKind: 'free', leaseType: 'free_1h', name: '' });
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingGateway, setSavingGateway] = useState(false);
  const [savingInstance, setSavingInstance] = useState(false);

  async function loadAdminData(currentSearch = search) {
    setLoading(true);
    setError('');
    try {
      const [statsData, clientsData, instancesData, providersData, gatewaysData] = await Promise.all([
        apiService.getAdminStats(),
        apiService.getAdminClients(currentSearch),
        apiService.getAdminInstances(),
        apiService.getProviderAccounts().catch(() => ({ accounts: [] })),
        apiService.getPaymentGateways().catch(() => ({ gateways: [] })),
      ]);
      setStats(statsData);
      setClients(clientsData.clients || []);
      setInstances(instancesData.instances || []);
      setProviderAccounts(providersData.accounts || []);
      setPaymentGateways(gatewaysData.gateways || []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar painel administrativo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadAdminData(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadAdminData(search), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totals = useMemo(() => stats || {
    clients: clients.length,
    active: clients.filter((client) => client.status === 'active').length,
    credits: clients.reduce((sum, client) => sum + Number(client.balance || 0), 0),
    providerAccounts: providerAccounts.length,
    paymentGateways: paymentGateways.length,
    instances: instances.length,
    connectedInstances: instances.filter((instance) => instance.status === 'connected').length,
  }, [clients, instances, providerAccounts, paymentGateways, stats]);



  async function handleCreateProvider(e) {
    e.preventDefault();
    setSavingProvider(true);
    setError('');
    try {
      await apiService.createProviderAccount({
        ...providerForm,
        capacityInstances: Number(providerForm.capacityInstances || 1),
        expiresAt: providerForm.expiresAt || null,
      });
      setProviderForm({ label: '', serverUrl: 'https://free.uazapi.com', accountKind: 'free', planLabel: '', capacityInstances: 1, adminToken: '', expiresAt: '' });
      await loadAdminData(search);
    } catch (err) {
      setError(err.message || 'Erro ao cadastrar conta UAZAPI.');
    } finally {
      setSavingProvider(false);
    }
  }

  function handleGatewayProviderChange(provider) {
    setGatewayForm({
      ...defaultGatewayForm(provider),
      clientId: gatewayForm.clientId,
      clientSecret: gatewayForm.clientSecret,
      sellerId: provider === 'getnet' ? gatewayForm.sellerId : '',
    });
  }

  async function handleCreateGateway(e) {
    e.preventDefault();
    setSavingGateway(true);
    setError('');
    try {
      await apiService.createPaymentGateway(gatewayForm);
      setGatewayForm(defaultGatewayForm('cakto'));
      await loadAdminData(search);
    } catch (err) {
      setError(err.message || 'Erro ao cadastrar gateway de pagamento.');
    } finally {
      setSavingGateway(false);
    }
  }

  async function handleGatewayAction(gateway, status) {
    setError('');
    try {
      await apiService.updatePaymentGatewayStatus(gateway.id, status);
      await loadAdminData(search);
    } catch (err) {
      setError(err.message || 'Erro ao atualizar gateway de pagamento.');
    }
  }

  async function handleProviderAction(action, account, status) {
    setError('');
    try {
      if (action === 'sync') await apiService.syncProviderAccount(account.id);
      if (action === 'status') await apiService.updateProviderAccountStatus(account.id, status);
      await loadAdminData(search);
    } catch (err) {
      setError(err.message || 'Erro ao atualizar conta UAZAPI.');
    }
  }

  async function handleCreateInstance(e) {
    e.preventDefault();
    setSavingInstance(true);
    setError('');
    try {
      await apiService.createAdminInstance({
        ...instanceForm,
        tenantId: instanceForm.tenantId,
        providerAccountId: instanceForm.providerAccountId || undefined,
        name: instanceForm.name || undefined,
      });
      setInstanceForm({ tenantId: '', providerAccountId: '', accountKind: 'free', leaseType: 'free_1h', name: '' });
      await loadAdminData(search);
    } catch (err) {
      setError(err.message || 'Erro ao criar instância.');
    } finally {
      setSavingInstance(false);
    }
  }

  async function handleAddCredits() {
    const amount = Number(creditAmount);
    if (!creditTenant || !amount || amount <= 0) return;

    setSavingCredit(true);
    setError('');
    try {
      await apiService.adminAddCredits(creditTenant.id, amount, creditDescription || 'Crédito administrativo');
      setCreditTenant(null);
      setCreditAmount('');
      setCreditDescription('Crédito administrativo');
      await loadAdminData(search);
    } catch (err) {
      setError(err.message || 'Erro ao lançar créditos.');
    } finally {
      setSavingCredit(false);
    }
  }

  return (
    <div className="admin-root">
      <aside className="admin-sidebar glass">
        <div className="admin-logo">
          <Shield size={28} className="neon-text-cyan" />
          <div>
            <span className="admin-logo-title">RUPTUR</span>
            <span className="admin-logo-sub">Admin Operacional</span>
          </div>
        </div>

        <nav className="admin-nav">
          <button className={`admin-nav-btn ${activeView === 'overview' ? 'active' : ''}`} onClick={() => setActiveView('overview')}><Activity size={18} /> Visão Geral</button>
          <button className={`admin-nav-btn ${activeView === 'clients' ? 'active' : ''}`} onClick={() => setActiveView('clients')}><Users size={18} /> Clientes & Usuários</button>
          <button className={`admin-nav-btn ${activeView === 'instances' ? 'active' : ''}`} onClick={() => setActiveView('instances')}><Smartphone size={18} /> Instâncias</button>
          <button className={`admin-nav-btn ${activeView === 'providers' ? 'active' : ''}`} onClick={() => setActiveView('providers')}><Server size={18} /> APIs UAZAPI</button>
          <button className={`admin-nav-btn ${activeView === 'gateways' ? 'active' : ''}`} onClick={() => setActiveView('gateways')}><CreditCard size={18} /> Gateways Pagamento</button>
        </nav>

        <button className="admin-logout-btn" onClick={signOut}>Sair</button>
      </aside>

      <main className="admin-main">
        <header className="admin-top-bar">
          <div>
            <h1>{activeView === 'overview' ? 'Visão Geral' : activeView === 'clients' ? 'Gestão de Clientes' : activeView === 'providers' ? 'APIs UAZAPI' : activeView === 'gateways' ? 'Gateways de Pagamento' : 'Instâncias'}</h1>
            <p>{user?.email}</p>
          </div>
          <div className="admin-badge"><Shield size={14} /> superadmin</div>
        </header>

        <section className="admin-content">
          {error && <div className="admin-error">{error}</div>}

          {loading ? (
            <div className="admin-loading"><Loader2 className="spin" size={28} /> Carregando dados reais...</div>
          ) : activeView === 'overview' ? (
            <>
              <div className="stats-grid">
                <StatCard label="Clientes" value={totals.clients || 0} icon={<Users size={22} />} accent="#00f2ff" />
                <StatCard label="Clientes ativos" value={totals.active || 0} icon={<Activity size={22} />} accent="#00ff88" />
                <StatCard label="Créditos em circulação" value={Number(totals.credits || 0).toLocaleString('pt-BR')} icon={<Zap size={22} />} accent="#a855f7" />
                <StatCard label="Instâncias conectadas" value={`${totals.connectedInstances || 0}/${totals.instances || 0}`} icon={<Smartphone size={22} />} accent="#ff007a" />
                <StatCard label="Contas UAZAPI" value={providerAccounts.length || 0} icon={<Server size={22} />} accent="#ffaa00" />
                <StatCard label="Gateways de pagamento" value={paymentGateways.length || 0} icon={<CreditCard size={22} />} accent="#38bdf8" />
              </div>

              <div className="panel glass">
                <h3><Database size={18} /> Clientes recentes</h3>
                <ClientRows clients={clients.slice(0, 6)} onCredit={setCreditTenant} />
              </div>
            </>
          ) : activeView === 'clients' ? (
            <>
              <Toolbar search={search} setSearch={setSearch} />
              <div className="panel glass">
                <ClientRows clients={clients} onCredit={setCreditTenant} />
              </div>
            </>
          ) : activeView === 'instances' ? (
            <>
              <div className="panel glass admin-form-panel">
                <h3><Plus size={18} /> Criar instância gerenciada</h3>
                <form className="admin-form-grid" onSubmit={handleCreateInstance}>
                  <select value={instanceForm.tenantId} onChange={(e) => setInstanceForm({ ...instanceForm, tenantId: e.target.value })} required>
                    <option value="">Selecione um cliente</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name} — {client.slug}</option>)}
                  </select>
                  <select value={instanceForm.providerAccountId} onChange={(e) => setInstanceForm({ ...instanceForm, providerAccountId: e.target.value })}>
                    <option value="">Selecionar automaticamente por capacidade</option>
                    {providerAccounts.map((account) => <option key={account.id} value={account.id}>{account.label} ({account.account_kind})</option>)}
                  </select>
                  <select value={instanceForm.accountKind} onChange={(e) => setInstanceForm({ ...instanceForm, accountKind: e.target.value, leaseType: e.target.value === 'free' ? 'free_1h' : 'paid_persistent' })}>
                    <option value="free">Free tier / teste 1h</option>
                    <option value="paid">Pago persistente</option>
                    <option value="dedicated">Dedicado</option>
                  </select>
                  <input value={instanceForm.name} onChange={(e) => setInstanceForm({ ...instanceForm, name: e.target.value })} placeholder="Nome da instância (opcional)" />
                  <button className="btn-primary form-submit" disabled={savingInstance || !instanceForm.tenantId}>{savingInstance ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} Criar instância</button>
                </form>
              </div>

              <div className="panel glass">
                <div className="table-header instances"><span>Cliente</span><span>Provider</span><span>Instância</span><span>Número</span><span>Status</span><span>Última atividade</span></div>
                {instances.map((instance) => (
                  <div className="table-row instances" key={instance.id}>
                    <span>{instance.tenant?.name || '—'}<small>{instance.tenant?.slug || ''}</small></span>
                    <span>{instance.provider || 'uazapi'}</span>
                    <span>{instance.instance_name || instance.remote_instance_id || '—'}</span>
                    <span>{instance.instance_number || '—'}</span>
                    <StatusBadge status={instance.status} />
                    <span>{instance.last_seen_at ? new Date(instance.last_seen_at).toLocaleString('pt-BR') : '—'}</span>
                  </div>
                ))}
                {instances.length === 0 && <div className="empty-table">Nenhuma instância registrada ainda.</div>}
              </div>
            </>
          ) : activeView === 'providers' ? (
            <ProvidersPanel
              providerAccounts={providerAccounts}
              providerForm={providerForm}
              setProviderForm={setProviderForm}
              savingProvider={savingProvider}
              onCreateProvider={handleCreateProvider}
              onProviderAction={handleProviderAction}
            />
          ) : (
            <PaymentGatewaysPanel
              paymentGateways={paymentGateways}
              gatewayForm={gatewayForm}
              setGatewayForm={setGatewayForm}
              onProviderChange={handleGatewayProviderChange}
              savingGateway={savingGateway}
              onCreateGateway={handleCreateGateway}
              onGatewayAction={handleGatewayAction}
            />
          )}
        </section>
      </main>

      {creditTenant && (
        <div className="modal-overlay">
          <div className="credit-modal glass">
            <h3>Lançar créditos</h3>
            <p>Cliente: <strong>{creditTenant.name}</strong></p>
            <p>Saldo atual: <strong>{Number(creditTenant.balance || 0).toLocaleString('pt-BR')}</strong></p>
            <label>Quantidade</label>
            <input type="number" min="1" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="Ex: 1000" />
            <label>Descrição</label>
            <input value={creditDescription} onChange={(e) => setCreditDescription(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setCreditTenant(null)}>Cancelar</button>
              <button className="btn-primary" disabled={savingCredit || !creditAmount} onClick={handleAddCredits}><Plus size={16} /> Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <style>{css}</style>
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <motion.div className="stat-card glass" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="stat-icon" style={{ color: accent, background: `${accent}15`, border: `1px solid ${accent}30` }}>{icon}</div>
      <div><span className="stat-label">{label}</span><span className="stat-value">{value}</span></div>
    </motion.div>
  );
}

function Toolbar({ search, setSearch }) {
  return <div className="clients-toolbar"><div className="search-box glass"><Search size={16} /><input placeholder="Buscar por nome, email ou slug..." value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>;
}

function ClientRows({ clients, onCredit }) {
  return (
    <>
      <div className="table-header clients"><span>Cliente</span><span>Plano</span><span>Usuários</span><span>Instâncias</span><span>Créditos</span><span>Status</span><span>Ações</span></div>
      {clients.map((client) => (
        <div className="table-row clients" key={client.id}>
          <span>{client.name}<small>{client.email || client.slug}</small></span>
          <span>{client.plan || '—'}</span>
          <span>{client.users?.length || 0}</span>
          <span>{client.connectedInstances || 0}/{client.instances || 0}<small>limite {client.maxInstances || 0}</small></span>
          <span>{Number(client.balance || 0).toLocaleString('pt-BR')}</span>
          <StatusBadge status={client.status} />
          <button className="action-btn" onClick={() => onCredit(client)}><CreditCard size={14} /> Créditos</button>
        </div>
      ))}
      {clients.length === 0 && <div className="empty-table">Nenhum cliente encontrado.</div>}
    </>
  );
}


function ProvidersPanel({ providerAccounts, providerForm, setProviderForm, savingProvider, onCreateProvider, onProviderAction }) {
  return (
    <>
      <div className="panel glass admin-form-panel">
        <h3><Server size={18} /> Cadastrar conta UAZAPI</h3>
        <form className="admin-form-grid provider" onSubmit={onCreateProvider}>
          <input value={providerForm.label} onChange={(e) => setProviderForm({ ...providerForm, label: e.target.value })} placeholder="Nome interno: UAZAPI Free 01" required />
          <input value={providerForm.serverUrl} onChange={(e) => setProviderForm({ ...providerForm, serverUrl: e.target.value })} placeholder="https://free.uazapi.com" required />
          <select value={providerForm.accountKind} onChange={(e) => setProviderForm({ ...providerForm, accountKind: e.target.value })}>
            <option value="free">Free / teste</option>
            <option value="paid">Pago</option>
            <option value="dedicated">Dedicado</option>
            <option value="internal">Interno</option>
          </select>
          <input value={providerForm.planLabel} onChange={(e) => setProviderForm({ ...providerForm, planLabel: e.target.value })} placeholder="Plano/conta na UAZAPI" />
          <input type="number" min="0" value={providerForm.capacityInstances} onChange={(e) => setProviderForm({ ...providerForm, capacityInstances: e.target.value })} placeholder="Capacidade" />
          <input type="datetime-local" value={providerForm.expiresAt} onChange={(e) => setProviderForm({ ...providerForm, expiresAt: e.target.value })} />
          <input type="password" value={providerForm.adminToken} onChange={(e) => setProviderForm({ ...providerForm, adminToken: e.target.value })} placeholder="admintoken" required />
          <button className="btn-primary form-submit" disabled={savingProvider || !providerForm.adminToken}>{savingProvider ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} Salvar API</button>
        </form>
      </div>

      <div className="panel glass">
        <div className="table-header providers"><span>Conta</span><span>Tipo</span><span>Endpoint</span><span>Capacidade</span><span>Status</span><span>Ações</span></div>
        {providerAccounts.map((account) => (
          <div className="table-row providers" key={account.id}>
            <span>{account.label}<small>token ••••{account.admin_token_last4 || '—'} {account.expires_at ? ` · expira ${new Date(account.expires_at).toLocaleString('pt-BR')}` : ''}</small></span>
            <span>{account.account_kind}<small>{account.plan_label || ''}</small></span>
            <span>{account.server_url}</span>
            <span>{Number(account.used_instances || 0)}/{Number(account.capacity_instances || 0) || '∞'}</span>
            <StatusBadge status={account.status} />
            <span className="row-actions">
              <button className="action-btn" onClick={() => onProviderAction('sync', account)}><RefreshCw size={14} /> Sync</button>
              <button className="action-btn" onClick={() => onProviderAction('status', account, account.status === 'disabled' ? 'active' : 'disabled')}>{account.status === 'disabled' ? 'Ativar' : 'Desativar'}</button>
              <button className="action-btn" onClick={() => onProviderAction('status', account, 'draining')}>Drenar</button>
            </span>
          </div>
        ))}
        {providerAccounts.length === 0 && <div className="empty-table">Nenhuma conta UAZAPI cadastrada. Cadastre a primeira API free ou paga acima.</div>}
      </div>
    </>
  );
}

function PaymentGatewaysPanel({ paymentGateways, gatewayForm, setGatewayForm, onProviderChange, savingGateway, onCreateGateway, onGatewayAction }) {
  const isGetnet = gatewayForm.provider === 'getnet';
  const providerLabel = isGetnet ? 'Getnet' : 'Cakto';
  const options = GATEWAY_OPTIONS[gatewayForm.provider] || GATEWAY_OPTIONS.cakto;

  function toggleList(field, value) {
    const current = new Set(gatewayForm[field] || []);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    setGatewayForm({ ...gatewayForm, [field]: Array.from(current) });
  }

  return (
    <>
      <div className="panel glass admin-form-panel">
        <h3><CreditCard size={18} /> Cadastrar gateway de pagamento</h3>
        <form className="admin-form-grid gateway" onSubmit={onCreateGateway}>
          <select value={gatewayForm.provider} onChange={(e) => onProviderChange(e.target.value)}>
            <option value="cakto">Cakto</option>
            <option value="getnet">Getnet</option>
          </select>
          <input value={gatewayForm.label} onChange={(e) => setGatewayForm({ ...gatewayForm, label: e.target.value })} placeholder={`Nome interno: ${providerLabel} Produção`} required />
          <select value={gatewayForm.environment} onChange={(e) => setGatewayForm({ ...gatewayForm, environment: e.target.value, baseUrl: isGetnet && e.target.value === 'sandbox' ? 'https://api-sandbox.getnet.com.br' : gatewayForm.baseUrl })}>
            <option value="production">Produção</option>
            <option value="sandbox">Sandbox/Homologação</option>
          </select>
          <select value={gatewayForm.status} onChange={(e) => setGatewayForm({ ...gatewayForm, status: e.target.value })}>
            <option value="testing">Em teste</option>
            <option value="active">Ativo</option>
            <option value="disabled">Desativado</option>
          </select>
          <input value={gatewayForm.clientId} onChange={(e) => setGatewayForm({ ...gatewayForm, clientId: e.target.value })} placeholder="Client ID" autoComplete="off" required />
          <input type="password" value={gatewayForm.clientSecret} onChange={(e) => setGatewayForm({ ...gatewayForm, clientSecret: e.target.value })} placeholder="Client Secret" autoComplete="new-password" required />
          {isGetnet && (
            <input value={gatewayForm.sellerId} onChange={(e) => setGatewayForm({ ...gatewayForm, sellerId: e.target.value })} placeholder="Seller ID Getnet" required />
          )}
          <input value={gatewayForm.baseUrl} onChange={(e) => setGatewayForm({ ...gatewayForm, baseUrl: e.target.value })} placeholder="URL base da API" />
          <input value={gatewayForm.webhookUrl} onChange={(e) => setGatewayForm({ ...gatewayForm, webhookUrl: e.target.value })} placeholder="URL do webhook" />
          <input type="password" value={gatewayForm.webhookSecret} onChange={(e) => setGatewayForm({ ...gatewayForm, webhookSecret: e.target.value })} placeholder="Webhook secret (opcional)" autoComplete="new-password" />
          <div className="gateway-section full">
            <strong>Métodos de pagamento habilitados</strong>
            <div className="check-grid">
              {options.paymentMethods.map(([value, label]) => (
                <label className="check-card" key={value}>
                  <input type="checkbox" checked={(gatewayForm.paymentMethods || []).includes(value)} onChange={() => toggleList('paymentMethods', value)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="gateway-section full">
            <strong>Recursos da plataforma</strong>
            <div className="check-grid">
              {options.features.map(([value, label]) => (
                <label className="check-card" key={value}>
                  <input type="checkbox" checked={(gatewayForm.features || []).includes(value)} onChange={() => toggleList('features', value)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="gateway-section full">
            <strong>Recebíveis e liquidação</strong>
            <div className="receivables-grid">
              <label className="check-card"><input type="checkbox" checked={gatewayForm.receivablesEnabled} onChange={(e) => setGatewayForm({ ...gatewayForm, receivablesEnabled: e.target.checked })} /> Controlar recebíveis</label>
              <label className="check-card"><input type="checkbox" checked={gatewayForm.anticipationEnabled} onChange={(e) => setGatewayForm({ ...gatewayForm, anticipationEnabled: e.target.checked })} /> Permitir antecipação</label>
              <label className="check-card"><input type="checkbox" checked={gatewayForm.passInterestToCustomer} onChange={(e) => setGatewayForm({ ...gatewayForm, passInterestToCustomer: e.target.checked })} /> Repassar juros ao cliente quando aplicável</label>
              <input value={gatewayForm.settlementPlan} onChange={(e) => setGatewayForm({ ...gatewayForm, settlementPlan: e.target.value })} placeholder="Plano de liquidação: standard, D2, D15..." />
              <input value={gatewayForm.pixRelease} onChange={(e) => setGatewayForm({ ...gatewayForm, pixRelease: e.target.value })} placeholder="Prazo Pix" />
              <input value={gatewayForm.cardRelease} onChange={(e) => setGatewayForm({ ...gatewayForm, cardRelease: e.target.value })} placeholder="Prazo cartão" />
              <input value={gatewayForm.boletoRelease} onChange={(e) => setGatewayForm({ ...gatewayForm, boletoRelease: e.target.value })} placeholder="Prazo boleto" />
              <input value={gatewayForm.reservePolicy} onChange={(e) => setGatewayForm({ ...gatewayForm, reservePolicy: e.target.value })} placeholder="Política de reserva/contingência" />
            </div>
          </div>
          <button className="btn-primary form-submit" disabled={savingGateway || !gatewayForm.clientId || !gatewayForm.clientSecret || (isGetnet && !gatewayForm.sellerId)}>
            {savingGateway ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} Salvar gateway
          </button>
        </form>
        <div className="gateway-help">
          Vamos cadastrar todos os métodos/recursos disponíveis e deixar recebíveis/antecipação configuráveis por gateway, sem bloquear opções agora.
        </div>
      </div>

      <div className="panel glass">
        <div className="table-header gateways"><span>Gateway</span><span>Ambiente</span><span>Endpoint</span><span>Credenciais</span><span>Status</span><span>Ações</span></div>
        {paymentGateways.map((gateway) => (
          <div className="table-row gateways" key={gateway.id}>
            <span>{gateway.label}<small>{gateway.provider}</small></span>
            <span>{gateway.environment === 'production' ? 'Produção' : 'Sandbox'}</span>
            <span>{gateway.base_url || '—'}<small>{gateway.webhook_url || 'sem webhook'}</small></span>
            <span>
              client ••••{gateway.credential_last4?.clientId || '—'}
              <small>
                secret ••••{gateway.credential_last4?.clientSecret || '—'}
                {gateway.credential_last4?.sellerId ? ` · seller ••••${gateway.credential_last4.sellerId}` : ''}
                {gateway.webhook_secret_last4 ? ` · webhook ••••${gateway.webhook_secret_last4}` : ''}
              </small>
              <small>
                {(gateway.public_config?.paymentMethods || []).length} métodos · {(gateway.public_config?.features || []).length} recursos
                {gateway.public_config?.receivables?.anticipationEnabled ? ' · antecipação ligada' : ''}
              </small>
            </span>
            <StatusBadge status={gateway.status} />
            <span className="row-actions">
              <button className="action-btn" onClick={() => onGatewayAction(gateway, gateway.status === 'disabled' ? 'testing' : 'disabled')}>
                {gateway.status === 'disabled' ? 'Reativar teste' : 'Desativar'}
              </button>
              <button className="action-btn" onClick={() => onGatewayAction(gateway, 'active')}>Ativar</button>
            </span>
          </div>
        ))}
        {paymentGateways.length === 0 && <div className="empty-table">Nenhum gateway de pagamento cadastrado. Cadastre Cakto ou Getnet acima.</div>}
      </div>
    </>
  );
}

function StatusBadge({ status }) {
  const st = STATUS_MAP[status] || { label: status || '—', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' };
  return <span className="cell-status" style={{ color: st.color, background: st.bg, borderColor: st.border }}>{st.label}</span>;
}

const css = `
.admin-root{display:flex;height:100vh;background:var(--bg-primary);color:white;font-family:Inter,sans-serif}.admin-sidebar{width:250px;padding:24px 16px;display:flex;flex-direction:column;gap:24px;border-right:1px solid var(--border-glass);border-radius:0;flex-shrink:0}.admin-logo{display:flex;align-items:center;gap:12px;padding:0 8px}.admin-logo-title{font-size:1.1rem;font-weight:900;display:block}.admin-logo-sub{font-size:.72rem;color:var(--text-muted);font-weight:600;display:block}.admin-nav{display:flex;flex-direction:column;gap:6px;flex:1}.admin-nav-btn{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--text-muted);font-size:.86rem;font-weight:700;cursor:pointer;text-align:left}.admin-nav-btn:hover,.admin-nav-btn.active{background:rgba(0,242,255,.08);color:var(--primary);border-color:rgba(0,242,255,.15)}.admin-logout-btn{padding:10px;border-radius:10px;border:1px solid rgba(255,68,102,.2);background:rgba(255,68,102,.05);color:#ff6680;font-weight:700;cursor:pointer}.admin-main{flex:1;overflow:auto}.admin-top-bar{padding:20px 32px;border-bottom:1px solid var(--border-glass);display:flex;justify-content:space-between;align-items:center}.admin-top-bar h1{font-size:1.35rem;font-weight:900;margin:0}.admin-top-bar p{font-size:.78rem;color:var(--text-muted);margin:4px 0 0}.admin-badge{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;background:rgba(0,242,255,.08);border:1px solid rgba(0,242,255,.2);color:var(--primary);font-size:.75rem;font-weight:800}.admin-content{padding:28px 32px;display:flex;flex-direction:column;gap:24px}.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}.stat-card{padding:22px;border-radius:16px;display:flex;align-items:center;gap:16px}.stat-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center}.stat-label{font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;display:block}.stat-value{font-size:1.65rem;font-weight:900;font-family:Outfit,sans-serif}.panel{border-radius:18px;overflow:hidden}.panel h3{display:flex;align-items:center;gap:8px;padding:20px;margin:0;border-bottom:1px solid var(--border-glass)}.clients-toolbar{display:flex}.search-box{display:flex;align-items:center;gap:10px;padding:11px 16px;border-radius:12px;min-width:min(460px,100%)}.search-box input{background:transparent;border:0;outline:0;color:white;flex:1}.table-header,.table-row{display:grid;align-items:center;gap:12px;padding:13px 18px}.table-header{background:rgba(255,255,255,.025);border-bottom:1px solid var(--border-glass);font-size:.72rem;font-weight:900;color:var(--text-muted);text-transform:uppercase}.table-row{border-bottom:1px solid rgba(255,255,255,.035);font-size:.85rem}.table-row:hover{background:rgba(255,255,255,.025)}.clients{grid-template-columns:2fr .7fr .55fr .8fr .8fr .75fr .9fr}.instances{grid-template-columns:1.6fr .7fr 1.2fr 1fr .75fr 1.1fr}.providers{grid-template-columns:1.4fr .7fr 1.4fr .7fr .7fr 1.5fr}.gateways{grid-template-columns:1.1fr .65fr 1.4fr 1.3fr .7fr 1fr}.gateway-help{margin:0 18px 18px;padding:12px 14px;border-radius:12px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.18);color:var(--text-muted);font-size:.78rem;line-height:1.5}.gateway-help strong{color:white}.admin-form-panel{padding-bottom:18px}.admin-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;padding:18px}.admin-form-grid .full{grid-column:1/-1}.gateway-section{padding:14px;border-radius:14px;border:1px solid var(--border-glass);background:rgba(255,255,255,.025)}.gateway-section>strong{display:block;margin-bottom:10px;font-size:.82rem;color:white}.check-grid,.receivables-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.check-card{display:flex;align-items:center;gap:8px;padding:10px 11px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.16);color:var(--text-muted);font-size:.78rem;font-weight:800}.check-card input{width:auto!important;padding:0!important}.admin-form-grid input,.admin-form-grid select{padding:11px 13px;border-radius:10px;border:1px solid var(--border-glass);background:rgba(255,255,255,.04);color:white}.form-submit{min-height:42px}.row-actions{display:flex;gap:6px;flex-wrap:wrap}.table-row span{min-width:0}.table-row small{display:block;color:var(--text-muted);font-size:.72rem;margin-top:3px;overflow:hidden;text-overflow:ellipsis}.cell-status{display:inline-block;width:max-content;padding:4px 10px;border-radius:999px;font-size:.7rem;font-weight:900;border:1px solid}.action-btn{display:inline-flex;align-items:center;gap:6px;width:max-content;padding:7px 10px;border-radius:9px;border:1px solid var(--border-glass);background:transparent;color:white;cursor:pointer;font-weight:800}.admin-loading,.empty-table{padding:44px;text-align:center;color:var(--text-muted);display:flex;gap:10px;justify-content:center}.admin-error{padding:12px 14px;border-radius:12px;background:rgba(255,68,102,.1);border:1px solid rgba(255,68,102,.25);color:#ff6680}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:1000}.credit-modal{width:100%;max-width:430px;padding:28px;border-radius:20px;background:rgba(10,10,20,.98);border:1px solid rgba(255,255,255,.1)}.credit-modal h3{margin:0 0 12px}.credit-modal p{color:var(--text-muted)}.credit-modal label{display:block;margin:14px 0 7px;font-size:.8rem;color:var(--text-muted);font-weight:800}.credit-modal input{width:100%;box-sizing:border-box;padding:11px 13px;border-radius:10px;border:1px solid var(--border-glass);background:rgba(255,255,255,.04);color:white}.modal-actions{display:flex;gap:12px;margin-top:20px}.btn-secondary,.btn-primary{flex:1;padding:11px;border-radius:10px;border:1px solid var(--border-glass);font-weight:900;cursor:pointer}.btn-secondary{background:transparent;color:var(--text-muted)}.btn-primary{display:flex;align-items:center;justify-content:center;gap:7px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:0}@media(max-width:1100px){.stats-grid{grid-template-columns:repeat(2,1fr)}.clients,.instances{grid-template-columns:1.4fr .7fr .7fr .8fr}.table-header span:nth-child(n+5),.table-row span:nth-child(n+5){display:none}}@media(max-width:780px){.admin-sidebar{display:none}.admin-content{padding:20px}.stats-grid{grid-template-columns:1fr}}
`;
