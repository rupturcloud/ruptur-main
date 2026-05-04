export class MetricsService {
  constructor(supabase, auditService) {
    this.supabase = supabase;
    this.audit = auditService;
  }

  /**
   * Obter estatísticas de webhooks para um período
   */
  async getWebhookStats(tenantId, startDate, endDate) {
    try {
      const { data: stats, error } = await this.supabase
        .from('webhook_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) {
        throw new Error(`Erro ao buscar estatísticas de webhooks: ${error.message}`);
      }

      const total = stats?.length || 0;
      const successful = stats?.filter(s => s.status === 'success').length || 0;
      const failed = stats?.filter(s => s.status === 'failed').length || 0;

      return {
        total,
        successful,
        failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
      };
    } catch (e) {
      console.error('[MetricsService] Erro em getWebhookStats:', e.message);
      throw e;
    }
  }

  /**
   * Obter estatísticas de pagamentos para um período
   */
  async getPaymentStats(tenantId, startDate, endDate) {
    try {
      const { data: payments, error } = await this.supabase
        .from('payments')
        .select('amount_cents, status')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) {
        throw new Error(`Erro ao buscar estatísticas de pagamentos: ${error.message}`);
      }

      const total = payments?.length || 0;
      const totalAmount = (payments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0) / 100;
      const completed = payments?.filter(p => p.status === 'APPROVED').length || 0;
      const pending = payments?.filter(p => p.status === 'INITIATED').length || 0;
      const failed = payments?.filter(p => p.status === 'DECLINED').length || 0;

      return {
        total,
        totalAmount: totalAmount.toFixed(2),
        completed,
        pending,
        failed,
        averageAmount: total > 0 ? (totalAmount / total).toFixed(2) : 0,
      };
    } catch (e) {
      console.error('[MetricsService] Erro em getPaymentStats:', e.message);
      throw e;
    }
  }

  /**
   * Obter status de saúde do sistema de billing
   */
  async getHealthCheck(tenantId) {
    try {
      const { data: webhooks, error: webhookError } = await this.supabase
        .from('webhook_events')
        .select('status')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: wallet, error: walletError } = await this.supabase
        .from('wallets')
        .select('balance, version')
        .eq('tenant_id', tenantId)
        .single();

      const failedWebhooks = webhooks?.filter(w => w.status === 'failed').length || 0;

      return {
        status: failedWebhooks > 2 ? 'warning' : 'healthy',
        wallet: {
          balance: wallet?.balance || 0,
          version: wallet?.version || 0,
        },
        recentFailures: failedWebhooks,
        lastChecked: new Date().toISOString(),
      };
    } catch (e) {
      console.error('[MetricsService] Erro em getHealthCheck:', e.message);
      return {
        status: 'error',
        error: e.message,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Obter relatório de auditoria para um período
   */
  async getAuditReport(tenantId, startDate, endDate) {
    try {
      const { data: payments, error: paymentError } = await this.supabase
        .from('payments')
        .select('id, amount_cents, status, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      const { data: refunds, error: refundError } = await this.supabase
        .from('refunds')
        .select('id, amount_cents, status, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      const { data: webhooks, error: webhookError } = await this.supabase
        .from('webhook_events')
        .select('id, event_type, status, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      return {
        period: {
          start: startDate,
          end: endDate,
        },
        payments: {
          total: payments?.length || 0,
          totalAmount: ((payments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0) / 100).toFixed(2),
          byStatus: {
            approved: payments?.filter(p => p.status === 'APPROVED').length || 0,
            initiated: payments?.filter(p => p.status === 'INITIATED').length || 0,
            declined: payments?.filter(p => p.status === 'DECLINED').length || 0,
          },
        },
        refunds: {
          total: refunds?.length || 0,
          totalAmount: ((refunds?.reduce((sum, r) => sum + (r.amount_cents || 0), 0) || 0) / 100).toFixed(2),
          byStatus: {
            pending: refunds?.filter(r => r.status === 'pending').length || 0,
            completed: refunds?.filter(r => r.status === 'completed').length || 0,
            failed: refunds?.filter(r => r.status === 'failed').length || 0,
          },
        },
        webhooks: {
          total: webhooks?.length || 0,
          byType: {
            payment_status_update: webhooks?.filter(w => w.event_type === 'payment_status_update').length || 0,
            chargeback: webhooks?.filter(w => w.event_type === 'chargeback').length || 0,
            refund: webhooks?.filter(w => w.event_type === 'refund').length || 0,
          },
          byStatus: {
            success: webhooks?.filter(w => w.status === 'success').length || 0,
            failed: webhooks?.filter(w => w.status === 'failed').length || 0,
          },
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (e) {
      console.error('[MetricsService] Erro em getAuditReport:', e.message);
      throw e;
    }
  }
}

export default MetricsService;
