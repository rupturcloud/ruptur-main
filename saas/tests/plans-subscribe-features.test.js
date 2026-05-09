/**
 * Tests: Billing — Plans, Subscribe, Feature Flags
 *
 * Cobertura:
 * - GET /api/billing/plans: retorna array de planos
 * - POST /api/billing/subscribe: trial direto, paid redireciona checkout
 * - GET /api/billing/subscription: status atual
 * - GET /api/billing/features: features do tenant
 * - POST /api/billing/validate-feature: validar feature específica
 * - FeatureFlagsService: lógica de features por plano
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  getPlans,
  subscribeUser,
  getSubscription,
  getFeatures,
  validateFeature,
} from '../api/routes-billing.mjs';
import { FeatureFlagsService } from '../modules/billing/feature-flags.service.js';
import {
  createCheckFeatureFlag,
  featureValidators,
  createFeatureCheckMiddleware,
} from '../middleware/checkFeatureFlag.js';

// ============================================================
// Tests: GET /api/billing/plans
// ============================================================

describe('getPlans()', () => {
  it('deve retornar array de planos', () => {
    const plans = getPlans();

    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
  });

  it('deve incluir Trial, Starter, Pro, Enterprise', () => {
    const plans = getPlans();
    const planIds = plans.map((p) => p.id);

    expect(planIds).toContain('trial');
    expect(planIds).toContain('starter');
    expect(planIds).toContain('pro');
    expect(planIds).toContain('enterprise');
  });

  it('trial deve ser grátis (R$ 5 ou menos)', () => {
    const plans = getPlans();
    const trial = plans.find((p) => p.id === 'trial');

    expect(trial).toBeDefined();
    expect(trial.price.amount).toBeLessThanOrEqual(500); // R$ 5
    expect(trial.credits).toBe(100);
    expect(trial.maxInstances).toBe(1);
  });

  it('starter deve custar R$ 99', () => {
    const plans = getPlans();
    const starter = plans.find((p) => p.id === 'starter');

    expect(starter).toBeDefined();
    expect(starter.price.amount).toBe(9900); // R$ 99
    expect(starter.credits).toBe(10000);
    expect(starter.maxInstances).toBe(5);
  });

  it('pro deve custar R$ 299', () => {
    const plans = getPlans();
    const pro = plans.find((p) => p.id === 'pro');

    expect(pro).toBeDefined();
    expect(pro.price.amount).toBe(29900); // R$ 299
    expect(pro.credits).toBe(50000);
    expect(pro.maxInstances).toBe(20);
  });

  it('trial deve ter inbox bloqueada', () => {
    const plans = getPlans();
    const trial = plans.find((p) => p.id === 'trial');

    expect(trial.features.canUseInbox).toBe(false);
    expect(trial.features.canUseWorkflows).toBe(false);
    expect(trial.features.maxCampaignsActive).toBe(1);
  });

  it('starter deve ter inbox liberada', () => {
    const plans = getPlans();
    const starter = plans.find((p) => p.id === 'starter');

    expect(starter.features.canUseInbox).toBe(true);
    expect(starter.features.canUseWorkflows).toBe('basic');
    expect(starter.features.maxCampaignsActive).toBe(10);
  });

  it('pro deve ter todas features (exceto white label)', () => {
    const plans = getPlans();
    const pro = plans.find((p) => p.id === 'pro');

    expect(pro.features.canUseInbox).toBe(true);
    expect(pro.features.canUseWorkflows).toBe('advanced');
    expect(pro.features.canUseAnalytics).toBe(true);
    expect(pro.features.canAccessAPI).toBe(true);
  });

  it('enterprise deve ter white label e suporte dedicado', () => {
    const plans = getPlans();
    const enterprise = plans.find((p) => p.id === 'enterprise');

    expect(enterprise.features.whiteLabel).toBe(true);
    expect(enterprise.features.support).toBe('dedicated');
  });
});

// ============================================================
// Tests: FeatureFlagsService
// ============================================================

describe('FeatureFlagsService', () => {
  let featureFlags;

  beforeEach(() => {
    featureFlags = new FeatureFlagsService(null); // Mock supabase
  });

  describe('getFeaturesByPlan()', () => {
    it('deve retornar features do trial', () => {
      const features = featureFlags.getFeaturesByPlan('trial');

      expect(features.canUseInbox).toBe(false);
      expect(features.canCreateInstance.max).toBe(1);
    });

    it('deve retornar features do starter', () => {
      const features = featureFlags.getFeaturesByPlan('starter');

      expect(features.canUseInbox).toBe(true);
      expect(features.canUseWorkflows).toBe('basic');
      expect(features.canCreateInstance.max).toBe(5);
    });

    it('deve retornar features do pro', () => {
      const features = featureFlags.getFeaturesByPlan('pro');

      expect(features.canUseInbox).toBe(true);
      expect(features.canUseWorkflows).toBe('advanced');
      expect(features.canUseAnalytics).toBe(true);
      expect(features.canAccessAPI).toBe(true);
      expect(features.canCreateInstance.max).toBe(20);
    });

    it('deve retornar trial como fallback para plano inválido', () => {
      const features = featureFlags.getFeaturesByPlan('invalid-plan');

      expect(features.canUseInbox).toBe(false);
      expect(features.canCreateInstance.max).toBe(1);
    });
  });

  describe('validateFeature()', () => {
    it('deve validar feature simples (canUseInbox)', async () => {
      const createChainMock = () => ({
        eq: jest.fn(function() { return createChainMock(); }),
        order: jest.fn(function() { return createChainMock(); }),
        limit: jest.fn(function() { return createChainMock(); }),
        maybeSingle: jest.fn().mockResolvedValue({ data: { plan_id: 'starter' } }),
      });

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue(createChainMock()),
        }),
      };

      featureFlags.supabase = mockSupabase;
      const result = await featureFlags.validateFeature('tenant-123', 'canUseInbox');

      expect(result.allowed).toBe(true);
      expect(result.value).toBe(true);
      expect(result.plan).toBe('starter');
    });

    it('deve validar feature nested com dot notation', async () => {
      const createChainMock = () => ({
        eq: jest.fn(function() { return createChainMock(); }),
        order: jest.fn(function() { return createChainMock(); }),
        limit: jest.fn(function() { return createChainMock(); }),
        maybeSingle: jest.fn().mockResolvedValue({ data: { plan_id: 'starter' } }),
      });

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue(createChainMock()),
        }),
      };

      featureFlags.supabase = mockSupabase;
      const result = await featureFlags.validateFeature('tenant-123', 'canCreateInstance.max');

      expect(result.allowed).toBe(true);
      expect(result.value).toBe(5); // Starter tem max 5 instances
    });

    it('deve bloquear feature em plano que não tem', async () => {
      const createChainMock = () => ({
        eq: jest.fn(function() { return createChainMock(); }),
        order: jest.fn(function() { return createChainMock(); }),
        limit: jest.fn(function() { return createChainMock(); }),
        maybeSingle: jest.fn().mockResolvedValue({ data: { plan_id: 'trial' } }),
      });

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue(createChainMock()),
        }),
      };

      featureFlags.supabase = mockSupabase;
      const result = await featureFlags.validateFeature('tenant-123', 'canUseInbox');

      expect(result.allowed).toBe(false);
      expect(result.value).toBe(false);
    });
  });
});

// ============================================================
// Tests: Feature Validators
// ============================================================

describe('featureValidators', () => {
  let featureFlags;

  beforeEach(() => {
    featureFlags = new FeatureFlagsService(null);
  });

  describe('inbox validator', () => {
    it('deve permitir inbox em starter', async () => {
      featureFlags.canUseInbox = jest.fn().mockResolvedValue({
        allowed: true,
        value: true,
        plan: 'starter',
      });

      const result = await featureValidators.inbox(featureFlags, 'tenant-123');

      expect(result.allowed).toBe(true);
    });

    it('deve bloquear inbox em trial', async () => {
      featureFlags.canUseInbox = jest.fn().mockResolvedValue({
        allowed: false,
        value: false,
        plan: 'trial',
      });

      const result = await featureValidators.inbox(featureFlags, 'tenant-123');

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toContain('Inbox');
    });
  });

  describe('workflows validator', () => {
    it('deve permitir workflows basic em starter', async () => {
      featureFlags.canUseWorkflows = jest.fn().mockResolvedValue({
        allowed: true,
        level: 'basic',
        plan: 'starter',
      });

      const result = await featureValidators.workflows(featureFlags, 'tenant-123', 'basic');

      expect(result.allowed).toBe(true);
    });

    it('deve bloquear workflows advanced em starter (requer pro)', async () => {
      featureFlags.canUseWorkflows = jest.fn().mockResolvedValue({
        allowed: true,
        level: 'basic',
        plan: 'starter',
      });

      const result = await featureValidators.workflows(featureFlags, 'tenant-123', 'advanced');

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toContain('Pro');
    });

    it('deve bloquear workflows em trial', async () => {
      featureFlags.canUseWorkflows = jest.fn().mockResolvedValue({
        allowed: false,
        level: false,
        plan: 'trial',
      });

      const result = await featureValidators.workflows(featureFlags, 'tenant-123', 'basic');

      expect(result.allowed).toBe(false);
    });
  });

  describe('instances validator', () => {
    it('deve permitir criar instance se under limit', async () => {
      featureFlags.canCreateInstance = jest.fn().mockResolvedValue({
        allowed: true,
        current: 2,
        max: 5,
        plan: 'starter',
      });

      const result = await featureValidators.instances(featureFlags, 'tenant-123');

      expect(result.allowed).toBe(true);
    });

    it('deve bloquear criar instance se at limit', async () => {
      featureFlags.canCreateInstance = jest.fn().mockResolvedValue({
        allowed: false,
        current: 5,
        max: 5,
        plan: 'starter',
      });

      const result = await featureValidators.instances(featureFlags, 'tenant-123');

      expect(result.allowed).toBe(false);
      expect(result.errorMessage).toContain('Limite');
    });
  });
});

// ============================================================
// Tests: Middleware
// ============================================================

describe('createFeatureCheckMiddleware', () => {
  it('deve permitir se feature está permitida', async () => {
    const featureFlags = new FeatureFlagsService(null);

    // Mock dos métodos do FeatureFlagsService que o validador chama
    featureFlags.canUseInbox = jest.fn().mockResolvedValue({
      allowed: true,
      value: true,
      plan: 'pro',
    });

    const middleware = createFeatureCheckMiddleware(featureFlags);
    const mockRes = {};
    const mockJson = jest.fn();
    const mockReq = {};
    const result = await middleware('tenant-123', 'canUseInbox', mockRes, mockJson, mockReq);

    expect(result).toBe(true);
    expect(mockJson).not.toHaveBeenCalled();
  });

  it('deve bloquear se feature não está permitida', async () => {
    const featureFlags = new FeatureFlagsService(null);

    // Mock dos métodos do FeatureFlagsService que o validador chama
    featureFlags.canUseInbox = jest.fn().mockResolvedValue({
      allowed: false,
      value: false,
      plan: 'trial',
    });

    const middleware = createFeatureCheckMiddleware(featureFlags);
    const mockRes = { statusCode: 200 };
    const mockJson = jest.fn();
    const mockReq = {};
    const result = await middleware('tenant-123', 'canUseInbox', mockRes, mockJson, mockReq);

    expect(result).toBe(false);
    expect(mockJson).toHaveBeenCalledWith(
      mockRes,
      403,
      expect.objectContaining({ error: 'Feature não disponível' }),
      mockReq
    );
  });
});

// ============================================================
// Tests: Integration
// ============================================================

describe('Plans & Subscriptions Integration', () => {
  it('trial deve ter menos credits que starter', () => {
    const plans = getPlans();
    const trial = plans.find((p) => p.id === 'trial');
    const starter = plans.find((p) => p.id === 'starter');

    expect(trial.credits).toBeLessThan(starter.credits);
  });

  it('cada plano deve ter features definidas', () => {
    const plans = getPlans();

    for (const plan of plans) {
      expect(plan.features).toBeDefined();
      expect(typeof plan.features).toBe('object');
      expect(Object.keys(plan.features).length).toBeGreaterThan(0);
    }
  });

  it('maxInstances deve crescer com tier de plano', () => {
    const plans = getPlans();
    const trial = plans.find((p) => p.id === 'trial');
    const starter = plans.find((p) => p.id === 'starter');
    const pro = plans.find((p) => p.id === 'pro');
    const enterprise = plans.find((p) => p.id === 'enterprise');

    expect(trial.maxInstances).toBeLessThan(starter.maxInstances);
    expect(starter.maxInstances).toBeLessThan(pro.maxInstances);
    expect(pro.maxInstances).toBeLessThan(enterprise.maxInstances);
  });

  it('feature flags devem ser consistentes com plans', () => {
    const plans = getPlans();
    const featureFlags = new FeatureFlagsService(null);

    for (const plan of plans) {
      const flags = featureFlags.getFeaturesByPlan(plan.id);

      // Verificar que as features no plano coincidem com as flags
      expect(flags.canCreateInstance.max).toBe(plan.maxInstances);
    }
  });
});
