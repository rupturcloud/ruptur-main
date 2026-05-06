import crypto from 'node:crypto';
import { createUazapiAdapter } from '../provider-adapter/uazapi-adapter.js';

const DEFAULT_SERVER_URL = 'https://free.uazapi.com';
const PROVIDER = 'uazapi';

function normalizeServerUrl(value) {
  const url = String(value || DEFAULT_SERVER_URL).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) return `https://${url}`.replace(/\/+$/, '');
  return url;
}

function secretKey() {
  const source = process.env.PROVIDER_SECRET_KEY || process.env.SECRETS_MASTER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ruptur-dev-provider-secret';
  return crypto.createHash('sha256').update(source).digest();
}

function encryptSecret(plainText) {
  if (!plainText) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptSecret(cipherText) {
  if (!cipherText) return null;
  const raw = String(cipherText);
  if (!raw.startsWith('v1:')) return raw;
  const [, ivB64, tagB64, dataB64] = raw.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function tokenLast4(value) {
  const text = String(value || '');
  return text ? text.slice(-4) : null;
}

function extractTenantId(normalized) {
  const raw = normalized?.metadata?.raw || {};
  const candidates = [
    normalized?.metadata?.adminField01,
    raw.adminField01,
    raw.tenantId,
    raw.tenant_id,
  ];

  for (const value of candidates) {
    const text = String(value || '').trim();
    const tagged = text.match(/tenant:([0-9a-fA-F-]{36})/);
    if (tagged?.[1]) return tagged[1];
    if (/^[0-9a-fA-F-]{36}$/.test(text)) return text;
  }

  for (const value of [normalized?.metadata?.adminField02, raw.adminField02]) {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      const tenantId = String(parsed?.tenantId || parsed?.tenant_id || '').trim();
      if (/^[0-9a-fA-F-]{36}$/.test(tenantId)) return tenantId;
    } catch {}
  }

  return null;
}

function mapRemoteStatus(status) {
  const text = typeof status === 'string' ? status.toLowerCase() : '';
  if (['connected', 'open', 'online'].includes(text)) return 'connected';
  if (['connecting', 'pairing', 'qrcode', 'qr'].includes(text)) return 'connecting';
  return text || 'disconnected';
}

export class UazapiAccountService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  publicAccount(row) {
    if (!row) return null;
    const { admin_token_enc, ...safe } = row;
    return {
      ...safe,
      used_instances: Number(row.used_instances || 0),
      capacity_instances: Number(row.capacity_instances || 0),
    };
  }

  async listAccounts() {
    const { data, error } = await this.supabase
      .from('provider_accounts')
      .select('id, provider, label, server_url, account_kind, plan_label, capacity_instances, used_instances, status, admin_token_last4, expires_at, rotation_policy, metadata, created_at, updated_at')
      .eq('provider', PROVIDER)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getAccount(id) {
    const { data, error } = await this.supabase
      .from('provider_accounts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  async createAccount(payload, actorUserId) {
    const adminToken = String(payload.adminToken || payload.admin_token || '').trim();
    if (!adminToken) throw new Error('adminToken obrigatório');

    const row = {
      provider: PROVIDER,
      label: String(payload.label || 'UAZAPI').trim(),
      server_url: normalizeServerUrl(payload.serverUrl || payload.server_url),
      account_kind: payload.accountKind || payload.account_kind || 'free',
      plan_label: payload.planLabel || payload.plan_label || null,
      capacity_instances: Number(payload.capacityInstances || payload.capacity_instances || 1),
      status: payload.status || 'active',
      admin_token_enc: encryptSecret(adminToken),
      admin_token_last4: tokenLast4(adminToken),
      expires_at: payload.expiresAt || payload.expires_at || null,
      rotation_policy: payload.rotationPolicy || payload.rotation_policy || { mode: 'manual' },
      metadata: payload.metadata || {},
      created_by: actorUserId,
    };

    const { data, error } = await this.supabase
      .from('provider_accounts')
      .insert(row)
      .select('id, provider, label, server_url, account_kind, plan_label, capacity_instances, used_instances, status, admin_token_last4, expires_at, rotation_policy, metadata, created_at, updated_at')
      .single();
    if (error) throw error;

    await this.recordEvent(data.id, 'account_created', { actorUserId, label: row.label });
    return data;
  }

  async rotateAccount(id, adminToken, actorUserId) {
    if (!adminToken) throw new Error('adminToken obrigatório');
    const { data, error } = await this.supabase
      .from('provider_accounts')
      .update({
        admin_token_enc: encryptSecret(adminToken),
        admin_token_last4: tokenLast4(adminToken),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, provider, label, server_url, account_kind, plan_label, capacity_instances, used_instances, status, admin_token_last4, expires_at, rotation_policy, metadata, created_at, updated_at')
      .single();
    if (error) throw error;
    await this.recordEvent(id, 'account_rotated', { actorUserId });
    return data;
  }

  async updateStatus(id, status, actorUserId) {
    if (!['active', 'capacity_full', 'draining', 'disabled', 'expired'].includes(status)) {
      throw new Error('status inválido');
    }
    const { data, error } = await this.supabase
      .from('provider_accounts')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, provider, label, server_url, account_kind, plan_label, capacity_instances, used_instances, status, admin_token_last4, expires_at, rotation_policy, metadata, created_at, updated_at')
      .single();
    if (error) throw error;
    await this.recordEvent(id, 'account_status_changed', { actorUserId, status });
    return data;
  }

  adapterFor(account) {
    return createUazapiAdapter({
      serverUrl: account.server_url,
      adminToken: decryptSecret(account.admin_token_enc),
    });
  }

  async ensureTenantProvider(tenantId, account) {
    const accountId = `provider_account:${account.id}`;
    const { data: existing, error: readError } = await this.supabase
      .from('tenant_providers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('provider', PROVIDER)
      .eq('account_id', accountId)
      .maybeSingle();
    if (readError) throw readError;
    if (existing?.id) return existing.id;

    const { data, error } = await this.supabase
      .from('tenant_providers')
      .insert({
        tenant_id: tenantId,
        provider: PROVIDER,
        account_id: accountId,
        metadata: { providerAccountId: account.id, serverUrl: account.server_url, managedBy: 'ruptur-platform' },
        is_active: true,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  }

  async syncAccount(id, actorUserId) {
    const account = await this.getAccount(id);
    const adapter = this.adapterFor(account);
    const instances = await adapter.listInstances();
    let upserted = 0;

    for (const instance of instances) {
      const tenantId = extractTenantId(instance);
      if (!tenantId) continue;
      const tenantProviderId = await this.ensureTenantProvider(tenantId, account);
      const remoteId = instance.id;
      if (!remoteId) continue;

      const { error } = await this.supabase
        .from('instance_registry')
        .upsert({
          tenant_provider_id: tenantProviderId,
          tenant_id: tenantId,
          provider_account_id: account.id,
          remote_instance_id: remoteId,
          remote_account_id: account.server_url,
          status: mapRemoteStatus(instance.status),
          instance_number: instance.number,
          instance_name: instance.name,
          is_business: Boolean(instance.isBusiness),
          platform: instance.platform,
          metadata: instance.metadata || {},
          token_last4: tokenLast4(remoteId),
          source: 'sync',
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_provider_id,remote_instance_id' });
      if (error) throw error;
      upserted += 1;
    }

    const used = instances.length;
    const capacity = Number(account.capacity_instances || 0);
    const nextStatus = account.status === 'disabled' || account.status === 'draining'
      ? account.status
      : (capacity > 0 && used >= capacity ? 'capacity_full' : 'active');

    await this.supabase
      .from('provider_accounts')
      .update({ used_instances: used, status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', account.id);

    await this.recordEvent(account.id, 'account_synced', { actorUserId, remoteInstances: instances.length, upserted });
    return { accountId: account.id, remoteInstances: instances.length, upserted, status: nextStatus };
  }

  async pickAccount({ accountKind = 'free', providerAccountId } = {}) {
    if (providerAccountId) return this.getAccount(providerAccountId);

    let query = this.supabase
      .from('provider_accounts')
      .select('*')
      .eq('provider', PROVIDER)
      .eq('status', 'active')
      .order('used_instances', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(10);

    if (accountKind) query = query.eq('account_kind', accountKind);

    const { data, error } = await query;
    if (error) throw error;
    const available = (data || []).find((account) => {
      const capacity = Number(account.capacity_instances || 0);
      return capacity <= 0 || Number(account.used_instances || 0) < capacity;
    });
    if (!available) throw new Error(`Nenhuma conta UAZAPI ativa com capacidade para ${accountKind}`);
    return available;
  }

  async createManagedInstance(payload, actorUserId) {
    const tenantId = String(payload.tenantId || payload.tenant_id || '').trim();
    if (!tenantId) throw new Error('tenantId obrigatório');

    const accountKind = payload.accountKind || payload.account_kind || (payload.leaseType === 'paid_persistent' ? 'paid' : 'free');
    const leaseType = payload.leaseType || payload.lease_type || (accountKind === 'free' ? 'free_1h' : 'paid_persistent');
    const lifecycle = leaseType === 'free_1h' ? 'temporary' : 'persistent';
    const expiresAt = lifecycle === 'temporary'
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      : (payload.expiresAt || payload.expires_at || null);

    const account = await this.pickAccount({ accountKind, providerAccountId: payload.providerAccountId || payload.provider_account_id });
    const tenantProviderId = await this.ensureTenantProvider(tenantId, account);
    const adapter = this.adapterFor(account);

    const name = String(payload.name || `ruptur-${tenantId.slice(0, 8)}-${Date.now().toString(36)}`).trim();
    const created = await adapter.createInstance({
      name,
      systemName: payload.systemName || 'ruptur-cloud',
      adminField01: `tenant:${tenantId}`,
      adminField02: `lease:${leaseType};expires:${expiresAt || 'none'}`,
    });
    const instance = adapter.normalizeInstance(created);
    const remoteId = instance.id || created.token || created.id;
    if (!remoteId) throw new Error('UAZAPI não retornou token/id da instância');

    const { data: registry, error: registryError } = await this.supabase
      .from('instance_registry')
      .upsert({
        tenant_provider_id: tenantProviderId,
        tenant_id: tenantId,
        provider_account_id: account.id,
        remote_instance_id: remoteId,
        remote_account_id: account.server_url,
        status: mapRemoteStatus(instance.status),
        instance_number: instance.number,
        instance_name: instance.name || name,
        is_business: Boolean(instance.isBusiness),
        platform: instance.platform,
        metadata: { ...(instance.metadata || {}), createdBy: 'ruptur-platform' },
        lifecycle,
        expires_at: expiresAt,
        source: 'created_by_platform',
        token_last4: tokenLast4(remoteId),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_provider_id,remote_instance_id' })
      .select('id, tenant_id, provider_account_id, remote_instance_id, status, instance_name, token_last4, lifecycle, expires_at, created_at')
      .single();
    if (registryError) throw registryError;

    const { data: lease, error: leaseError } = await this.supabase
      .from('api_leases')
      .insert({
        tenant_id: tenantId,
        provider_account_id: account.id,
        instance_registry_id: registry.id,
        lease_type: leaseType,
        status: 'active',
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
        created_by: actorUserId,
        metadata: { name, accountKind },
      })
      .select('id, lease_type, status, starts_at, expires_at')
      .single();
    if (leaseError) throw leaseError;

    await this.syncAccount(account.id, actorUserId).catch(() => null);
    await this.recordEvent(account.id, 'instance_created', { actorUserId, tenantId, registryId: registry.id, leaseType });

    return {
      instance: registry,
      lease,
      providerAccount: this.publicAccount(account),
      tokenLast4: tokenLast4(remoteId),
      token: payload.returnToken === true ? remoteId : undefined,
      raw: { id: created.id, name: created.name, status: created.status },
    };
  }

  async recordEvent(providerAccountId, eventType, payload = {}) {
    if (!providerAccountId) return;
    await this.supabase
      .from('provider_account_events')
      .insert({ provider_account_id: providerAccountId, actor_user_id: payload.actorUserId || null, tenant_id: payload.tenantId || null, instance_registry_id: payload.registryId || null, event_type: eventType, details: payload })
      .throwOnError?.();
  }
}

export { encryptSecret, decryptSecret, tokenLast4 };
