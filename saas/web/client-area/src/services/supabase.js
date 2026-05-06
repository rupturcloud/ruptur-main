/**
 * Supabase Client — Front-end (Browser)
 * Singleton para todas as operações de auth e data do client-area
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://axrwlboyowoskdxeogba.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cndsYm95b3dvc2tkeGVvZ2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzkzNTYsImV4cCI6MjA4OTUxNTM1Nn0.jrVy7OzLgidDYlK2rFuF1NX2SRP0EVmQycx3d_s7vV8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Evita erro de Web Locks em navegadores/extensões que disputam o token:
    // "Lock ... was released because another request stole it".
    lock: async (_name, _acquireTimeout, fn) => await fn(),
  },
});

export default supabase;
