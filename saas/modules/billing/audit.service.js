/**
 * AuditService — Auditoria Imutável de Operações de Billing
 *
 * Registra todas operações de billing em trilha imutável (append-only).
 *
 * Uso:
 * ```js
 * const auditService = new AuditService(supabase);
 * await auditService.log({
 *   tenantId: 'xxx',
 *   userId: 'yyy',
 *   action: 'purchase_credits',
 *   resourceType: 'payment',
 *   resourceId: 'zzz',
 *   newValue: { amount: 10000, status: 'completed' },
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 *   actingAsRole: 'admin'
 * });
 * ```
 */

export class AuditService {
  constructor(supabase) {
    this.db = supabase;
  }

  /**
   * Registrar operação em audit_logs
   * @param {Object} params
   * @returns {Promise<string>} audit_log_id
   */
  async log(params) {
    try {
      const {
        tenantId = null,
        userId,
        action,
        resourceType = null,
        resourceId = null,
        oldValue = null,
        newValue = null,
        ipAddress = null,
        userAgent = null,
        sessionId = null,
        actingAsRole = null,
        metadata = {}
      } = params;

      // Validações básicas
      if (!userId) throw new Error('userId é obrigatório');
      if (!action) throw new Error('action é obrigatório');

      // Insersão na tabela audit_logs
      const { data, error } = await this.db
        .from('audit_logs')
        .insert([
          {
            tenant_id: tenantId,
            user_id: userId,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            old_value: oldValue ? JSON.stringify(oldValue) : null,
            new_value: newValue ? JSON.stringify(newValue) : null,
            ip_address: ipAddress,
            user_agent: userAgent,
            session_id: sessionId,
            acting_as_role: actingAsRole,
            metadata: JSON.stringify(metadata),
            created_at: new Date().toISOString()
          }
        ])
        .select('id')
        .single();

      if (error) {
        console.error('Error inserting audit log:', error);
        throw error;
      }

      // Log local (para debugging imediato)
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'audit',
        action,
        userId,
        tenantId,
        resourceType,
        resourceId,
        actingAsRole,
        auditLogId: data?.id
      }));

      return data?.id;
    } catch (error) {
      console.error('AuditService.log error:', error);
      // Não relanço erro: auditoria nunca deve quebrar operação principal
      return null;
    }
  }

  /**
   * Obter histórico de auditoria para tenant/resource
   * @returns {Promise<Array>}
   */
  async getAuditHistory(tenantId, resourceType = null, resourceId = null, limit = 50) {
    try {
      let query = this.db
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }

      if (resourceId) {
        query = query.eq('resource_id', resourceId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching audit history:', error);
      return [];
    }
  }

  /**
   * Obter atividade de um usuário
   * @returns {Promise<Array>}
   */
  async getUserActivity(userId, tenantId = null, limit = 50) {
    try {
      let query = this.db
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching user activity:', error);
      return [];
    }
  }

  /**
   * Relatório de operações por ação
   * @returns {Promise<Array>}
   */
  async getActionReport(tenantId, action, startDate = null, endDate = null) {
    try {
      let query = this.db
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('action', action)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error generating action report:', error);
      return [];
    }
  }

  /**
   * Helper: Auditar compra de créditos
   */
  async logPurchaseCredits(params) {
    return this.log({
      ...params,
      action: 'purchase_credits',
      resourceType: 'payment'
    });
  }

  /**
   * Helper: Auditar webhook processado
   */
  async logWebhookProcessed(params) {
    return this.log({
      ...params,
      action: 'webhook_processed',
      resourceType: 'webhook'
    });
  }

  /**
   * Helper: Auditar refund
   */
  async logRefund(params) {
    return this.log({
      ...params,
      action: 'refund_issued',
      resourceType: 'refund'
    });
  }

  /**
   * Helper: Auditar mudança de permissões
   */
  async logPermissionChange(params) {
    return this.log({
      ...params,
      action: 'permission_changed',
      resourceType: 'permission'
    });
  }
}

export default AuditService;
