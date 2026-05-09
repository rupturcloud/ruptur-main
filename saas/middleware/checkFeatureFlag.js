/**
 * Middleware: Check Feature Flag
 *
 * Valida se tenant tem acesso a uma feature antes de processar a rota.
 * Se negado, retorna 403 com mensagem clara.
 *
 * Uso:
 *   const checkInbox = checkFeatureFlag(featureFlags, 'canUseInbox');
 *   const checkWorkflows = checkFeatureFlag(featureFlags, 'canUseWorkflows');
 *
 *   if (checkInbox.allowed && checkWorkflows.allowed) {
 *     // Processar
 *   } else {
 *     return json(res, 403, { error: 'Feature não disponível neste plano' }, req);
 *   }
 */

export function createCheckFeatureFlag(featureFlagsService) {
  return async (tenantId, featureName) => {
    try {
      const validation = await featureFlagsService.validateFeature(tenantId, featureName);
      return validation;
    } catch (e) {
      console.error('[CheckFeatureFlag] Erro:', e.message);
      return {
        allowed: false,
        error: e.message,
        feature: featureName,
      };
    }
  };
}

/**
 * Helpers de validação por feature
 */

export const featureValidators = {
  /**
   * Validar inbox
   */
  inbox: async (featureFlagsService, tenantId) => {
    const result = await featureFlagsService.canUseInbox(tenantId);
    return {
      ...result,
      featureName: 'canUseInbox',
      errorMessage: 'Inbox não disponível neste plano. Faça upgrade para Starter.',
    };
  },

  /**
   * Validar workflows com nível
   */
  workflows: async (featureFlagsService, tenantId, requiredLevel = 'basic') => {
    const result = await featureFlagsService.canUseWorkflows(tenantId);

    if (!result.allowed) {
      return {
        ...result,
        featureName: 'canUseWorkflows',
        errorMessage: 'Workflows não disponível neste plano. Faça upgrade para Starter.',
      };
    }

    // Validar nível (basic vs advanced)
    const levelMap = { basic: 1, advanced: 2 };
    const required = levelMap[requiredLevel] || 1;
    const actual = levelMap[result.level] || 0;

    if (actual < required) {
      return {
        ...result,
        allowed: false,
        featureName: 'canUseWorkflows',
        errorMessage: `Workflows ${requiredLevel} requer plano Pro. Você tem ${result.level || 'nenhum'}.`,
      };
    }

    return {
      ...result,
      allowed: true,
      featureName: 'canUseWorkflows',
    };
  },

  /**
   * Validar analytics
   */
  analytics: async (featureFlagsService, tenantId) => {
    const result = await featureFlagsService.canUseAnalytics(tenantId);
    return {
      ...result,
      featureName: 'canUseAnalytics',
      errorMessage: 'Analytics não disponível neste plano. Faça upgrade para Pro.',
    };
  },

  /**
   * Validar API
   */
  api: async (featureFlagsService, tenantId) => {
    const result = await featureFlagsService.canAccessAPI(tenantId);
    return {
      ...result,
      featureName: 'canAccessAPI',
      errorMessage: 'Acesso à API não disponível neste plano. Faça upgrade para Pro.',
    };
  },

  /**
   * Validar criação de instances
   */
  instances: async (featureFlagsService, tenantId) => {
    const result = await featureFlagsService.canCreateInstance(tenantId);
    return {
      ...result,
      featureName: 'canCreateInstance',
      errorMessage: result.allowed
        ? undefined
        : `Limite de ${result.max} instâncias atingido. Faça upgrade do plano.`,
    };
  },

  /**
   * Validar campaigns
   */
  campaigns: async (featureFlagsService, tenantId) => {
    const result = await featureFlagsService.maxCampaignsActive(tenantId);
    return {
      ...result,
      featureName: 'maxCampaignsActive',
      errorMessage: `Máximo de ${result.max} campaigns ativas neste plano.`,
    };
  },
};

/**
 * Middleware HTTP-style para integração com gateway
 *
 * Uso no gateway.mjs:
 *   const featureCheckMiddleware = createFeatureCheckMiddleware(featureFlagsService);
 *   const canAccess = await featureCheckMiddleware(tenantId, 'inbox', res, json);
 *   if (!canAccess) return; // middleware já respondeu
 */
export function createFeatureCheckMiddleware(featureFlagsService) {
  return async (tenantId, featureName, res, json, req) => {
    try {
      // Mapear nomes de features para validadores
      const featureMap = {
        'canUseInbox': 'inbox',
        'inbox': 'inbox',
        'canUseWorkflows': 'workflows',
        'workflows': 'workflows',
        'canUseAnalytics': 'analytics',
        'analytics': 'analytics',
        'canAccessAPI': 'api',
        'api': 'api',
        'canCreateInstance': 'instances',
        'instances': 'instances',
        'maxCampaignsActive': 'campaigns',
        'campaigns': 'campaigns',
      };

      const validatorName = featureMap[featureName];
      const validator = featureValidators[validatorName];

      if (!validator) {
        console.warn(`[FeatureCheck] Feature ${featureName} (${validatorName}) não tem validador`);
        return true; // Allow se não temos regra explícita
      }

      const result = await validator(featureFlagsService, tenantId);

      if (!result.allowed) {
        json(res, 403, {
          error: 'Feature não disponível',
          feature: featureName,
          plan: result.plan,
          message: result.errorMessage || `${featureName} não está disponível neste plano`,
        }, req);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[FeatureCheck] Erro ao validar feature:', e.message);
      json(res, 500, { error: 'Erro ao validar acesso' }, req);
      return false;
    }
  };
}
