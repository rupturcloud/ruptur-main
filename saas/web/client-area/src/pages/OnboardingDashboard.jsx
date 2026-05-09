/**
 * OnboardingDashboard — Progresso de Onboarding em Tempo Real
 *
 * 5 Passos:
 * 1. Verificar Email
 * 2. Criar Instância WhatsApp
 * 3. Testar Campanha
 * 4. Convidar Time
 * 5. Upgrade de Plano
 *
 * Exibe progresso visual + trial countdown
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { API_BASE_URL } from '../config';
import './OnboardingDashboard.css';

export default function OnboardingDashboard() {
  const { user, tenantId } = useAuth();
  const [progress, setProgress] = useState(null);
  const [trialStatus, setTrialStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const steps = [
    {
      id: 1,
      name: 'Verificar Email',
      description: 'Confirmar seu endereço de email',
      icon: '✉️',
      actionUrl: '/settings/email',
      actionLabel: 'Verificar',
    },
    {
      id: 2,
      name: 'Criar Instância',
      description: 'Criar sua primeira instância WhatsApp',
      icon: '📱',
      actionUrl: '/instances',
      actionLabel: 'Criar Instância',
    },
    {
      id: 3,
      name: 'Testar Campanha',
      description: 'Enviar uma mensagem de teste',
      icon: '📤',
      actionUrl: '/campaigns',
      actionLabel: 'Enviar Teste',
    },
    {
      id: 4,
      name: 'Convidar Time',
      description: 'Convidar um colega (opcional)',
      icon: '👥',
      actionUrl: '/settings/team',
      actionLabel: 'Convidar',
    },
    {
      id: 5,
      name: 'Upgrade de Plano',
      description: 'Escolher seu plano pago',
      icon: '💳',
      actionUrl: '/billing/upgrade',
      actionLabel: 'Fazer Upgrade',
    },
  ];

  useEffect(() => {
    fetchProgress();
  }, [tenantId]);

  const fetchProgress = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      const token = await user?.getIdToken();

      // Fetch onboarding progress
      const progressRes = await fetch(
        `${API_BASE_URL}/api/onboarding/progress?tenantId=${tenantId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      const progressData = await progressRes.json();
      setProgress(progressData);

      // Fetch trial status
      const trialRes = await fetch(
        `${API_BASE_URL}/api/onboarding/trial-status?tenantId=${tenantId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      const trialData = await trialRes.json();
      setTrialStatus(trialData);

      setError(null);
    } catch (err) {
      console.error('Erro ao buscar progresso:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStepClick = async (stepId) => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/onboarding/complete-step`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantId,
          stepId,
        }),
      });

      if (!res.ok) throw new Error('Erro ao completar step');
      const data = await res.json();
      setProgress(data);
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  if (loading) {
    return (
      <div className="onboarding-container">
        <div className="spinner">Carregando progresso...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="onboarding-container">
        <div className="error-message">Erro: {error}</div>
        <button onClick={fetchProgress} className="retry-button">
          Tentar Novamente
        </button>
      </div>
    );
  }

  const progressPercentage = progress?.progressPercentage || 0;
  const daysRemaining = trialStatus?.daysRemaining || 0;
  const trialAlertLevel = daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'warning' : 'info';

  return (
    <div className="onboarding-dashboard">
      {/* Header com Progress Bar */}
      <div className="onboarding-header">
        <h1>🚀 Seu Progresso de Onboarding</h1>
        <div className="progress-bar-wrapper">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="progress-text">{progressPercentage}% concluído</span>
        </div>
      </div>

      {/* Trial Status Banner */}
      <div className={`trial-banner ${trialAlertLevel}`}>
        <div className="trial-icon">⏱️</div>
        <div className="trial-content">
          <h3>Trial expira em {daysRemaining} dia{daysRemaining !== 1 ? 's' : ''}</h3>
          <p>
            {daysRemaining <= 1
              ? 'Sua conta será bloqueada em breve! Faça upgrade agora.'
              : daysRemaining <= 3
              ? 'Upgrade de plano necessário em breve para continuar usando.'
              : 'Continue seu onboarding para fazer upgrade.'}
          </p>
        </div>
        {daysRemaining <= 3 && (
          <a href="/billing/upgrade" className="cta-button">
            Fazer Upgrade
          </a>
        )}
      </div>

      {/* Steps List */}
      <div className="steps-container">
        {steps.map((step, idx) => {
          const isCompleted = progress?.steps[idx]?.completed;
          const completedAt = progress?.steps[idx]?.completedAt;

          return (
            <div key={step.id} className={`step-card ${isCompleted ? 'completed' : ''}`}>
              <div className="step-number">
                {isCompleted ? '✅' : step.icon}
              </div>

              <div className="step-content">
                <h3>{step.name}</h3>
                <p>{step.description}</p>
                {completedAt && (
                  <small className="completed-date">
                    Concluído em {new Date(completedAt).toLocaleDateString('pt-BR')}
                  </small>
                )}
              </div>

              <div className="step-action">
                {!isCompleted && (
                  <>
                    <a href={step.actionUrl} className="action-button">
                      {step.actionLabel}
                    </a>
                    {step.id === 1 && (
                      <button
                        className="mark-complete-btn"
                        onClick={() => handleStepClick(step.id)}
                        title="Marcar como concluído"
                      >
                        ✓
                      </button>
                    )}
                  </>
                )}
                {isCompleted && <span className="status-badge">Pronto</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="onboarding-footer">
        <p>
          ℹ️ Complete todos os passos para fazer upgrade de seu plano e continuar usando o Ruptur.
        </p>
      </div>
    </div>
  );
}
