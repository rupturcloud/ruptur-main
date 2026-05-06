/**
 * Ruptur Client Area API Service
 * Centraliza chamadas ao backend com JWT automático no header.
 *
 * authFetch: wrapper de fetch que injeta o token de sessão do Supabase.
 * apiService: métodos de alto nível para cada recurso.
 */
import { supabase } from './supabase';

const API_BASE_URL = '';

/**
 * Fetch autenticado — injeta Bearer token automaticamente.
 * Retry automático em caso de 401 (token expirado).
 */
export async function authFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  let response = await fetch(`${API_BASE_URL}${url}`, config);

  // Se o token expirou, tenta renovar e refaz a request
  if (response.status === 401 && token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) {
      config.headers['Authorization'] = `Bearer ${refreshed.session.access_token}`;
      response = await fetch(`${API_BASE_URL}${url}`, config);
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || body.message || `Request failed: ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return response.json();
}

/**
 * API Service — métodos de alto nível por recurso
 */
export const apiService = {
  // --- Sessão / ambientes ---
  async getMyEnvironments() {
    return authFetch('/api/me/environments');
  },

  // --- Dashboard ---
  async getDashboardStats(tenantId) {
    return authFetch(`/api/dashboard?tenantId=${tenantId}`);
  },

  // --- Wallet & Credits ---
  async getWalletData(tenantId) {
    return authFetch(`/api/wallet?tenantId=${tenantId}`);
  },

  async getWalletHistory(tenantId) {
    const data = await authFetch(`/api/wallet/transactions?tenantId=${tenantId}`);
    return data.transactions || [];
  },

  // --- Billing (Getnet) ---

  /** Listar pacotes de créditos avulsos */
  async getPackages() {
    return authFetch('/api/billing/packages');
  },

  /** Criar checkout de compra de créditos avulsos */
  async createCheckout(tenantId, packageId) {
    return authFetch('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tenantId, packageId }),
    });
  },

  /** Criar assinatura recorrente */
  async createSubscription(tenantId, planId) {
    return authFetch('/api/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ tenantId, planId }),
    });
  },

  /** Listar planos de assinatura */
  async getPlans() {
    const data = await authFetch('/api/billing/plans');
    return data.plans || [];
  },

  // --- Campaigns ---
  async getCampaigns(tenantId) {
    const data = await authFetch(`/api/campaigns?tenantId=${tenantId}`);
    return Array.isArray(data) ? data : (data.campaigns || []);
  },

  async createCampaign(tenantId, campaignData) {
    return authFetch('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        ...campaignData,
        tenantId,
        enableSpinText: campaignData.enableSpinText !== false,
        mediaType: campaignData.mediaType || 'text',
        mediaUrl: campaignData.mediaUrl || '',
        buttonType: campaignData.buttonType || '',
        buttons: campaignData.buttons || [],
        sections: campaignData.sections || [],
      }),
    });
  },

  async launchCampaign(tenantId, campaignId) {
    return authFetch(`/api/campaigns/${campaignId}/launch`, {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    });
  },

  async pauseCampaign(tenantId, campaignId) {
    return authFetch(`/api/campaigns/${campaignId}/pause`, {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    });
  },

  async stopCampaign(tenantId, campaignId) {
    return authFetch(`/api/campaigns/${campaignId}/stop`, {
      method: 'POST',
      body: JSON.stringify({ tenantId }),
    });
  },

  // --- Instances ---
  async getInstances() {
    return authFetch('/api/instances');
  },

  async createInstance(payload) {
    return authFetch('/api/instances', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async connectInstance(instanceKey, payload = {}) {
    return authFetch(`/api/instances/${encodeURIComponent(instanceKey)}/connect`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getInstanceStatus(instanceKey) {
    return authFetch(`/api/instances/${encodeURIComponent(instanceKey)}/status`);
  },

  // --- Warmup / Aquecimento ---
  async getWarmupState() {
    return authFetch('/api/warmup/state');
  },

  async getWarmupConfig() {
    return authFetch('/api/warmup/config');
  },

  async syncWarmupConfig(payload) {
    return authFetch('/api/warmup/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async startWarmup(reason = 'Iniciado pela área do cliente') {
    return authFetch('/api/warmup/start', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async pauseWarmup(reason = 'Pausado pela área do cliente') {
    return authFetch('/api/warmup/pause', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async stopWarmup(reason = 'Parado pela área do cliente') {
    return authFetch('/api/warmup/stop', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async restartWarmup(reason = 'Reiniciado pela área do cliente') {
    return authFetch('/api/warmup/restart', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async tickWarmup(reason = 'Pulso manual pela área do cliente') {
    return authFetch('/api/warmup/tick', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // --- Inbox ---
  async getMessages(instanceId, tenantId) {
    const data = await authFetch(`/api/inbox/messages/${instanceId}?tenantId=${tenantId}`);
    return data.messages || [];
  },

  // --- Tenant ---
  async getTenant(tenantId) {
    return authFetch(`/api/tenants/${tenantId}`);
  },

  async updateTenant(tenantId, updates) {
    return authFetch(`/api/tenants/${tenantId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // --- Admin ---
  async getAdminStats() {
    return authFetch('/api/admin/stats');
  },

  async getAdminClients(search = '') {
    return authFetch(`/api/admin/clients?search=${encodeURIComponent(search)}`);
  },

  async getAdminInstances(tenantId = '') {
    const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    return authFetch(`/api/admin/instances${qs}`);
  },

  async adminAddCredits(tenantId, amount, description) {
    return authFetch('/api/admin/credits', {
      method: 'POST',
      body: JSON.stringify({ tenantId, amount, description }),
    });
  },

  async getProviderAccounts() {
    return authFetch('/api/admin/provider-accounts');
  },

  async createProviderAccount(payload) {
    return authFetch('/api/admin/provider-accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async rotateProviderAccount(id, adminToken) {
    return authFetch(`/api/admin/provider-accounts/${id}/rotate`, {
      method: 'POST',
      body: JSON.stringify({ adminToken }),
    });
  },

  async updateProviderAccountStatus(id, status) {
    return authFetch(`/api/admin/provider-accounts/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async syncProviderAccount(id) {
    return authFetch(`/api/admin/provider-accounts/${id}/sync`, { method: 'POST' });
  },

  async getIntegrationPresets(kind) {
    const suffix = kind ? `?kind=${encodeURIComponent(kind)}` : '';
    return authFetch(`/api/admin/integration-presets${suffix}`);
  },

  async getPaymentGateways() {
    return authFetch('/api/admin/payment-gateways');
  },

  async createPaymentGateway(payload) {
    return authFetch('/api/admin/payment-gateways', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updatePaymentGatewayStatus(id, status) {
    return authFetch(`/api/admin/payment-gateways/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async getCommercialCatalog() {
    return authFetch('/api/admin/commercial/catalog');
  },

  async getCommercialResource(resource) {
    return authFetch(`/api/admin/commercial/${encodeURIComponent(resource)}`);
  },

  async createCommercialResource(resource, payload) {
    return authFetch(`/api/admin/commercial/${encodeURIComponent(resource)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCommercialResource(resource, id, payload) {
    return authFetch(`/api/admin/commercial/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateCommercialResourceStatus(resource, id, status) {
    return authFetch(`/api/admin/commercial/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async createAdminInstance(payload) {
    return authFetch('/api/admin/instances/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
