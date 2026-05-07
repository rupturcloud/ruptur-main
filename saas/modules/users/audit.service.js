/**
 * AuditService
 * Query e formatação de logs de auditoria
 * Os triggers do Supabase mantêm o registro automaticamente
 */

import { createClient } from '@supabase/supabase-js';

class AuditService {
  constructor(supabaseUrl, supabaseKey) {
    this.client = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Obter logs de auditoria de um tenant
   */
  async getTenantAuditLogs(tenantId, options = {}) {
    const {
      action = null,
      userId = null,
      limit = 100,
      offset = 0,
      startDate = null,
      endDate = null,
    } = options;

    let query = this.client
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId);

    if (action) {
      query = query.eq('action', action);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`);

    return {
      logs: this._formatLogs(data),
      total: count,
      limit,
      offset,
    };
  }

  /**
   * Obter logs de um usuário específico em um tenant
   */
  async getUserAuditLog(tenantId, userId, limit = 50) {
    const { data, error } = await this.client
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('resource_type', 'user_role')
      .or(`user_id.eq.${userId},resource_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch user audit log: ${error.message}`);
    return this._formatLogs(data);
  }

  /**
   * Obter logs de invites de um tenant
   */
  async getInviteAuditLog(tenantId, limit = 50) {
    const { data, error } = await this.client
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('resource_type', 'user_invite')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch invite audit log: ${error.message}`);
    return this._formatLogs(data);
  }

  /**
   * Obter logs de confirmação de ações críticas
   */
  async getActionTokenAuditLog(tenantId, limit = 50) {
    const { data, error } = await this.client
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('action', 'action_confirmed_%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch action token audit log: ${error.message}`);
    return this._formatLogs(data);
  }

  /**
   * Exportar logs em CSV para compliance/auditoria externa
   */
  async exportAuditLogsCSV(tenantId, options = {}) {
    const logs = await this.getTenantAuditLogs(tenantId, { ...options, limit: 10000 });

    const headers = ['Data', 'Ação', 'Usuário', 'Recurso', 'Detalhes'];
    const rows = logs.logs.map(log => [
      log.created_at,
      log.action,
      log.user_id,
      `${log.resource_type}:${log.resource_id}`,
      JSON.stringify(log.new_value),
    ]);

    return this._csvFormat(headers, rows);
  }

  // ===== HELPERS PRIVADOS =====

  _formatLogs(logs) {
    if (!logs) return [];

    return logs.map(log => ({
      id: log.id,
      timestamp: new Date(log.created_at),
      action: log.action,
      userId: log.user_id,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      oldValue: log.old_value,
      newValue: log.new_value,
      metadata: log.metadata,
      actingAsRole: log.acting_as_role,
    }));
  }

  _csvFormat(headers, rows) {
    const csv = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }
}

export default AuditService;
