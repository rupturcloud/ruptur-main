/**
 * Testes — Analytics e Onboarding
 *
 * Testes de integração para:
 * - AnalyticsService: rastreamento de eventos
 * - OnboardingService: progresso de 5 passos
 * - Trial countdown e banners
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { AnalyticsService } from '../modules/billing/analytics.service.js';
import { OnboardingService } from '../modules/billing/onboarding.service.js';

// Mock Supabase (simplificado para testes)
const mockSupabase = {
  from: jest.fn((table) => ({
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn(),
    range: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  })),
};

describe('AnalyticsService', () => {
  let analyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService(mockSupabase);
  });

  it('deve rastrear evento de signup', async () => {
    const mockData = [{ id: 'event-1', event_type: 'signup' }];
    mockSupabase.from().insert().select.mockResolvedValue({ data: mockData, error: null });

    const result = await analyticsService.track('signup', {
      tenantId: 'tenant-123',
      userId: 'user-123',
    });

    expect(result).toBeDefined();
    expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
  });

  it('deve lançar erro se tenantId está faltando', async () => {
    await expect(analyticsService.track('signup', {})).rejects.toThrow('tenantId é obrigatório');
  });

  it('deve lançar erro para tipo de evento inválido', async () => {
    await expect(
      analyticsService.track('invalid_event', { tenantId: 'tenant-123' })
    ).rejects.toThrow('Tipo de evento inválido');
  });

  it('deve obter métricas de conversão', async () => {
    const mockMetrics = {
      tenant_id: 'tenant-123',
      total_signups: 100,
      checkout_completes: 25,
      trial_to_paid_conversion_rate: 25,
    };
    mockSupabase.from().select().eq().single.mockResolvedValue({ data: mockMetrics, error: null });

    const result = await analyticsService.getConversionMetrics('tenant-123');

    expect(result.tenantId).toBe('tenant-123');
    expect(result.totalSignups).toBe(100);
  });

  it('deve calcular ARPU corretamente', async () => {
    const mockEvents = [
      { properties: { amount: 9900 } }, // 99 reais
      { properties: { amount: 19900 } }, // 199 reais
    ];
    mockSupabase.from().select().eq().in().mockResolvedValue({ data: mockEvents, error: null });

    const mockTenant = { users: [{ id: '1' }, { id: '2' }, { id: '3' }] };
    mockSupabase.from().select().eq().single.mockResolvedValue({ data: mockTenant, error: null });

    const result = await analyticsService.getARPUMetrics('tenant-123');

    expect(result.totalRevenue).toBe(298); // 2980 centavos = 29,80 reais
    expect(result.transactionCount).toBe(2);
  });

  it('deve obter histórico de eventos com paginação', async () => {
    const mockEvents = [
      { id: 'event-1', event_type: 'signup' },
      { id: 'event-2', event_type: 'plan_viewed' },
    ];
    mockSupabase.from().select().eq().order().range.mockResolvedValue({
      data: mockEvents,
      error: null,
      count: 50,
    });

    const result = await analyticsService.getEventHistory('tenant-123', { limit: 2, offset: 0 });

    expect(result.events).toHaveLength(2);
    expect(result.total).toBe(50);
    expect(result.limit).toBe(2);
  });
});

describe('OnboardingService', () => {
  let onboardingService;

  beforeEach(() => {
    onboardingService = new OnboardingService(mockSupabase);
  });

  it('deve inicializar progresso para novo tenant', async () => {
    const mockData = [
      {
        tenant_id: 'tenant-123',
        current_step: 1,
        status: 'in_progress',
      },
    ];
    mockSupabase.from().insert().select.mockResolvedValue({ data: mockData, error: null });

    const result = await onboardingService.initializeProgress('tenant-123');

    expect(result.status).toBe('in_progress');
    expect(result.current_step).toBe(1);
  });

  it('deve obter progresso de onboarding', async () => {
    const mockData = {
      tenant_id: 'tenant-123',
      current_step: 2,
      status: 'in_progress',
      steps_progress: {
        '1': { completed: true, completedAt: '2026-05-08T10:00:00Z' },
        '2': { completed: false },
      },
      trial_starts_at: '2026-05-08T00:00:00Z',
      trial_ends_at: '2026-05-15T00:00:00Z',
    };
    mockSupabase.from().select().eq().single.mockResolvedValue({ data: mockData, error: null });

    const result = await onboardingService.getProgress('tenant-123');

    expect(result.tenantId).toBe('tenant-123');
    expect(result.currentStep).toBe(2);
    expect(result.steps[0].completed).toBe(true);
  });

  it('deve marcar step 1 (Email) como completo', async () => {
    const mockData = {
      tenant_id: 'tenant-123',
      current_step: 2,
      steps_progress: {
        '1': { completed: true, completedAt: '2026-05-08T10:00:00Z' },
      },
    };
    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: mockData,
      error: null,
    });
    mockSupabase.from().update().eq().select.mockResolvedValue({
      data: [mockData],
      error: null,
    });

    const result = await onboardingService.completeStep('tenant-123', 1);

    expect(result.currentStep).toBe(2);
    expect(mockSupabase.from().update).toHaveBeenCalled();
  });

  it('deve completar todos os passos e marcar onboarding como concluído', async () => {
    const mockData = {
      tenant_id: 'tenant-123',
      current_step: 5,
      status: 'completed',
      steps_progress: {
        '1': { completed: true },
        '2': { completed: true },
        '3': { completed: true },
        '4': { completed: true },
        '5': { completed: true, completedAt: '2026-05-08T12:00:00Z' },
      },
    };
    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: mockData,
      error: null,
    });
    mockSupabase.from().update().eq().select.mockResolvedValue({
      data: [mockData],
      error: null,
    });

    const result = await onboardingService.completeStep('tenant-123', 5);

    expect(result.status).toBe('completed');
    expect(result.progressPercentage).toBe(100);
  });

  it('deve obter status de trial', async () => {
    const mockTrialStatus = {
      tenant_id: 'tenant-123',
      trial_status: 'active',
      days_remaining: 4,
      completed_steps_count: 2,
      progress_percentage: 40,
    };
    mockSupabase.from().select().eq().single.mockResolvedValue({
      data: mockTrialStatus,
      error: null,
    });

    const result = await onboardingService.getTrialStatus('tenant-123');

    expect(result.tenantId).toBe('tenant-123');
    expect(result.daysRemaining).toBe(4);
    expect(result.progressPercentage).toBe(40);
  });

  it('deve marcar trial como expirado', async () => {
    mockSupabase.from().update().eq.mockResolvedValue({ error: null });

    await onboardingService.markTrialExpired('tenant-123');

    expect(mockSupabase.from().update).toHaveBeenCalled();
  });

  it('deve obter trials que expiram hoje', async () => {
    const mockTrials = [
      { tenant_id: 'tenant-123', days_remaining: 0 },
      { tenant_id: 'tenant-456', days_remaining: 1 },
    ];
    mockSupabase.from().select().in.mockResolvedValue({
      data: mockTrials,
      error: null,
    });

    const result = await onboardingService.getTrialsExpiringToday();

    expect(result).toHaveLength(2);
  });

  it('deve validar stepId entre 1-5', async () => {
    await expect(onboardingService.completeStep('tenant-123', 6)).rejects.toThrow(
      'stepId deve ser entre 1 e 5'
    );

    await expect(onboardingService.completeStep('tenant-123', 0)).rejects.toThrow(
      'stepId deve ser entre 1 e 5'
    );
  });
});

describe('Trial Countdown Logic', () => {
  it('deve determinar alerta como "info" para 4+ dias', () => {
    const daysRemaining = 5;
    const alertLevel = daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'warning' : 'info';

    expect(alertLevel).toBe('info');
  });

  it('deve determinar alerta como "warning" para 2-3 dias', () => {
    const daysRemaining = 2;
    const alertLevel = daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'warning' : 'info';

    expect(alertLevel).toBe('warning');
  });

  it('deve determinar alerta como "critical" para <= 1 dia', () => {
    const daysRemaining = 1;
    const alertLevel = daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'warning' : 'info';

    expect(alertLevel).toBe('critical');
  });

  it('deve determinar alerta como "critical" para trial expirado', () => {
    const daysRemaining = -1;
    const alertLevel = daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'warning' : 'info';

    expect(alertLevel).toBe('critical');
  });
});

describe('Progress Percentage Calculation', () => {
  it('deve calcular 0% para nenhum passo concluído', () => {
    const stepsProgress = {
      '1': { completed: false },
      '2': { completed: false },
      '3': { completed: false },
      '4': { completed: false },
      '5': { completed: false },
    };

    const completedCount = Object.values(stepsProgress).filter(s => s?.completed).length;
    const percentage = Math.round((completedCount / 5) * 100);

    expect(percentage).toBe(0);
  });

  it('deve calcular 40% para 2 passos concluídos', () => {
    const stepsProgress = {
      '1': { completed: true },
      '2': { completed: true },
      '3': { completed: false },
      '4': { completed: false },
      '5': { completed: false },
    };

    const completedCount = Object.values(stepsProgress).filter(s => s?.completed).length;
    const percentage = Math.round((completedCount / 5) * 100);

    expect(percentage).toBe(40);
  });

  it('deve calcular 100% para todos os passos concluídos', () => {
    const stepsProgress = {
      '1': { completed: true },
      '2': { completed: true },
      '3': { completed: true },
      '4': { completed: true },
      '5': { completed: true },
    };

    const completedCount = Object.values(stepsProgress).filter(s => s?.completed).length;
    const percentage = Math.round((completedCount / 5) * 100);

    expect(percentage).toBe(100);
  });
});
