/**
 * TrialBanner — Banner Sticky com Status do Trial
 *
 * Lógica:
 * - Dia 1-6: Info (azul)
 * - Dia 7: Warning (amarelo)
 * - Dia 8+: Critical (vermelho, bloqueio)
 *
 * Posicionado no topo do Dashboard
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { API_BASE_URL } from '../config';
import './TrialBanner.css';

export default function TrialBanner() {
  const { user, tenantId } = useAuth();
  const [trialStatus, setTrialStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    fetchTrialStatus();

    // Atualizar a cada 5 minutos
    const interval = setInterval(fetchTrialStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const fetchTrialStatus = async () => {
    try {
      const token = await user?.getIdToken();
      const res = await fetch(
        `${API_BASE_URL}/api/onboarding/trial-status?tenantId=${tenantId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setTrialStatus(data);
      }
    } catch (err) {
      console.error('Erro ao buscar trial status:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !trialStatus || dismissed) {
    return null;
  }

  const daysRemaining = trialStatus.daysRemaining || 0;
  let alertLevel = 'info';
  let title = '';
  let message = '';
  let showCTA = false;

  if (daysRemaining <= 0) {
    alertLevel = 'critical';
    title = '❌ Sua conta está bloqueada';
    message = 'Seu trial expirou. Faça upgrade para continuar usando o Ruptur.';
    showCTA = true;
  } else if (daysRemaining === 1) {
    alertLevel = 'critical';
    title = '⏰ Trial expira HOJE';
    message = 'Sua conta será bloqueada em breve. Faça upgrade agora!';
    showCTA = true;
  } else if (daysRemaining <= 2) {
    alertLevel = 'warning';
    title = '⚠️  Trial expira em 2 dias';
    message = 'Upgrade necessário em breve para manter o acesso.';
    showCTA = true;
  } else if (daysRemaining <= 7) {
    alertLevel = 'warning';
    title = `⏱️ Trial expira em ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}`;
    message = 'Complete seu onboarding e faça upgrade para não perder acesso.';
    showCTA = true;
  } else {
    alertLevel = 'info';
    title = `📅 Trial disponível por ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}`;
    message = `${trialStatus.progressPercentage}% do onboarding concluído. Avance nos próximos passos!`;
    showCTA = false;
  }

  return (
    <div className={`trial-banner-sticky ${alertLevel}`}>
      <div className="trial-banner-content">
        <div className="trial-message">
          <h4>{title}</h4>
          <p>{message}</p>
        </div>

        <div className="trial-actions">
          {showCTA && (
            <a href="/billing/upgrade" className="upgrade-cta">
              Fazer Upgrade
            </a>
          )}
          <button
            className="dismiss-btn"
            onClick={() => setDismissed(true)}
            title="Descartar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Progress bar visual rápido */}
      {trialStatus.progressPercentage > 0 && (
        <div className="trial-progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${trialStatus.progressPercentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
