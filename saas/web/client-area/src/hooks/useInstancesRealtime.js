import { useEffect, useState, useCallback } from 'react';
import { apiService } from '../services/api';
import { supabase } from '../services/supabase';

export function useInstancesRealtime() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar instâncias inicial
  const loadInstances = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getInstances();
      const list = Array.isArray(data) ? data : (data.instances || data.data || []);
      setInstances(list);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Carregar instâncias ao montar
    loadInstances();

    // Setup Realtime listener para instance_registry
    const subscription = supabase
      .channel('public:instance_registry')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERTS, UPDATES, DELETES
          schema: 'public',
          table: 'instance_registry',
        },
        () => {
          // Quando houver mudança, recarregar instâncias
          loadInstances();
        }
      )
      .subscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [loadInstances]);

  return {
    instances,
    loading,
    error,
    reload: loadInstances,
  };
}
