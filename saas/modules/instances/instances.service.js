/**
 * Instances Service — Gerenciar instâncias WhatsApp por tenant
 *
 * Responsabilidades:
 * - CRUD de instâncias (create, read, update, delete)
 * - Solicitar QR code / paircode para conexão
 * - Verificar status de conexão
 * - Tenant isolation (WHERE tenant_id = req.user.tenantId)
 * - Integração com UazAPI via adapter
 */

export class InstancesService {
  constructor(supabase, uazapiAccountService) {
    this.supabase = supabase;
    this.uazapi = uazapiAccountService;
  }

  /**
   * Listar instâncias do tenant
   * - Filtra por tenant_id (tenant isolation)
   * - Retorna: array com { id, name, phone, status, qrcode?, token_last4, created_at }
   */
  async getInstances(tenantId) {
    if (!tenantId) throw new Error('tenantId obrigatório');

    const { data: instances, error } = await this.supabase
      .from('instance_registry')
      .select('id, remote_instance_id, instance_name, phone, status, platform, is_business, token_last4, lifecycle, expires_at, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (instances || []).map((inst) => ({
      id: inst.id,
      key: inst.remote_instance_id,
      name: inst.instance_name,
      phone: inst.phone,
      status: inst.status,
      platform: inst.platform,
      isBusiness: inst.is_business,
      tokenLast4: inst.token_last4,
      lifecycle: inst.lifecycle,
      expiresAt: inst.expires_at,
      createdAt: inst.created_at,
    }));
  }

  /**
   * Criar nova instância
   * - Valida name/systemName
   * - Chama UazAPI para criar
   * - Salva em instance_registry com tenant_id
   * - Retorna: { instance, lease, providerAccount, token? }
   */
  async createInstance(tenantId, userId, { name, systemName = 'ruptur-dashboard', providerAccountId }) {
    if (!tenantId) throw new Error('tenantId obrigatório');
    if (!name || !name.trim()) throw new Error('name obrigatório');

    const payload = {
      tenantId,
      name: String(name).trim(),
      systemName: String(systemName).trim(),
      ...(providerAccountId ? { providerAccountId } : {}),
      returnToken: true,
    };

    const result = await this.uazapi.createManagedInstance(payload, userId);
    return result;
  }

  /**
   * Solicitar QR code ou paircode para conexão
   * - Busca instance_registry por tenant_id + key
   * - Chama getInstance() da UazAPI para obter QR code
   * - Retorna: { qrcode, status, instanceName, phone?, expiresAt? }
   */
  async connectInstance(tenantId, instanceKey, { phone } = {}) {
    if (!tenantId) throw new Error('tenantId obrigatório');
    if (!instanceKey) throw new Error('instanceKey obrigatório');

    // Validar que a instância pertence ao tenant
    const { data: instance, error: readError } = await this.supabase
      .from('instance_registry')
      .select('id, remote_instance_id, instance_name, tenant_provider_id, provider_account_id, status')
      .eq('tenant_id', tenantId)
      .eq('remote_instance_id', instanceKey)
      .maybeSingle();

    if (readError) throw readError;
    if (!instance) throw new Error('Instância não encontrada');

    // Obter account para criar adapter
    const { data: account, error: accountError } = await this.supabase
      .from('provider_accounts')
      .select('id, server_url, admin_token_enc')
      .eq('id', instance.provider_account_id)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account) throw new Error('Provider account não encontrado');

    // Usar adapter para obter QR code
    const adapter = this.uazapi.adapterFor(account);
    const remoteInstance = await adapter.getInstance(instanceKey);

    return {
      qrcode: remoteInstance.qrcode || null,
      status: remoteInstance.status || 'disconnected',
      instanceName: instance.instance_name,
      phone: remoteInstance.phone || null,
      expiresAt: remoteInstance.expiresAt || null,
      instance: remoteInstance,
    };
  }

  /**
   * Verificar status de conexão
   * - Busca em instance_registry por tenant_id + key
   * - Chama getInstance() da UazAPI para status atual
   * - Salva status atualizado
   * - Retorna: { status, phone, profileName, qrcode?, connected }
   */
  async getInstanceStatus(tenantId, instanceKey) {
    if (!tenantId) throw new Error('tenantId obrigatório');
    if (!instanceKey) throw new Error('instanceKey obrigatório');

    // Validar que a instância pertence ao tenant
    const { data: instance, error: readError } = await this.supabase
      .from('instance_registry')
      .select('id, remote_instance_id, instance_name, tenant_provider_id, provider_account_id, status')
      .eq('tenant_id', tenantId)
      .eq('remote_instance_id', instanceKey)
      .maybeSingle();

    if (readError) throw readError;
    if (!instance) throw new Error('Instância não encontrada');

    // Obter account
    const { data: account, error: accountError } = await this.supabase
      .from('provider_accounts')
      .select('id, server_url, admin_token_enc')
      .eq('id', instance.provider_account_id)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account) throw new Error('Provider account não encontrado');

    // Obter status da UazAPI
    const adapter = this.uazapi.adapterFor(account);
    const remoteInstance = await adapter.getInstance(instanceKey);
    const status = mapRemoteStatus(remoteInstance.status);

    // Atualizar em instance_registry
    const { error: updateError } = await this.supabase
      .from('instance_registry')
      .update({
        status,
        phone: remoteInstance.phone || null,
        is_business: Boolean(remoteInstance.isBusiness),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', instance.id);

    if (updateError) throw updateError;

    return {
      status,
      phone: remoteInstance.phone || null,
      profileName: remoteInstance.name || instance.instance_name,
      qrcode: remoteInstance.qrcode || null,
      connected: status === 'connected',
      isBusiness: remoteInstance.isBusiness,
    };
  }

  /**
   * Deletar instância (soft-delete)
   */
  async deleteInstance(tenantId, instanceKey) {
    if (!tenantId) throw new Error('tenantId obrigatório');
    if (!instanceKey) throw new Error('instanceKey obrigatório');

    // Validar que a instância pertence ao tenant
    const { data: instance, error: readError } = await this.supabase
      .from('instance_registry')
      .select('id, remote_instance_id, provider_account_id')
      .eq('tenant_id', tenantId)
      .eq('remote_instance_id', instanceKey)
      .maybeSingle();

    if (readError) throw readError;
    if (!instance) throw new Error('Instância não encontrada');

    // Deletar em instance_registry (soft-delete com updated_at)
    const { error: deleteError } = await this.supabase
      .from('instance_registry')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', instance.id);

    if (deleteError) throw deleteError;

    return { success: true, id: instance.id };
  }

  /**
   * Atualizar instância (nome, etc)
   */
  async updateInstance(tenantId, instanceKey, updates) {
    if (!tenantId) throw new Error('tenantId obrigatório');
    if (!instanceKey) throw new Error('instanceKey obrigatório');

    // Validar que a instância pertence ao tenant
    const { data: instance, error: readError } = await this.supabase
      .from('instance_registry')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('remote_instance_id', instanceKey)
      .maybeSingle();

    if (readError) throw readError;
    if (!instance) throw new Error('Instância não encontrada');

    const payload = {};
    if (updates.name) payload.instance_name = String(updates.name).trim();

    const { error: updateError } = await this.supabase
      .from('instance_registry')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', instance.id);

    if (updateError) throw updateError;

    return { success: true, id: instance.id };
  }
}

function mapRemoteStatus(status) {
  const text = typeof status === 'string' ? status.toLowerCase() : '';
  if (['connected', 'open', 'online'].includes(text)) return 'connected';
  if (['connecting', 'pairing', 'qrcode', 'qr'].includes(text)) return 'connecting';
  return text || 'disconnected';
}
