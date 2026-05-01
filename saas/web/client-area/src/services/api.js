/**
 * Ruptur Client Area API Service
 * Centraliza as chamadas ao backend do Ruptur e integração com Bubble.io
 */

const API_BASE_URL = ''; // Endpoints já começam com /api no server.mjs e o front é servido na mesma origem

export const apiService = {
  // --- Dashboard Statistics ---
  async getDashboardStats(tenantId) {
    const response = await fetch(`${API_BASE_URL}/api/dashboard?tenantId=${tenantId}`);
    if (!response.ok) throw new Error('Falha ao buscar estatísticas');
    return await response.json();
  },

  // --- Wallet & Credits ---
  async getWalletHistory(tenantId) {
    const response = await fetch(`${API_BASE_URL}/api/wallet/transactions?tenantId=${tenantId}`);
    if (!response.ok) throw new Error('Falha ao buscar histórico');
    const data = await response.json();
    return data.transactions || [];
  },

  async addCredits(tenantId, amount) {
    // Redirecionamento para checkout (mantido como está por enquanto, ou integrar com stripe/bubble)
    return { checkoutUrl: `https://app.ruptur.cloud/checkout?tenant=${tenantId}&amount=${amount}` };
  },

  // --- Campaigns ---
  async getCampaigns(tenantId) {
    const response = await fetch(`${API_BASE_URL}/api/campaigns?tenantId=${tenantId}`);
    if (!response.ok) throw new Error('Falha ao buscar campanhas');
    const data = await response.json();
    // Se o backend retornar { campaigns: [] }, extraímos
    return Array.isArray(data) ? data : (data.campaigns || []);
  },

  async createCampaign(tenantId, campaignData) {
    const response = await fetch(`${API_BASE_URL}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({
        ...campaignData,
        tenantId,
        enableSpinText: campaignData.enableSpinText !== false,
        mediaType: campaignData.mediaType || 'text',
        mediaUrl: campaignData.mediaUrl || '',
        buttonType: campaignData.buttonType || '',
        buttons: campaignData.buttons || [],
        sections: campaignData.sections || []
      })
    });
    if (!response.ok) throw new Error('Falha ao criar campanha');
    return await response.json();
  },

  async launchCampaign(tenantId, campaignId) {
    const response = await fetch(`${API_BASE_URL}/api/campaigns/${campaignId}/launch`, {
      method: 'POST',
      headers: { 'x-tenant-id': tenantId }
    });
    if (!response.ok) throw new Error('Falha ao disparar campanha');
    return await response.json();
  },

   // --- Inbox & Messages ---
   async getInstances(tenantId) {
     const response = await fetch(`${API_BASE_URL}/api/local/uazapi/instance/all?tenantId=${tenantId}`);
     if (!response.ok) throw new Error('Falha ao buscar instâncias');
     return await response.json();
   },

   async getMessages(instanceId, tenantId) {
     const response = await fetch(`${API_BASE_URL}/api/inbox/messages/${instanceId}?tenantId=${tenantId}`);
     if (!response.ok) throw new Error('Falha ao buscar mensagens');
     const data = await response.json();
     return data.messages || [];
   }
};

