import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const migration = readFileSync('./migrations/016_notifications_system.sql', 'utf-8');

// Executar a migration completa como um único statement
console.log('Aplicando migration ao Supabase...\n');

(async () => {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: migration });
    
    if (error) {
      console.error('❌ Erro ao aplicar migration:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Migration aplicada com sucesso!');
    console.log('Resultado:', data);
  } catch (err) {
    console.error('❌ Erro inesperado:', err.message);
    process.exit(1);
  }
})();
