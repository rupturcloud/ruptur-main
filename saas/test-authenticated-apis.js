// ============================================================
// TESTE DOS ENDPOINTS AUTENTICADOS
// Execute: node test-authenticated-apis.js
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://axrwlboyowoskdxeogba.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cndsYm95b3dvc2tkeGVvZ2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzkzNTYsImV4cCI6MjA4OTUxNTM1Nn0.jrVy7OzLgidDYlK2rFuF1NX2SRP0EVmQycx3d_s7vV8';

const API_BASE = 'http://localhost:8787';

// Configurar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loginAndGetToken(email, password) {
  console.log(`🔐 Fazendo login como ${email}...`);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('❌ Login falhou:', error.message);
    throw error;
  }

  console.log('✅ Login successful!');
  return data.session.access_token;
}

async function testWalletBalance(token) {
  console.log('\n💰 Testando GET /api/wallet/balance...');
  
  try {
    const response = await fetch(`${API_BASE}/api/wallet/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Wallet balance:', data);
    } else {
      console.log('❌ Wallet balance error:', data);
    }
  } catch (error) {
    console.error('❌ Wallet balance request failed:', error.message);
  }
}

async function testInstances(token) {
  console.log('\n📱 Testando GET /api/instances...');
  
  try {
    const response = await fetch(`${API_BASE}/api/instances`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Instances:', data);
    } else {
      console.log('❌ Instances error:', data);
    }
  } catch (error) {
    console.error('❌ Instances request failed:', error.message);
  }
}

async function testSendMessage(token, instanceId, recipient, message) {
  console.log('\n📨 Testando POST /api/send-message...');
  
  try {
    const response = await fetch(`${API_BASE}/api/send-message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instanceId,
        recipient,
        message,
        type: 'text'
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Send message:', data);
    } else {
      console.log('❌ Send message error:', data);
    }
  } catch (error) {
    console.error('❌ Send message request failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Iniciando testes das APIs autenticadas...');
  
  try {
    // Fazer login e obter token
    const token = await loginAndGetToken('tiatendeai@gmail.com', 'sua_senha_aqui');
    
    // Testar endpoints
    await testWalletBalance(token);
    await testInstances(token);
    await testSendMessage(token, 'test-instance', '5511999998888', 'Mensagem de teste');
    
    console.log('\n✨ Testes concluídos!');
    
  } catch (error) {
    console.error('\n❌ Falha nos testes:', error.message);
  }
}

// Verificar se o servidor está rodando
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/api/local/health`);
    if (response.ok) {
      console.log('✅ Servidor está rodando!');
      return true;
    }
  } catch (error) {
    console.log('❌ Servidor não está rodando em', API_BASE);
    console.log('💡 Inicie o servidor com: npm run dev ou node server.mjs');
    return false;
  }
}

// Executar testes
if (await checkServer()) {
  main();
}
