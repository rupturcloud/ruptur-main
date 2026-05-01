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

  // --- Instances ---
  async getInstances(tenantId) {
    return authFetch(`/api/local/uazapi/instance/all?tenantId=${tenantId}`);
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

  async adminAddCredits(tenantId, amount, description) {
    return authFetch('/api/admin/credits', {
      method: 'POST',
      body: JSON.stringify({ tenantId, amount, description }),
    });
  },
};
