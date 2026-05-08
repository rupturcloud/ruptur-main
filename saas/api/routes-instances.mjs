/**
 * Rotas de Instâncias WhatsApp
 * GET/POST /api/instances
 * POST /api/instances/{key}/connect
 * GET /api/instances/{key}/status
 */

import { createUazapiAdapter } from '../modules/provider-adapter/uazapi-adapter.js';
import { decryptSecret } from '../modules/providers/uazapi-account.service.js';

const PROVIDER = 'uazapi';
const DEFAULT_SERVER_URL = 'https://free.uazapi.com';

/**
 * GET /api/instances
 * Listar instâncias do tenant logado
 */
export async function getInstances(req, res, json, supabase) {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return json ? json(res, 400, { error: 'Missing userId or tenantId' }, req) : res.status(400).json({ error: 'Missing userId or tenantId' });
    }

    // Buscar instâncias do tenant na instance_registry
    const { data: instances, error } = await supabase
      .from('instance_registry')
      .select('id, tenant_id, remote_instance_id, status, instance_name, instance_number, platform, metadata, is_business, last_seen_at, expires_at, lifecycle')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return json ? json(res, 500, { error: error.message }, req) : res.status(500).json({ error: error.message });
    }

    // Normalizar resposta
    const normalized = (instances || []).map((instance) => ({
      id: instance.id,
      token: instance.remote_instance_id,
      name: instance.instance_name,
      number: instance.instance_number,
      phone: instance.metadata?.phone || null,
      profileName: instance.metadata?.profileName || null,
      status: instance.status,
      connected: instance.status === 'connected',
      platform: instance.platform,
      isBusiness: instance.is_business,
      lifecycle: instance.lifecycle,
      expiresAt: instance.expires_at,
      lastSeen: instance.last_seen_at,
    }));

    return json ? json(res, 200, { instances: normalized }, req) : res.json({ instances: normalized });
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/instances
 * Criar nova instância para o tenant
 */
export async function createInstance(req, res, json, supabase) {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { name, systemName = 'ruptur-dashboard' } = req.body;

    if (!userId || !tenantId) {
      return json ? json(res, 400, { error: 'Missing userId or tenantId' }, req) : res.status(400).json({ error: 'Missing userId or tenantId' });
    }

    if (!name || !String(name).trim()) {
      return json ? json(res, 400, { error: 'Instance name is required' }, req) : res.status(400).json({ error: 'Instance name is required' });
    }

    // Buscar ou criar tenant_provider (integração UazAPI do tenant)
    const { data: tenantProviders, error: tpError } = await supabase
      .from('tenant_providers')
      .select('id, tenant_id, provider, provider_config')
      .eq('tenant_id', tenantId)
      .eq('provider', PROVIDER)
      .single();

    if (tpError && tpError.code !== 'PGRST116') {
      throw tpError;
    }

    // Se não existe tenant_provider, retorna erro informando que precisa configurar conta
    if (!tenantProviders) {
      return json
        ? json(res, 400, { error: 'Tenant not configured for WhatsApp. Please set up a provider account first.' }, req)
        : res.status(400).json({ error: 'Tenant not configured for WhatsApp. Please set up a provider account first.' });
    }

    // Pegar a conta de provider padrão (free ou primeira ativa)
    const { data: providerAccounts, error: paError } = await supabase
      .from('provider_accounts')
      .select('id, server_url, account_kind, used_instances, capacity_instances, status')
      .eq('provider', PROVIDER)
      .eq('status', 'active')
      .order('capacity_instances', { ascending: false })
      .limit(1);

    if (paError) throw paError;
    if (!providerAccounts || providerAccounts.length === 0) {
      return json
        ? json(res, 503, { error: 'No available WhatsApp provider accounts. Please contact support.' }, req)
        : res.status(503).json({ error: 'No available WhatsApp provider accounts. Please contact support.' });
    }

    const account = providerAccounts[0];
    const usedInstances = Number(account.used_instances || 0);
    const capacity = Number(account.capacity_instances || 0);

    if (capacity > 0 && usedInstances >= capacity) {
      return json
        ? json(res, 503, { error: 'Provider account capacity exceeded. Please contact support.' }, req)
        : res.status(503).json({ error: 'Provider account capacity exceeded. Please contact support.' });
    }
    const adapter = createUazapiAdapter({ serverUrl: account.server_url || DEFAULT_SERVER_URL });

    // Criar instância na UazAPI
    const created = await adapter.createInstance({
      name: String(name).trim(),
      systemName,
      adminField01: `tenant:${tenantId}`,
      adminField02: JSON.stringify({ tenantId, createdBy: userId }),
    });

    const remoteId = created.token || created.id;
    if (!remoteId) throw new Error('UAZAPI failed to return instance token');

    // Salvar na instance_registry
    const { data: registry, error: regError } = await supabase
      .from('instance_registry')
      .insert({
        tenant_id: tenantId,
        tenant_provider_id: tenantProviders.id,
        provider_account_id: account.id,
        remote_instance_id: remoteId,
        remote_account_id: account.server_url,
        status: 'connecting',
        instance_name: String(name).trim(),
        instance_number: created.number || null,
        platform: 'whatsapp',
        is_business: created.isBusiness || false,
        metadata: {
          createdBy: userId,
          createdAt: new Date().toISOString(),
          systemName,
        },
        lifecycle: 'temporary',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        source: 'user_created',
        token_last4: remoteId.slice(-4),
        last_seen_at: new Date().toISOString(),
      })
      .select('id, remote_instance_id, status, instance_name')
      .single();

    if (regError) throw regError;

    // Registrar evento
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action: 'instance_created',
        resource_type: 'instance',
        resource_id: registry.id,
        details: { name: registry.instance_name, token_last4: remoteId.slice(-4) },
      })
      .catch(() => null);

    return json
      ? json(res, 201, { instance: { id: registry.id, token: remoteId, name: registry.instance_name, status: 'connecting' } }, req)
      : res.status(201).json({ instance: { id: registry.id, token: remoteId, name: registry.instance_name, status: 'connecting' } });
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/instances/{key}/connect
 * Solicitar QR code ou paircode da instância
 */
