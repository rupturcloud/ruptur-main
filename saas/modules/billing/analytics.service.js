/**
 * AnalyticsService — Rastreamento de Eventos do Funil de Conversão
 *
 * Responsabilidades:
 * - Rastrear eventos: signup, plan_viewed, checkout_start, checkout_complete, upgrade
 * - Calcular métricas: conversion rate, ARPU, churn rate
 * - Fornecer dados para dashboards em tempo real
 *
 * Usa Supabase RLS para segurança multi-tenant
 */

export class AnalyticsService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Rastrear evento de analytics
   *
   * @param {string} event - Tipo de evento (signup, plan_viewed, checkout_start, etc)
   * @param {Object} properties - Propriedades customizáveis
   * @param {string} properties.tenantId - ID do tenant (obrigatório)
   * @param {string} properties.userId - ID do usuário
   * @param {string} properties.planId - ID do plano (se aplicável)
   * @param {number} properties.amount - Valor em centavos
   * @param {string} properties.currency - Moeda (BRL)
   * @param {string} properties.ipAddress - IP do usuário
   * @param {string} properties.userAgent - User agent
   * @returns {Promise<Object>} Evento registrado ou erro
   */
  async track(event, properties = {}) {
    const {
      tenantId,
      userId = null,
      ipAddress = null,
      userAgent = null,
      ...otherProps
    } = properties;

    if (!tenantId) {
      throw new Error('tenantId é obrigatório para rastreamento de eventos');
    }

    const validEvents = [
      'signup',
      'plan_viewed',
      'checkout_start',
      'checkout_complete',
      'upgrade',
      'trial_warning',
      'trial_expired',
      'churn',
    ];

    if (!validEvents.includes(event)) {
      throw new Error(`Tipo de evento inválido: ${event}`);
    }

    try {
      const { data, error } = await this.supabase
        .from('analytics_events')
        .insert({
          tenant_id: tenantId,
          event_type: event,
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent,
          properties: otherProps,
          created_at: new Date().toISOString(),
        })
        .select();

      if (error) {
        console.error(`[Analytics] Erro ao rastrear ${event}:`, error);
        throw error;
      }

      return data?.[0] || { ok: true };
    } catch (err) {
      console.error('[Analytics] Erro ao inserir evento:', err.message);
      throw err;
    }
  }

  /**
   * Obter métricas de conversão do funil
   *
   * @param {string} tenantId - ID do tenant
   * @param {Date} startDate - Data inicial (opcional, padrão: 30 dias atrás)
   * @param {Date} endDate - Data final (opcional, padrão: hoje)
   * @returns {Promise<Object>} Métricas de conversão
   */
  async getConversionMetrics(tenantId, startDate = null, endDate = null) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Usar view agregada de métricas de funil
      const { data, error } = await this.supabase
        .from('analytics_funnel_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows, ignorar
        throw error;
      }

      // Se não há dados, retornar zeros
      if (!data) {
        return {
          tenantId,
          totalSignups: 0,
          planViews: 0,
          checkoutStarts: 0,
          checkoutCompletes: 0,
          upgrades: 0,
          signupToPlanViewRate: 0,
          planViewToCheckoutRate: 0,
          checkoutCompletionRate: 0,
          trialToPaidConversionRate: 0,
          dateRange: { start: start.toISOString(), end: end.toISOString() },
        };
      }

      return {
        tenantId,
        totalSignups: data.total_signups || 0,
        planViews: data.plan_views || 0,
        checkoutStarts: data.checkout_starts || 0,
        checkoutCompletes: data.checkout_completes || 0,
        upgrades: data.upgrades || 0,
        signupToPlanViewRate: data.signup_to_plan_view_rate || 0,
        planViewToCheckoutRate: data.plan_view_to_checkout_rate || 0,
        checkoutCompletionRate: data.checkout_completion_rate || 0,
        trialToPaidConversionRate: data.trial_to_paid_conversion_rate || 0,
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      };
    } catch (err) {
      console.error('[Analytics] Erro ao calcular métricas de conversão:', err.message);
      throw err;
    }
  }

  /**
   * Obter métricas ARPU (Average Revenue Per User)
   *
   * @param {string} tenantId - ID do tenant
   * @returns {Promise<Object>} ARPU e métricas relacionadas
   */
  async getARPUMetrics(tenantId) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    try {
      // Buscar todos os eventos de pagamento/upgrade
      const { data, error } = await this.supabase
        .from('analytics_events')
        .select('properties, event_type')
        .eq('tenant_id', tenantId)
        .in('event_type', ['checkout_complete', 'upgrade']);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          tenantId,
          totalRevenue: 0,
          transactionCount: 0,
          arpu: 0,
          averageTransactionValue: 0,
        };
      }

      let totalRevenue = 0;
      let transactionCount = data.length;

      // Somar amounts de cada transação (em centavos)
      data.forEach((event) => {
        const amount = event.properties?.amount || 0;
        totalRevenue += amount;
      });

      // Obter número total de usuários únicos do tenant
      const { data: tenantData, error: tenantError } = await this.supabase
        .from('tenants')
        .select('users', { count: 'exact' })
        .eq('id', tenantId)
        .single();

      if (tenantError) throw tenantError;

      const userCount = Math.max(tenantData?.users?.length || 1, 1);

      return {
        tenantId,
        totalRevenue: Math.round(totalRevenue / 100), // Converter para unidade (reais)
        transactionCount,
        arpu: Math.round((totalRevenue / 100) / userCount * 100) / 100, // ARPU em reais
        averageTransactionValue: Math.round((totalRevenue / 100) / transactionCount * 100) / 100,
      };
    } catch (err) {
      console.error('[Analytics] Erro ao calcular ARPU:', err.message);
      throw err;
    }
  }

  /**
   * Obter taxa de churn
   *
   * @param {string} tenantId - ID do tenant
   * @returns {Promise<Object>} Dados de churn
   */
  async getChurnMetrics(tenantId) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    try {
      const { data, error } = await this.supabase
        .from('analytics_events')
        .select('event_type', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .in('event_type', ['churn']);

      if (error) throw error;

      // Obter total de usuários ativos
      const { data: metrics, error: metricsError } = await this.supabase
        .from('analytics_funnel_metrics')
        .select('total_signups')
        .eq('tenant_id', tenantId)
        .single();

      if (metricsError && metricsError.code !== 'PGRST116') throw metricsError;

      const totalSignups = metrics?.total_signups || 1;
      const churnCount = data?.length || 0;
      const churnRate = Math.round((churnCount / totalSignups) * 100 * 100) / 100; // Percentual com 2 casas

      return {
        tenantId,
        churnCount,
        totalSignups,
        churnRate, // Em percentual
      };
    } catch (err) {
      console.error('[Analytics] Erro ao calcular churn:', err.message);
      throw err;
    }
  }

  /**
   * Obter resumo do dashboard (múltiplas métricas)
   *
   * @param {string} tenantId - ID do tenant
   * @returns {Promise<Object>} Resumo completo
   */
  async getDashboardMetrics(tenantId) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    try {
      const [conversionMetrics, arpuMetrics, churnMetrics] = await Promise.all([
        this.getConversionMetrics(tenantId),
        this.getARPUMetrics(tenantId),
        this.getChurnMetrics(tenantId),
      ]);

      return {
        tenantId,
        timestamp: new Date().toISOString(),
        conversion: conversionMetrics,
        revenue: arpuMetrics,
        churn: churnMetrics,
      };
    } catch (err) {
      console.error('[Analytics] Erro ao obter dashboard metrics:', err.message);
      throw err;
    }
  }

  /**
   * Obter histórico de eventos
   *
   * @param {string} tenantId - ID do tenant
   * @param {Object} filters - Filtros opcionais
   * @param {string} filters.eventType - Tipo de evento
   * @param {number} filters.limit - Limite de registros (padrão: 100)
   * @param {number} filters.offset - Offset para paginação
   * @returns {Promise<Array>} Lista de eventos
   */
  async getEventHistory(tenantId, filters = {}) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    const { eventType = null, limit = 100, offset = 0 } = filters;

    try {
      let query = this.supabase
        .from('analytics_events')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        events: data || [],
        total: count || 0,
        limit,
        offset,
      };
    } catch (err) {
      console.error('[Analytics] Erro ao obter histórico de eventos:', err.message);
      throw err;
    }
  }
}
