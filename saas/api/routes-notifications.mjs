/**
 * Rotas de Notificações
 * GET/PUT /api/notifications/preferences
 * GET /api/notifications/logs
 */

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        realtime: { transport: ws }
      }
    );
  }
  return supabase;
}

/**
 * GET /api/notifications/preferences
 * Retorna preferências de notificação do usuário
 */
export async function getNotificationPreferences(req, res, json) {
  try {
    const userId = req.user?.id;
    const tenantId = req.query.tenantId || req.user?.tenantId;

    if (!userId || !tenantId) {
      return json ? json(res, 400, { error: 'Missing userId or tenantId' }, req) : res.status(400).json({ error: 'Missing userId or tenantId' });
    }

    const { data, error } = await getSupabase()
      .from('notification_preferences')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    if (error) {
      return json ? json(res, 500, { error: error.message }, req) : res.status(500).json({ error: error.message });
    }

    return json ? json(res, 200, { preferences: data }, req) : res.json({ preferences: data });
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/notifications/preferences
 * Atualiza preferências de notificação
 */
export async function updateNotificationPreferences(req, res, json) {
  try {
    const userId = req.user?.id;
    const tenantId = req.body.tenantId || req.user?.tenantId;
    const { eventType, emailEnabled, smsEnabled, inAppEnabled, digestEnabled } = req.body;

    if (!userId || !tenantId || !eventType) {
      return json ? json(res, 400, { error: 'Missing required fields' }, req) : res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await getSupabase()
      .from('notification_preferences')
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        event_type: eventType,
        email_enabled: emailEnabled ?? true,
        sms_enabled: smsEnabled ?? false,
        in_app_enabled: inAppEnabled ?? true,
        digest_enabled: digestEnabled ?? false,
      }, {
        onConflict: 'tenant_id,user_id,event_type',
      })
      .select();

    if (error) {
      return json ? json(res, 500, { error: error.message }, req) : res.status(500).json({ error: error.message });
    }

    return json ? json(res, 200, { preference: data[0] }, req) : res.json({ preference: data[0] });
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/notifications/logs
 * Retorna histórico de notificações do usuário
 */
export async function getNotificationLogs(req, res, json) {
  try {
    const userId = req.user?.id;
    const tenantId = req.query.tenantId || req.user?.tenantId;
    const limit = parseInt(req.query.limit || '50');
    const offset = parseInt(req.query.offset || '0');

    if (!userId || !tenantId) {
      return json ? json(res, 400, { error: 'Missing userId or tenantId' }, req) : res.status(400).json({ error: 'Missing userId or tenantId' });
    }

    const { data, error, count } = await getSupabase()
      .from('notification_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return json ? json(res, 500, { error: error.message }, req) : res.status(500).json({ error: error.message });
    }

    const response = {
      logs: data,
      total: count,
      limit,
      offset,
    };
    return json ? json(res, 200, response, req) : res.json(response);
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/notifications/stats
 * Retorna estatísticas de notificações
 */
export async function getNotificationStats(req, res, json) {
  try {
    const userId = req.user?.id;
    const tenantId = req.query.tenantId || req.user?.tenantId;

    if (!userId || !tenantId) {
      return json ? json(res, 400, { error: 'Missing userId or tenantId' }, req) : res.status(400).json({ error: 'Missing userId or tenantId' });
    }

    // Contar por status
    const { data: byStatus, error: err1 } = await getSupabase()
      .from('notification_logs')
      .select('status', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    // Contar notificações enviadas nos últimos 7 dias
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: sentLast7Days } = await getSupabase()
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('status', 'sent')
      .gte('created_at', sevenDaysAgo);

    const response = {
      totalLogs: byStatus?.length || 0,
      sentLast7Days: sentLast7Days || 0,
    };
    return json ? json(res, 200, response, req) : res.json(response);
  } catch (err) {
    return json ? json(res, 500, { error: err.message }, req) : res.status(500).json({ error: err.message });
  }
}

export default {
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationLogs,
  getNotificationStats,
};
