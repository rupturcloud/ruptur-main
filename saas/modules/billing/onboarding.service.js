/**
 * OnboardingService — Gerenciamento de Progresso de Onboarding
 *
 * 5 Passos de Onboarding:
 * 1. Verificar Email - enviar email de verificação
 * 2. Criar Instância - criar primeira instância WhatsApp
 * 3. Testar Campanha - enviar teste de campanha
 * 4. Convidar Time - convidar colega (opcional)
 * 5. Upgrade de Plano - escolher plano pago (sair de trial)
 *
 * Cada transição: rastreia via analytics + atualiza progresso
 */

import { AnalyticsService } from './analytics.service.js';

export class OnboardingService {
  constructor(supabase) {
    this.supabase = supabase;
    this.analytics = new AnalyticsService(supabase);
  }

  // Definição dos 5 passos
  static STEPS = [
    {
      id: 1,
      name: 'Verificar Email',
      description: 'Confirmar seu endereço de email',
      icon: '✉️',
    },
    {
      id: 2,
      name: 'Criar Instância',
      description: 'Criar sua primeira instância WhatsApp',
      icon: '📱',
    },
    {
      id: 3,
      name: 'Testar Campanha',
      description: 'Enviar uma mensagem de teste',
      icon: '📤',
    },
    {
      id: 4,
      name: 'Convidar Time',
      description: 'Convidar um colega (opcional)',
      icon: '👥',
    },
    {
      id: 5,
      name: 'Upgrade de Plano',
      description: 'Escolher seu plano e fazer upgrade',
      icon: '💳',
    },
  ];

