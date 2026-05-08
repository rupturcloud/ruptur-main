/**
 * Teste E2E — Integração Inbox (Bubble + UAZAPI)
 *
 * Validação do fluxo completo:
 * 1. Autenticação e geração de token Bubble
 * 2. Validação de token no Bubble
 * 3. Webhooks UAZAPI
 * 4. Sincronização de chats/mensagens em tempo real
 *
 * Rodando localmente: node tests/e2e-inbox-integration.test.mjs
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

// Mock de usuário/token para teste
const MOCK_USER = {
  id: 'test-user-123',
  email: 'test@example.com',
  tenantId: 'test-tenant-123'
};

const MOCK_BUBBLE_TOKEN = Buffer.from(JSON.stringify({
  user_id: MOCK_USER.id,
  email: MOCK_USER.email,
  tenant_id: MOCK_USER.tenantId,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
})).toString('base64');

/**
 * TEST 1: POST /api/bubble/validate — Validar Token
 */
async function testTokenValidation() {
  console.log('\n🧪 TEST 1: Token Validation');
  try {
    const response = await fetch(`${BASE_URL}/api/bubble/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Token': MOCK_BUBBLE_TOKEN
      }
    });

    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, JSON.stringify(data, null, 2));

    if (response.status === 200 && data.valid) {
      console.log('  ✅ Token validation PASSED');
      return true;
    } else {
      console.log('  ❌ Token validation FAILED');
      return false;
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    return false;
  }
}

/**
 * TEST 2: POST /api/bubble/validate — Webhook UAZAPI
 */
async function testUAZAPIWebhook() {
  console.log('\n🧪 TEST 2: UAZAPI Webhook');
  try {
    const webhookPayload = {
      event: 'messages',
      instance_id: 'test-instance-123',
      data: {
        chat_id: 'test-chat-123',
        sender_phone: '5511987654321',
        body: 'Teste de mensagem',
        timestamp: new Date().toISOString(),
        message_id: `msg-${Date.now()}`
      }
    };

    const response = await fetch(`${BASE_URL}/api/bubble/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_BUBBLE_TOKEN}`
      },
      body: JSON.stringify(webhookPayload)
    });

    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, JSON.stringify(data, null, 2));

    if (response.status === 201 || response.status === 202) {
      console.log('  ✅ Webhook processing PASSED');
      return true;
    } else {
      console.log('  ❌ Webhook processing FAILED');
      return false;
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    return false;
  }
}

/**
 * TEST 3: Token Expiry Validation
 */
async function testTokenExpiry() {
  console.log('\n🧪 TEST 3: Token Expiry');
  try {
    // Criar token expirado
    const expiredToken = Buffer.from(JSON.stringify({
      user_id: MOCK_USER.id,
      email: MOCK_USER.email,
      tenant_id: MOCK_USER.tenantId,
      iat: Math.floor(Date.now() / 1000) - 7200, // 2h atrás
      exp: Math.floor(Date.now() / 1000) - 3600  // expirou 1h atrás
    })).toString('base64');

    const response = await fetch(`${BASE_URL}/api/bubble/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Token': expiredToken
      }
    });

    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log('  ✅ Token expiry PASSED (correctly rejected)');
      return true;
    } else {
      console.log('  ❌ Token expiry FAILED (should return 401)');
      return false;
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    return false;
  }
}

/**
 * TEST 4: Invalid Token Format
 */
async function testInvalidTokenFormat() {
  console.log('\n🧪 TEST 4: Invalid Token Format');
  try {
    const response = await fetch(`${BASE_URL}/api/bubble/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Token': 'not-valid-base64!!!'
      }
    });

    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log('  ✅ Invalid format handling PASSED');
      return true;
    } else {
      console.log('  ❌ Invalid format handling FAILED');
      return false;
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    return false;
  }
}

/**
 * TEST 5: Missing Required Fields
 */
async function testMissingFields() {
  console.log('\n🧪 TEST 5: Missing Required Fields');
  try {
    const response = await fetch(`${BASE_URL}/api/bubble/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MOCK_BUBBLE_TOKEN}`
      },
      body: JSON.stringify({
        event: 'messages',
        // missing instance_id e data
      })
    });

    const data = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, JSON.stringify(data, null, 2));

    if (response.status === 400 || response.status === 401) {
      console.log('  ✅ Missing fields validation PASSED');
      return true;
    } else {
      console.log('  ❌ Missing fields validation FAILED');
      return false;
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    return false;
  }
}

/**
 * MAIN TEST RUNNER
 */
async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   INBOX INTEGRATION TEST SUITE (Bubble + UAZAPI)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📍 API URL: ${BASE_URL}`);

  const results = [];

  results.push(await testTokenValidation());
  results.push(await testUAZAPIWebhook());
  results.push(await testTokenExpiry());
  results.push(await testInvalidTokenFormat());
  results.push(await testMissingFields());

  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   SUMMARY                                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
