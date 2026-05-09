/**
 * Feature Flags Service — Tier 1 Billing
 *
 * Define quais features estão disponíveis em cada plano.
 * Hardcoded (não dinâmico) para performance.
 *
 * Uso:
 *   const featureFlags = new FeatureFlagsService(supabase);
 *   const canCreateInstance = await featureFlags.canCreateInstance(tenantId);
 *   const features = await featureFlags.getFeatures(tenantId);
 */

export class FeatureFlagsService {
  constructor(supabase) {
    this.supabase = supabase;

    // Definição de features por plano (hardcoded)
    this.planFeatures = {
      trial: {
        canCreateInstance: { max: 1 },
        canUseInbox: false,
        canUseWorkflows: false,
        canUseAnalytics: false,
        canAccessAPI: false,
        maxCampaignsActive: 1,
        support: 'email',
      },
      starter: {
        canCreateInstance: { max: 5 },
        canUseInbox: true,
        canUseWorkflows: 'basic', // true ou 'basic'
        canUseAnalytics: false,
        canAccessAPI: false,
        maxCampaignsActive: 10,
        support: 'email',
      },
      pro: {
        canCreateInstance: { max: 20 },
        canUseInbox: true,
        canUseWorkflows: 'advanced', // true ou 'advanced'
        canUseAnalytics: true,
        canAccessAPI: true,
        maxCampaignsActive: 50,
        support: 'priority',
      },
      enterprise: {
        canCreateInstance: { max: 999 },
        canUseInbox: true,
        canUseWorkflows: 'advanced',
        canUseAnalytics: true,
        canAccessAPI: true,
        maxCampaignsActive: 9999,
        support: 'dedicated',
        whiteLabel: true,
      },
    };
  }

  /**
   * Obter plano ativo do tenant
   */
  async getPlan(tenantId) {
    if (!this.supabase) return 'trial';

    const { data } = await this.supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'authorized')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.plan_id || 'trial';
  }

  /**
   * Validar se tenant pode criar instance
   * Retorna: { allowed: boolean, current: number, max: number }
   */
  async canCreateInstance(tenantId) {
    const planId = await this.getPlan(tenantId);
    const features = this.planFeatures[planId] || this.planFeatures.trial;
    const max = features.canCreateInstance?.max || 1;

    // Contar instances atuais
    let current = 0;
    if (this.supabase) {
      const { data: instances } = await this.supabase
        .from('instance_registry')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId);
      current = instances?.length || 0;
    }

    return {
      allowed: current < max,
      current,
      max,
      plan: planId,
    };
  }

  /**
   * Validar acesso à Inbox
   */
  async canUseInbox(tenantId) {
    const planId = await this.getPlan(tenantId);
    const features = this.planFeatures[planId] || this.planFeatures.trial;
    return {
      allowed: features.canUseInbox === true,
      value: features.canUseInbox,
      plan: planId,
    };
  }

  /**
   * Validar acesso à Workflows
   * Retorna: { allowed, level: 'basic' | 'advanced' | false }
   */
  async canUseWorkflows(tenantId) {
    const planId = await this.getPlan(tenantId);
    const features = this.planFeatures[planId] || this.planFeatures.trial;
    const value = features.canUseWorkflows;

    return {
      allowed: value !== false,
      level: value === true ? 'advanced' : value, // 'basic', 'advanced', or false
      value,
      plan: planId,
    };
  }

  /**
   * Validar acesso à Analytics
   */
  async canUseAnalytics(tenantId) {
    const planId = await this.getPlan(tenantId);
    const features = this.planFeatures[planId] || this.planFeatures.trial;
    return {
      allowed: features.canUseAnalytics === true,
      value: features.canUseAnalytics,
      plan: planId,
    };
  }

  /**
   * Validar acesso à API
   */
  async canAccessAPI(tenantId) {
    const planId = await this.getPlan(tenantId);
    const features = this.planFeatures[planId] || this.planFeatures.trial;
    return {
      allowed: features.canAccessAPI === true,
      value: features.canAccessAPI,
      plan: planId,
    };
  }

  /**
   * Obter máximo de campaigns ativas
   */
  async maxCampaignsActive(tenantId) {
    const planId = await this.getPlan(tenantId);
    const features = this.planFeatures[planId] || this.planFeatures.trial;
    return {
      max: features.maxCampaignsActive || 1,
      plan: planId,
    };
  }

  /**
   * Obter todas features de um tenant
   */
  async getFeatures(tenantId) {
    const planId = await this.getPlan(tenantId);
    const features = this.planFeatures[planId] || this.planFeatures.trial;

    return {
      planId,
      features,
    };
  }

  /**
   * Obter features de um plano específico (sem validação de tenant)
   */
  getFeaturesByPlan(planId) {
    return this.planFeatures[planId] || this.planFeatures.trial;
  }

  /**
   * Validar feature genérica
   * Suporta: feature em objetos aninhados com dot notation
   */
  async validateFeature(tenantId, featurePath) {
    const planId = await this.getPlan(tenantId);
    const features = this.planFeatures[planId] || this.planFeatures.trial;

    // Suportar dot notation: 'canCreateInstance.max' → features.canCreateInstance.max
    const keys = featurePath.split('.');
    let value = features;
    for (const key of keys) {
      value = value?.[key];
    }

    return {
      allowed: value !== false && value !== undefined,
      value,
      plan: planId,
      feature: featurePath,
    };
  }
}

export default FeatureFlagsService;