  /**
   * Inicializar progresso de onboarding para novo tenant
   *
   * @param {string} tenantId - ID do tenant
   * @returns {Promise<Object>} Progresso inicializado
   */
  async initializeProgress(tenantId) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    try {
      const { data, error } = await this.supabase
        .from('onboarding_progress')
        .insert({
          tenant_id: tenantId,
          current_step: 1,
          status: 'in_progress',
          trial_starts_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      if (error) throw error;

      // Rastrear evento de signup
      await this.analytics.track('signup', {
        tenantId,
      }).catch(err => console.warn('[Onboarding] Analytics signup falhou:', err.message));

      return data?.[0] || { ok: true };
    } catch (err) {
      console.error('[Onboarding] Erro ao inicializar progresso:', err.message);
      throw err;
    }
  }

  /**
   * Obter progresso de onboarding de um tenant
   *
   * @param {string} tenantId - ID do tenant
   * @returns {Promise<Object>} Progresso com estrutura formatada
   */
  async getProgress(tenantId) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    try {
      const { data, error } = await this.supabase
        .from('onboarding_progress')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Sem progresso de onboarding ainda, inicializar
        return await this.initializeProgress(tenantId);
      }

      if (error) throw error;

      // Formatar resposta
      return this._formatProgress(data);
    } catch (err) {
      console.error('[Onboarding] Erro ao obter progresso:', err.message);
      throw err;
    }
  }

  /**
   * Completar um passo do onboarding
   *
   * @param {string} tenantId - ID do tenant
   * @param {number} stepId - ID do passo (1-5)
   * @param {Object} metadata - Metadados opcionais
   * @returns {Promise<Object>} Progresso atualizado
   */
  async completeStep(tenantId, stepId, metadata = {}) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    if (!Number.isInteger(stepId) || stepId < 1 || stepId > 5) {
      throw new Error('stepId deve ser entre 1 e 5');
    }

    try {
      // 1. Obter progresso atual
      const { data: current, error: fetchError } = await this.supabase
        .from('onboarding_progress')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) throw fetchError;
      if (!current) {
        throw new Error('Progresso de onboarding não encontrado');
      }

      // 2. Atualizar step
      const stepsProgress = current.steps_progress || {};
      stepsProgress[String(stepId)] = {
        completed: true,
        completedAt: new Date().toISOString(),
        ...metadata,
      };

      // 3. Calcular novo current_step
      let newCurrentStep = stepId + 1;
      if (newCurrentStep > 5) {
        newCurrentStep = 5;
      }

      // 4. Verificar se completou todos os passos
      let isCompleted = false;
      let newStatus = 'in_progress';
      if (stepId === 5) {
        isCompleted = true;
        newStatus = 'completed';
      }

      // 5. Atualizar no banco
      const { data, error: updateError } = await this.supabase
        .from('onboarding_progress')
        .update({
          current_step: newCurrentStep,
          steps_progress: stepsProgress,
          status: newStatus,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('tenant_id', tenantId)
        .select();

      if (updateError) throw updateError;

      // 6. Rastrear evento de conclusão
      const stepName = OnboardingService.STEPS.find(s => s.id === stepId)?.name || `Step ${stepId}`;
      const eventMap = {
        1: 'signup', // Email verificado
        2: 'plan_viewed', // Instância criada
        3: 'checkout_start', // Campanha testada
        4: 'checkout_start', // Time convidado
        5: 'upgrade', // Upgrade completo
      };

      const analyticsEvent = eventMap[stepId];
      if (analyticsEvent) {
        await this.analytics.track(analyticsEvent, {
          tenantId,
          step: stepId,
          stepName,
        }).catch(err => console.warn('[Onboarding] Analytics track falhou:', err.message));
      }

      return this._formatProgress(data?.[0] || current);
    } catch (err) {
      console.error(`[Onboarding] Erro ao completar step ${stepId}:`, err.message);
      throw err;
    }
  }

  /**
   * Obter status de trial
   *
   * @param {string} tenantId - ID do tenant
   * @returns {Promise<Object>} Status do trial
   */
  async getTrialStatus(tenantId) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    try {
      const { data, error } = await this.supabase
        .from('trial_status_summary')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code === 'PGRST116') {
        return {
          status: 'not_found',
          message: 'Progresso de onboarding não inicializado',
        };
      }

      if (error) throw error;

      return {
        tenantId,
        trialStatus: data.trial_status,
        daysRemaining: data.days_remaining,
        trialStartsAt: data.trial_starts_at,
        trialEndsAt: data.trial_ends_at,
        onboardingStatus: data.onboarding_status,
        completedSteps: data.completed_steps_count,
        progressPercentage: data.progress_percentage,
        stepsCompleted: {
          1: data.step1_completed,
          2: data.step2_completed,
          3: data.step3_completed,
          4: data.step4_completed,
          5: data.step5_completed,
        },
      };
    } catch (err) {
      console.error('[Onboarding] Erro ao obter trial status:', err.message);
      throw err;
    }
  }

  /**
   * Marcar trial como expirado (e rastrear)
   *
   * @param {string} tenantId - ID do tenant
   * @returns {Promise<void>}
   */
  async markTrialExpired(tenantId) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    try {
      // Rastrear evento
      await this.analytics.track('trial_expired', {
        tenantId,
      }).catch(err => console.warn('[Onboarding] Analytics trial_expired falhou:', err.message));

      // Atualizar status
      await this.supabase
        .from('onboarding_progress')
        .update({ status: 'abandoned' })
        .eq('tenant_id', tenantId);
    } catch (err) {
      console.error('[Onboarding] Erro ao marcar trial como expirado:', err.message);
      throw err;
    }
  }

  /**
   * Enviar alerta de trial expirando (warning)
   *
   * @param {string} tenantId - ID do tenant
   * @param {number} daysRemaining - Dias restantes
   * @returns {Promise<void>}
   */
  async sendTrialWarning(tenantId, daysRemaining) {
    if (!tenantId) {
      throw new Error('tenantId é obrigatório');
    }

    try {
      // Rastrear evento
      await this.analytics.track('trial_warning', {
        tenantId,
        daysRemaining,
      }).catch(err => console.warn('[Onboarding] Analytics trial_warning falhou:', err.message));

      // Aqui entraria lógica de envio de email, notificação, etc
      // Por enquanto, apenas registra o evento
    } catch (err) {
      console.error('[Onboarding] Erro ao enviar trial warning:', err.message);
      throw err;
    }
  }

  /**
   * Obter todos os tenants em trial que expiram hoje/amanhã
   *
   * @returns {Promise<Array>} Lista de tenants
   */
  async getTrialsExpiringToday() {
    try {
      const { data, error } = await this.supabase
        .from('trial_status_summary')
        .select('tenant_id, trial_ends_at, days_remaining, onboarding_status')
        .in('trial_status', ['expiring_today', 'critical_warning', 'expired']);

      if (error) throw error;

      return data || [];
    } catch (err) {
      console.error('[Onboarding] Erro ao obter trials expirando:', err.message);
      throw err;
    }
  }

  /**
   * Formatador interno: converter dados do DB para formato API
   *
   * @private
   */
  _formatProgress(dbRow) {
    if (!dbRow) return null;

    const stepsProgress = dbRow.steps_progress || {};
    const completedCount = Object.values(stepsProgress).filter(s => s?.completed).length;

    return {
      tenantId: dbRow.tenant_id,
      currentStep: dbRow.current_step,
      completedStepsCount: completedCount,
      progressPercentage: Math.round((completedCount / 5) * 100),
      status: dbRow.status,
      trialStartsAt: dbRow.trial_starts_at,
      trialEndsAt: dbRow.trial_ends_at,
      daysRemaining: Math.ceil(
        (new Date(dbRow.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)
      ),
      steps: OnboardingService.STEPS.map(step => ({
        id: step.id,
        name: step.name,
        description: step.description,
        icon: step.icon,
        completed: stepsProgress[String(step.id)]?.completed || false,
        completedAt: stepsProgress[String(step.id)]?.completedAt || null,
      })),
      createdAt: dbRow.created_at,
      completedAt: dbRow.completed_at,
    };
  }
}
