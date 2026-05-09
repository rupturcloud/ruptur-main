/**
 * Hook customizado para Pub/Sub
 *
 * Implementação simples baseada em Supabase Realtime ou fallback com polling
 * para notificações em tempo real de mensagens.
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * PubSubClient — Cliente para notificações em tempo real
 *
 * Usar Supabase Realtime quando disponível, com fallback para polling
 */
class PubSubClient {
  constructor() {
    this.subscribers = new Map();
    this.supabase = null;
    this.subscriptions = [];
    this.isInitialized = false;

    this.initialize();
  }

  initialize() {
    try {
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('[PubSub] Inicializado com Supabase Realtime');
        this.isInitialized = true;
      }
    } catch (e) {
      console.warn('[PubSub] Erro ao inicializar Supabase:', e.message);
    }
  }

  /**
   * Subscribe a um tópico
   */
  subscribe(topic, callback) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }
    const callbacks = this.subscribers.get(topic);
    callbacks.push(callback);

    return () => {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Unsubscribe de um tópico
   */
  unsubscribe(topic, callback) {
    const callbacks = this.subscribers.get(topic);
    if (!callbacks) return;

    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Publicar um evento
   */
  publish(topic, data) {
    const callbacks = this.subscribers.get(topic) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`[PubSub] Erro ao executar callback para ${topic}:`, e);
      }
    });
  }

  /**
   * Listen a mudanças em uma tabela (Realtime)
   */
  listenToTable(table, filters = {}, callback) {
    if (!this.supabase) {
      console.warn('[PubSub] Supabase não disponível para realtime');
      return () => {};
    }

    try {
      const channel = this.supabase
        .channel(`public:${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            if (callback) callback(payload);
          }
        )
        .subscribe();

      this.subscriptions.push(channel);

      return () => {
        this.supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('[PubSub] Erro ao fazer subscribe realtime:', e.message);
      return () => {};
    }
  }

  /**
   * Destruir cliente e limpar subscriptions
   */
  destroy() {
    this.subscribers.clear();
    this.subscriptions.forEach(sub => {
      try {
        this.supabase?.removeChannel(sub);
      } catch (e) {
        console.warn('[PubSub] Erro ao remover channel:', e.message);
      }
    });
    this.subscriptions = [];
  }
}

// Instância global
let pubSubInstance = null;

function getPubSubInstance() {
  if (!pubSubInstance) {
    pubSubInstance = new PubSubClient();
  }
  return pubSubInstance;
}

/**
 * Hook: usePubSub
 *
 * Fornece acesso ao cliente PubSub
 */
export function usePubSub() {
  return getPubSubInstance();
}

/**
 * Hook: useRealtime
 *
 * Subscribe a mudanças em uma tabela com realtime
 * Exemplo: useRealtime('uazapi_messages', { eq: ['chat_id', 'chat_123'] }, handleNewMessage)
 */
export function useRealtime(table, callback) {
  const pubSub = usePubSub();
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!pubSub.isInitialized || !callback) return;

    unsubscribeRef.current = pubSub.listenToTable(table, {}, callback);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [table, callback, pubSub]);
}

/**
 * Hook: usePolling
 *
 * Poll uma rota para mudanças (fallback quando realtime não está disponível)
 */
export function usePolling(url, interval = 3000, onData = null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const timeoutRef = useRef(null);

  const poll = async () => {
    try {
      setError(null);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      setData(result);
      setLoading(false);

      if (onData) onData(result);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }

    // Próximo poll
    timeoutRef.current = setTimeout(poll, interval);
  };

  useEffect(() => {
    poll();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [url, interval]);

  return { loading, error, data };
}

export default usePubSub;