export async function connectInstance(req, res, json, supabase) {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const instanceKey = req.params.key || req.query.key;
    const { phone } = req.body || {};

    if (!userId || !tenantId) {
      return json ? json(res, 400, { error: 'Missing userId or tenantId' }, req) : res.status(400).json({ error: 'Missing userId or tenantId' });
    }

    if (!instanceKey) {
      return json ? json(res, 400, { error: 'Instance key is required' }, req) : res.status(400).json({ error: 'Instance key is required' });
    }

    // Buscar instância do tenant
    const { data: instance, error: instError } = await supabase
      .from('instance_registry')
      .select('id, remote_instance_id, provider_account_id, tenant_provider_id, instance_name')
      .eq('tenant_id', tenantId)
      .or(`remote_instance_id.eq.${instanceKey},id.eq.${instanceKey}`)
      .single();

    if (instError || !instance) {
      return json
        ? json(res, 404, { error: 'Instance not found' }, req)
        : res.status(404).json({ error: 'Instance not found' });
    }

    // Buscar conta do provider
    const { data: account, error: accError } = await supabase
      .from('provider_accounts')
      .select('id, server_url, admin_token_enc, status')
      .eq('id', instance.provider_account_id)
      .single();

    if (accError || !account) {
      return json
        ? json(res, 500, { error: 'Provider account not found' }, req)
        : res.status(500).json({ error: 'Provider account not found' });
    }

    // Chamar UazAPI para obter QR code
    const adapter = createUazapiAdapter({ serverUrl: account.server_url || DEFAULT_SERVER_URL, adminToken: decryptSecret(account.admin_token_enc) });
    const result = await adapter.getInstance(instance.remote_instance_id);

    // Salvar phone se fornecido
    if (phone) {
      await supabase
        .from('instance_registry')
        .update({
          metadata: { phone },
          updated_at: new Date().toISOString(),
        })
        .eq('id', instance.id)
        .catch(() => null);
    }

    // Registrar evento
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action: 'instance_connect_requested',
        resource_type: 'instance',
        resource_id: instance.id,
        details: { phone: phone ? '***' : null },
      })
      .catch(() => null);

    return json
      ? json(res, 200, { qrcode: result.qrcode, paircode: result.paircode, status: result.status, instance: { name: instance.instance_name, id: instance.id } }, req)
      : res.json({ qrcode: result.qrcode, paircode: result.paircode, status: result.status, instance: { name: instance.instance_name, id: instance.id } });
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/instances/{key}/status
 * Verificar status de conexão da instância
 */
