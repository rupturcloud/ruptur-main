import { useState, useEffect } from 'react';
import { Loader, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Inbox — Integração com Bubble
 *
 * Carrega o inbox omnichannel do Bubble (uazapigo-multiatendimento.bubbleapps.io)
 * dentro de Ruptur de forma transparente para o usuário.
 *
 * Fluxo:
 * 1. Usuário acessa /inbox
 * 2. Componente chama /api/bubble/token
 * 3. Ruptur gera token JWT válido por 1h
 * 4. Bubble iframe carrega com token
 * 5. Bubble valida token chamando /api/bubble/validate
 * 6. Usuário vê conversas WhatsApp filtradas por tenant_id
 */
const Inbox = () => {
  const { session, isAuthenticated, loading: authLoading } = useAuth();
  const [bubbleUrl, setBubbleUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Buscar token Bubble ao montar
  useEffect(() => {
    async function fetchBubbleToken() {
      // Aguardar auth estar pronto
      if (authLoading) {
        return;
      }

      if (!isAuthenticated || !session?.access_token) {
        setError('Usuário não autenticado');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Chamar endpoint que gera token para Bubble
        const response = await fetch('/api/bubble/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setBubbleUrl(data.bubble_url);
      } catch (err) {
        console.error('[Inbox] Erro ao buscar token Bubble:', err);
        setError(err.message || 'Erro ao carregar inbox');
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchBubbleToken();
    }
  }, [session, isAuthenticated, authLoading]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setBubbleUrl(null);
    // Re-trigger fetch by re-running effect
    window.location.reload();
  };

  return (
    <div className="inbox-container">
      {loading && (
        <div className="inbox-loading">
          <Loader size={40} className="spinner" />
          <p>Carregando Inbox Omnichannel...</p>
        </div>
      )}

      {error && !loading && (
        <div className="inbox-error">
          <AlertCircle size={40} />
          <h3>Erro ao carregar Inbox</h3>
          <p>{error}</p>
          <button className="btn-retry" onClick={handleRetry}>
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      )}

      {bubbleUrl && !error && (
        <iframe
          src={bubbleUrl}
          className="bubble-iframe"
          title="Ruptur Inbox (Powered by Bubble)"
          allow="camera;microphone;clipboard-read;clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      )}

      <style>{`
        .inbox-container {
          width: 100%;
          height: calc(100vh - 130px);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(10, 10, 18, 0.3);
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-glass);
          overflow: hidden;
        }

        .inbox-loading,
        .inbox-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 40px;
          text-align: center;
        }

        .inbox-loading .spinner {
          animation: spin 2s linear infinite;
          color: var(--primary);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .inbox-loading p {
          color: var(--text-muted);
          font-size: 0.95rem;
        }

        .inbox-error {
          color: var(--accent);
        }

        .inbox-error h3 {
          font-size: 1.2rem;
          font-weight: 600;
          margin: 8px 0;
        }

        .inbox-error p {
          color: var(--text-muted);
          font-size: 0.9rem;
          max-width: 400px;
        }

        .btn-retry {
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 10px;
          border: 1px solid var(--primary);
          background: rgba(0, 242, 255, 0.1);
          color: var(--primary);
          cursor: pointer;
          font-weight: 600;
          transition: 0.2s;
        }

        .btn-retry:hover {
          background: rgba(0, 242, 255, 0.2);
        }

        .bubble-iframe {
          width: 100%;
          height: 100%;
          border: none;
          border-radius: var(--radius-xl);
        }

        @media (max-width: 640px) {
          .inbox-container {
            height: calc(100vh - 100px);
          }

          .inbox-loading,
          .inbox-error {
            padding: 30px 20px;
            gap: 12px;
          }

          .inbox-loading .spinner {
            width: 32px;
            height: 32px;
          }

          .inbox-error p {
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Inbox;
