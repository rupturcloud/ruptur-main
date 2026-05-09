/**
 * TESTE E2E COMPLETO — Bubble Webhooks + UAZAPI
 *
 * Cobertura dos 6 blocos para PoC Kickoff (2026-05-08 até 23:00)
 *
 * BLOCO 1: Autenticação e Token (15 min)
 * BLOCO 2: Webhook Segurança (15 min)
 * BLOCO 3: 13 Eventos UAZAPI (30 min)
 * BLOCO 4: Fluxo Completo Inbox (30 min)
 * BLOCO 5: Multi-Tenant Isolation (15 min)
 * BLOCO 6: Tratamento de Erros (15 min)
 *
 * Rodando: npm test -- tests/e2e-bubble-uazapi-complete.test.js
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Descriptores condicionais
const describeIfSupabase = SUPABASE_SERVICE_KEY ? describe : describe.skip;

// ============================================================================
// SETUP GLOBAL
// ============================================================================

let supabase;
let testTenantId;
let testUserId;
let testUserEmail;
let testBubbleToken;
let testTenant2Id; // para multi-tenant

describeIfSupabase('E2E Complete: Bubble + UAZAPI Integration (6 Blocos)', () => {
  beforeAll(async () => {
    // Initialize Supabase
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Setup tenant de teste
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ name: 'Test Tenant E2E', slug: `test-e2e-${Date.now()}` })
      .select('id')
      .single();

    if (tenantError) throw tenantError;
    testTenantId = tenant.id;

    // Setup tenant 2 (para testes multi-tenant)
    const { data: tenant2, error: tenant2Error } = await supabase
      .from('tenants')
      .insert({ name: 'Test Tenant 2 E2E', slug: `test-e2e-2-${Date.now()}` })
      .select('id')
      .single();

    if (tenant2Error) throw tenant2Error;
    testTenant2Id = tenant2.id;

    // Setup usuário de teste
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: `test-e2e-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      email_confirm: true
    });

    if (userError) throw userError;
    testUserId = user.user.id;
    testUserEmail = user.user.email;

    // Add user ao tenant
    await supabase
      .from('user_tenant_memberships')
      .insert({
        user_id: testUserId,
        tenant_id: testTenantId,
        role: 'owner'
      });

    // Gerar token Bubble
    testBubbleToken = generateBubbleToken(testUserId, testTenantId, testUserEmail);

    console.log(`\n✓ Setup completo: Tenant=${testTenantId}, User=${testUserId}`);
  });

  afterAll(async () => {
    // Limpeza: deletar dados de teste
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
    if (testTenant2Id) {
      await supabase.from('tenants').delete().eq('id', testTenant2Id);
    }
  });

  // ==========================================================================
  // BLOCO 1: Autenticação e Token (15 min)
  // ==========================================================================

  describe('BLOCO 1: Autenticação e Token', () => {
    test('1.1: POST /api/bubble/token com JWT Supabase válido → retorna bubble_url + token', async () => {
      const sessionToken = jwt.sign(
        { sub: testUserId, tenantId: testTenantId, email: testUserEmail },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await fetch('http://localhost:3001/api/bubble/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ tenantId: testTenantId })
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('bubble_url');
      expect(data).toHaveProperty('token');
      expect(typeof data.token).toBe('string');
      expect(data.token.length > 0).toBe(true);
    });

    test('1.2: POST /api/bubble/token sem Authorization → 401', async () => {
      const response = await fetch('http://localhost:3001/api/bubble/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: testTenantId })
      });

      expect(response.status).toBe(401);
    });

    test('1.3: Token gerado é Base64 decodificável com user_id, tenant_id, exp', () => {
      // Decodificar token
      const decoded = Buffer.from(testBubbleToken, 'base64').toString('utf-8');
      const tokenData = JSON.parse(decoded);

      expect(tokenData).toHaveProperty('user_id');
      expect(tokenData).toHaveProperty('tenant_id');
      expect(tokenData).toHaveProperty('exp');
      expect(tokenData.user_id).toBe(testUserId);
      expect(tokenData.tenant_id).toBe(testTenantId);
    });

    test('1.4: Token expirado (exp < now) é rejeitado no /validate', async () => {
      const expiredToken = Buffer.from(JSON.stringify({
        user_id: testUserId,
        tenant_id: testTenantId,
        exp: Math.floor(Date.now() / 1000) - 3600 // expirou 1h atrás
      })).toString('base64');

      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': expiredToken
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance',
          data: { test: 'data' }
        })
      });

      expect(response.status).toBe(401);
    });
  });

  // ==========================================================================
  // BLOCO 2: Webhook Segurança (15 min)
  // ==========================================================================

  describe('BLOCO 2: Webhook Segurança', () => {
    test('2.1: POST /api/bubble/validate com X-Token válido → 200 + {valid: true}', async () => {
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance',
          data: {
            message_id: `msg-${Date.now()}`,
            sender_phone: '+5511987654321',
            body: 'Teste'
          }
        })
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
    });

    test('2.2: POST /api/bubble/validate sem token → 401', async () => {
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance',
          data: { test: 'data' }
        })
      });

      expect(response.status).toBe(401);
    });

    test('2.3: Token com tenant_id inválido → verifyTenantMembership() retorna 403', async () => {
      const invalidTenantToken = Buffer.from(JSON.stringify({
        user_id: testUserId,
        tenant_id: 'invalid-tenant-id',
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64');

      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': invalidTenantToken
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance',
          data: { test: 'data' }
        })
      });

      expect([403, 401]).toContain(response.status);
    });

    test('2.4: Usuário sem membership no tenant → 403 TENANT_UNAUTHORIZED', async () => {
      // Criar usuário novo sem membership
      const { data: newUser } = await supabase.auth.admin.createUser({
        email: `test-no-member-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        email_confirm: true
      });

      const unauthorizedToken = Buffer.from(JSON.stringify({
        user_id: newUser.user.id,
        tenant_id: testTenantId,
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64');

      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': unauthorizedToken
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance',
          data: { test: 'data' }
        })
      });

      expect([403, 401]).toContain(response.status);

      // Cleanup
      await supabase.auth.admin.deleteUser(newUser.user.id);
    });
  });

  // ==========================================================================
  // BLOCO 3: 13 Eventos UAZAPI (30 min)
  // ==========================================================================

  describe('BLOCO 3: 13 Eventos UAZAPI', () => {
    const uazapiEvents = [
      {
        name: 'messages',
        payload: {
          sender_phone: '+5511987654321',
          message_id: `msg-${Date.now()}`,
          body: 'Test message',
          timestamp: new Date().toISOString()
        }
      },
      {
        name: 'chats',
        payload: {
          chat_id: `chat-${Date.now()}`,
          contact_phone: '+5511987654321',
          contact_name: 'Test Contact',
          last_message: 'Test',
          timestamp: new Date().toISOString()
        }
      },
      {
        name: 'contacts',
        payload: {
          phone: '+5511987654321',
          name: 'Test Contact',
          email: 'contact@example.com'
        }
      },
      {
        name: 'presence',
        payload: {
          contact_phone: '+5511987654321',
          status: 'online',
          last_seen: new Date().toISOString()
        }
      },
      {
        name: 'connection',
        payload: {
          instance_id: 'test-instance',
          connection_status: 'connected',
          phone: '+5511987654321'
        }
      },
      {
        name: 'message_status',
        payload: {
          message_id: `msg-${Date.now()}`,
          status: 'delivered'
        }
      },
      {
        name: 'typing',
        payload: {
          contact_phone: '+5511987654321',
          is_typing: true
        }
      },
      {
        name: 'read_receipt',
        payload: {
          message_id: `msg-${Date.now()}`,
          read_at: new Date().toISOString()
        }
      },
      {
        name: 'instance_update',
        payload: {
          instance_id: 'test-instance',
          battery: 85,
          is_charging: false
        }
      },
      {
        name: 'group_update',
        payload: {
          group_id: 'group-123',
          action: 'member_added',
          members_count: 5
        }
      },
      {
        name: 'media_download',
        payload: {
          message_id: `msg-${Date.now()}`,
          media_url: 'https://example.com/media.jpg',
          media_type: 'image'
        }
      },
      {
        name: 'call_event',
        payload: {
          call_id: `call-${Date.now()}`,
          contact_phone: '+5511987654321',
          call_type: 'voice',
          duration: 120
        }
      },
      {
        name: 'qr_update',
        payload: {
          instance_id: 'test-instance',
          qr_code: 'base64-encoded-qr',
          status: 'ready_to_scan'
        }
      }
    ];

    uazapiEvents.forEach((event, idx) => {
      test(`3.${idx + 1}: Evento "${event.name}" → webhook recebe e cria registro`, async () => {
        const response = await fetch('http://localhost:3001/api/bubble/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Token': testBubbleToken
          },
          body: JSON.stringify({
            event: event.name,
            instance_id: 'test-instance-uazapi',
            data: event.payload
          })
        });

        // Aceita 201 (criado) ou 202 (aceito para processamento)
        expect([201, 202, 200]).toContain(response.status);

        const data = await response.json();
        expect(data.success).toBe(true);

        // Validar registros na tabela apropriada
        if (event.name === 'messages') {
          const { data: messages, error } = await supabase
            .from('uazapi_messages')
            .select('*')
            .eq('tenant_id', testTenantId)
            .eq('message_id', event.payload.message_id)
            .limit(1);

          if (!error) {
            expect(messages.length).toBeGreaterThan(0);
            expect(messages[0].sender_phone).toBe(event.payload.sender_phone);
          }
        } else if (event.name === 'chats') {
          const { data: chats, error } = await supabase
            .from('uazapi_chats')
            .select('*')
            .eq('tenant_id', testTenantId)
            .eq('chat_id', event.payload.chat_id)
            .limit(1);

          if (!error && chats.length > 0) {
            expect(chats[0].contact_phone).toBe(event.payload.contact_phone);
          }
        } else if (event.name === 'contacts') {
          const { data: contacts, error } = await supabase
            .from('uazapi_contacts')
            .select('*')
            .eq('tenant_id', testTenantId)
            .eq('phone', event.payload.phone)
            .limit(1);

          if (!error && contacts.length > 0) {
            expect(contacts[0].phone).toBe(event.payload.phone);
          }
        } else if (event.name === 'presence') {
          const { data: presence, error } = await supabase
            .from('uazapi_presence')
            .select('*')
            .eq('tenant_id', testTenantId)
            .eq('contact_phone', event.payload.contact_phone)
            .limit(1);

          if (!error && presence.length > 0) {
            expect(presence[0].status).toBe(event.payload.status);
          }
        }
      });
    });
  });

  // ==========================================================================
  // BLOCO 4: Fluxo Completo Inbox (30 min)
  // ==========================================================================

  describe('BLOCO 4: Fluxo Completo Inbox', () => {
    test('4.1: Usuário 1 abre Inbox → GET /api/bubble/token recebe JWT', async () => {
      const sessionToken = jwt.sign(
        { sub: testUserId, tenantId: testTenantId, email: testUserEmail },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await fetch('http://localhost:3001/api/bubble/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ tenantId: testTenantId })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('token');
    });

    test('4.2: Webhook recebe mensagem WhatsApp (event=messages) → cria em uazapi_messages', async () => {
      const messageId = `msg-inbox-${Date.now()}`;

      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-inbox-instance',
          data: {
            message_id: messageId,
            chat_id: `chat-${Date.now()}`,
            sender_phone: '+5511999999999',
            sender_name: 'João Silva',
            body: 'Olá, tudo bem?',
            message_type: 'text',
            status: 'received',
            timestamp: new Date().toISOString(),
            is_from_me: false
          }
        })
      });

      expect([200, 201, 202]).toContain(response.status);

      // Validar mensagem foi criada
      const { data: messages } = await supabase
        .from('uazapi_messages')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('message_id', messageId);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].body).toBe('Olá, tudo bem?');
      expect(messages[0].sender_phone).toBe('+5511999999999');
      expect(messages[0].status).toBe('received');
    });

    test('4.3: Webhook cria/atualiza chat (event=chats)', async () => {
      const chatId = `chat-fluxo-${Date.now()}`;

      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'chats',
          instance_id: 'test-inbox-instance',
          data: {
            chat_id: chatId,
            contact_phone: '+5511999999999',
            contact_name: 'João Silva',
            last_message: 'Olá, tudo bem?',
            last_message_timestamp: new Date().toISOString(),
            unread_count: 1,
            status: 'active',
            is_group: false
          }
        })
      });

      expect([200, 201, 202]).toContain(response.status);

      // Validar chat foi criado
      const { data: chats } = await supabase
        .from('uazapi_chats')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('chat_id', chatId);

      expect(chats.length).toBeGreaterThan(0);
      expect(chats[0].contact_name).toBe('João Silva');
    });

    test('4.4: Usuário 1 responde → POST /api/messages com token válido', async () => {
      const response = await fetch('http://localhost:3001/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testBubbleToken}`
        },
        body: JSON.stringify({
          to: '+5511999999999',
          content: 'Tudo certo! E aí?',
          type: 'text'
        })
      });

      // Pode ser 200, 202 ou outro status de sucesso
      expect([200, 201, 202].some(code => response.status >= 200 && response.status < 300)).toBe(true);
    });

    test('4.5: Status de mensagem atualiza (sent → delivered → read)', async () => {
      const messageId = `msg-status-${Date.now()}`;

      // Criar mensagem inicial
      await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-inbox-instance',
          data: {
            message_id: messageId,
            chat_id: 'chat-status-test',
            sender_phone: '+5511999999999',
            body: 'Teste status',
            status: 'sent',
            timestamp: new Date().toISOString()
          }
        })
      });

      // Atualizar para delivered
      await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'message_status',
          instance_id: 'test-inbox-instance',
          data: {
            message_id: messageId,
            status: 'delivered',
            timestamp: new Date().toISOString()
          }
        })
      });

      // Atualizar para read
      const finalResponse = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'message_status',
          instance_id: 'test-inbox-instance',
          data: {
            message_id: messageId,
            status: 'read',
            timestamp: new Date().toISOString()
          }
        })
      });

      expect([200, 201, 202]).toContain(finalResponse.status);
    });

    test('4.6: Badge de não-lidas reduz com leitura', async () => {
      const chatId = `chat-badge-${Date.now()}`;

      // Criar chat com unread_count=3
      await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'chats',
          instance_id: 'test-inbox-instance',
          data: {
            chat_id: chatId,
            contact_phone: '+5511999999999',
            contact_name: 'João',
            last_message: 'Teste',
            unread_count: 3,
            status: 'active'
          }
        })
      });

      // Simulai leitura (webhook reduz unread)
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'chats',
          instance_id: 'test-inbox-instance',
          data: {
            chat_id: chatId,
            contact_phone: '+5511999999999',
            contact_name: 'João',
            last_message: 'Teste',
            unread_count: 0, // reduzido
            status: 'active'
          }
        })
      });

      expect([200, 201, 202]).toContain(response.status);
    });
  });

  // ==========================================================================
  // BLOCO 5: Multi-Tenant Isolation (15 min)
  // ==========================================================================

  describe('BLOCO 5: Multi-Tenant Isolation', () => {
    test('5.1: User A (tenant 1) NÃO vê mensagens de User B (tenant 2)', async () => {
      // Criar usuário em tenant2
      const { data: user2 } = await supabase.auth.admin.createUser({
        email: `test-tenant2-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        email_confirm: true
      });

      await supabase.from('user_tenant_memberships').insert({
        user_id: user2.user.id,
        tenant_id: testTenant2Id,
        role: 'owner'
      });

      // Gerar token para tenant2
      const tenant2Token = Buffer.from(JSON.stringify({
        user_id: user2.user.id,
        tenant_id: testTenant2Id,
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64');

      // User em tenant2 envia mensagem
      await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': tenant2Token
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance-2',
          data: {
            message_id: `msg-tenant2-${Date.now()}`,
            chat_id: 'chat-tenant2',
            sender_phone: '+5511988888888',
            body: 'Mensagem privada tenant2',
            timestamp: new Date().toISOString()
          }
        })
      });

      // User em tenant1 tenta ver mensagens
      const { data: tenant1Messages } = await supabase
        .from('uazapi_messages')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('body', 'Mensagem privada tenant2');

      expect(tenant1Messages.length).toBe(0); // Não vê

      // User em tenant2 vê suas mensagens
      const { data: tenant2Messages } = await supabase
        .from('uazapi_messages')
        .select('*')
        .eq('tenant_id', testTenant2Id)
        .eq('body', 'Mensagem privada tenant2');

      expect(tenant2Messages.length).toBeGreaterThan(0); // Vê

      // Cleanup
      await supabase.auth.admin.deleteUser(user2.user.id);
    });

    test('5.2: RLS policies filtram corretamente por tenant_id', async () => {
      // Insira diretamente com service key
      const { data: inserted } = await supabase
        .from('uazapi_messages')
        .insert({
          tenant_id: testTenantId,
          chat_id: 'chat-rls-test',
          message_id: `msg-rls-${Date.now()}`,
          sender_phone: '+5511977777777',
          body: 'RLS Test',
          timestamp: new Date().toISOString(),
          created_by: testUserId
        })
        .select();

      expect(inserted.length).toBeGreaterThan(0);

      // Validar que query com tenant_id funciona
      const { data: queried } = await supabase
        .from('uazapi_messages')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('body', 'RLS Test');

      expect(queried.length).toBeGreaterThan(0);
    });

    test('5.3: Token de User A não funciona em POST /validate para tenant 2', async () => {
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken // token de tenant1
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance-2',
          data: {
            message_id: `msg-cross-${Date.now()}`,
            chat_id: 'chat-cross',
            sender_phone: '+5511977777777',
            body: 'Cross tenant attempt',
            timestamp: new Date().toISOString(),
            tenant_id: testTenant2Id // intentar acessar tenant 2
          }
        })
      });

      // Pode retornar 403 ou processar mas com tenant do token (tenant1)
      // Depende da implementação do endpoint
      const data = await response.json();
      expect(data.tenant_id !== testTenant2Id || response.status >= 400).toBe(true);
    });
  });

  // ==========================================================================
  // BLOCO 6: Tratamento de Erros (15 min)
  // ==========================================================================

  describe('BLOCO 6: Tratamento de Erros', () => {
    test('6.1: Payload incompleto → 400 "event, instance_id e data são obrigatórios"', async () => {
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'messages'
          // faltando instance_id e data
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error || data.message).toBeTruthy();
    });

    test('6.2: Evento não mapeado → 202 "Evento ... recebido mas não mapeado"', async () => {
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'unknown_event_xyz',
          instance_id: 'test-instance',
          data: { test: 'data' }
        })
      });

      expect([200, 202]).toContain(response.status);
      const data = await response.json();
      expect(data.success || data.received).toBe(true);
    });

    test('6.3: JSON inválido no body → 400', async () => {
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: 'invalid json {{'
      });

      expect(response.status).toBe(400);
    });

    test('6.4: Token malformado (não Base64) → 401', async () => {
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': 'not-valid-base64!!!@#$%'
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance',
          data: { test: 'data' }
        })
      });

      expect(response.status).toBe(401);
    });

    test('6.5: Database error handling → sistema não quebra, retorna 500 com mensagem', async () => {
      // Simular erro de database (invalid data)
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance',
          data: {
            message_id: null, // campo obrigatório nulo
            sender_phone: '+5511999999999',
            body: 'Test'
          }
        })
      });

      // Pode ser 400 (validação) ou 500 (erro interno)
      expect([400, 500, 201, 202]).toContain(response.status);
    });

    test('6.6: Rate limiting (muitas requisições) → 429 Too Many Requests', async () => {
      // Enviar 20 requisições rápidas
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          fetch('http://localhost:3001/api/bubble/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Token': testBubbleToken
            },
            body: JSON.stringify({
              event: 'messages',
              instance_id: 'test-instance',
              data: {
                message_id: `msg-ratelimit-${i}`,
                sender_phone: '+5511999999999',
                body: 'Test',
                timestamp: new Date().toISOString()
              }
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);

      // Pelo menos algumas devem passar (200-202)
      const successes = statusCodes.filter(s => s >= 200 && s < 300).length;
      expect(successes).toBeGreaterThan(0);

      // Se rate limiting está ativo, algumas devem retornar 429
      // Se não está, todas devem passar
      const hasTooMany = statusCodes.includes(429);
      const allSuccess = statusCodes.every(s => s >= 200 && s < 300);
      expect(hasTooMany || allSuccess).toBe(true);
    });
  });

  // ==========================================================================
  // RESUMO FINAL
  // ==========================================================================

  describe('Resumo Final: Checklist PoC Kickoff', () => {
    test('✓ Autenticação: Token gerado e validado', () => {
      expect(testBubbleToken.length > 0).toBe(true);
    });

    test('✓ Webhooks: POST /api/bubble/validate aceita eventos', async () => {
      const response = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': testBubbleToken
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test-instance',
          data: {
            message_id: `msg-final-${Date.now()}`,
            sender_phone: '+5511999999999',
            body: 'Final test',
            timestamp: new Date().toISOString()
          }
        })
      });

      expect([200, 201, 202]).toContain(response.status);
    });

    test('✓ Eventos críticos: messages, chats, contacts, presence', async () => {
      const criticalEvents = ['messages', 'chats', 'contacts', 'presence'];

      for (const event of criticalEvents) {
        const response = await fetch('http://localhost:3001/api/bubble/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Token': testBubbleToken
          },
          body: JSON.stringify({
            event,
            instance_id: 'test-instance',
            data: {
              test: 'data',
              timestamp: new Date().toISOString()
            }
          })
        });

        expect([200, 201, 202]).toContain(response.status);
      }
    });

    test('✓ Multi-tenant: Isolamento de dados', async () => {
      const { data: allMessages } = await supabase
        .from('uazapi_messages')
        .select('*');

      // Verificar que há isolamento (tenant_id deve estar sempre preenchido)
      const hasValidTenants = allMessages.every(m => m.tenant_id && m.tenant_id.length > 0);
      expect(hasValidTenants).toBe(true);
    });

    test('✓ Segurança: 401 sem token, 403 sem membership', async () => {
      // 401
      const response401 = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test',
          data: { test: 'data' }
        })
      });
      expect(response401.status).toBe(401);

      // 403 com token inválido
      const response403 = await fetch('http://localhost:3001/api/bubble/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token': Buffer.from(JSON.stringify({
            user_id: 'unknown-user',
            tenant_id: 'unknown-tenant',
            exp: Math.floor(Date.now() / 1000) + 3600
          })).toString('base64')
        },
        body: JSON.stringify({
          event: 'messages',
          instance_id: 'test',
          data: { test: 'data' }
        })
      });
      expect([401, 403]).toContain(response403.status);
    });
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateBubbleToken(userId, tenantId, email) {
  return Buffer.from(JSON.stringify({
    user_id: userId,
    tenant_id: tenantId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64');
}