export async function getInstanceStatus(req, res, json, supabase) {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const instanceKey = req.params.key || req.query.key;

    if (!userId || !tenantId) {
      return json ? json(res, 400, { error: 'Missing userId or tenantId' }, req) : res.status(400).json({ error: 'Missing userId or tenantId' });
    }

    if (!instanceKey) {
      return json ? json(res, 400, { error: 'Instance key is required' }, req) : res.status(400).json({ error: 'Instance key is required' });
    }

    // Buscar instância do tenant
    const { data: instance, error: instError } = await supabase
      .from('instance_registry')
      .select('id, remote_instance_id, provider_account_id, instance_name, metadata')
      .eq('tenant_id', tenantId)
      .or(`remote_instance_id.eq.${instanceKey},id.eq.${instanceKey}`)
      .single();

    if (instError || !instance) {
      return json
        ? json(res, 404, { error: 'Instance not found' }, req)
        : res.status(404).json({ error: 'Instance not found' });
    }

    // Buscar conta do provider
    const { data: account, error: accError } = await supabase
      .from('provider_accounts')
      .select('server_url, admin_token_enc')
      .eq('id', instance.provider_account_id)
      .single();

    if (accError || !account) {
      return json
        ? json(res, 500, { error: 'Provider account not found' }, req)
        : res.status(500).json({ error: 'Provider account not found' });
    }

    // Chamar UazAPI para obter status
    const adapter = createUazapiAdapter({ serverUrl: account.server_url || DEFAULT_SERVER_URL, adminToken: decryptSecret(account.admin_token_enc) });
    const statusData = await adapter.getInstance(instance.remote_instance_id);

    // Normalizar resposta
    const normalized = {
      id: instance.id,
      token: instance.remote_instance_id,
      name: instance.instance_name,
      status: statusData.status || 'disconnected',
      connected: statusData.status === 'connected' || statusData.status === 'open',
      phone: statusData.phone || instance.metadata?.phone || null,
      profileName: statusData.profileName || statusData.profile_name || null,
      qrcode: statusData.qrcode,
      paircode: statusData.paircode || statusData.pairing_code,
    };

    // Atualizar status na instance_registry
    await supabase
      .from('instance_registry')
      .update({
        status: normalized.connected ? 'connected' : 'connecting',
        metadata: {
          ...instance.metadata,
          phone: normalized.phone,
          profileName: normalized.profileName,
          lastStatusCheck: new Date().toISOString(),
        },
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', instance.id)
      .catch(() => null);

    return json
      ? json(res, 200, normalized, req)
      : res.json(normalized);
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/instances/{key}
 * Deletar instância (soft-delete)
 */
export async function deleteInstance(req, res, json, supabase) {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const instanceKey = req.params.key || req.query.key;

    if (!userId || !tenantId) {
      return json ? json(res, 400, { error: 'Missing userId or tenantId' }, req) : res.status(400).json({ error: 'Missing userId or tenantId' });
    }

    if (!instanceKey) {
      return json ? json(res, 400, { error: 'Instance key is required' }, req) : res.status(400).json({ error: 'Instance key is required' });
    }

    // Buscar instância do tenant
    const { data: instance, error: instError } = await supabase
      .from('instance_registry')
      .select('id, instance_name')
      .eq('tenant_id', tenantId)
      .or(`remote_instance_id.eq.${instanceKey},id.eq.${instanceKey}`)
      .single();

    if (instError || !instance) {
      return json
        ? json(res, 404, { error: 'Instance not found' }, req)
        : res.status(404).json({ error: 'Instance not found' });
    }

    // Deletar (soft-delete com status deleted)
    const { error: deleteError } = await supabase
      .from('instance_registry')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', instance.id);

    if (deleteError) throw deleteError;

    // Registrar evento
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action: 'instance_deleted',
        resource_type: 'instance',
        resource_id: instance.id,
        details: { name: instance.instance_name },
      })
      .catch(() => null);

    return json
      ? json(res, 200, { success: true, id: instance.id }, req)
      : res.json({ success: true, id: instance.id });
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /api/instances/{key}
 * Atualizar instância (nome, etc)
 */
export async function updateInstance(req, res, json, supabase) {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const instanceKey = req.params.key || req.query.key;
    const { name } = req.body || {};

    if (!userId || !tenantId) {
      return json ? json(res, 400, { error: 'Missing userId or tenantId' }, req) : res.status(400).json({ error: 'Missing userId or tenantId' });
    }

    if (!instanceKey) {
      return json ? json(res, 400, { error: 'Instance key is required' }, req) : res.status(400).json({ error: 'Instance key is required' });
    }

    // Buscar instância do tenant
    const { data: instance, error: instError } = await supabase
      .from('instance_registry')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`remote_instance_id.eq.${instanceKey},id.eq.${instanceKey}`)
      .single();

    if (instError || !instance) {
      return json
        ? json(res, 404, { error: 'Instance not found' }, req)
        : res.status(404).json({ error: 'Instance not found' });
    }

    const updates = {};
    if (name) updates.instance_name = String(name).trim();
    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('instance_registry')
      .update(updates)
      .eq('id', instance.id);

    if (updateError) throw updateError;

    // Registrar evento
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action: 'instance_updated',
        resource_type: 'instance',
        resource_id: instance.id,
        details: { name },
      })
      .catch(() => null);

    return json
      ? json(res, 200, { success: true, id: instance.id }, req)
      : res.json({ success: true, id: instance.id });
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

export default {
  getInstances,
  createInstance,
  connectInstance,
  getInstanceStatus,
  deleteInstance,
  updateInstance,
};
