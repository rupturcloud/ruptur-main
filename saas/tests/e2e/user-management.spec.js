/**
 * E2E Tests: User Management Flow
 * Playwright - Testa toda jornada: convites, aceitas, removals, role changes
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@test.com';
const MEMBER_EMAIL = 'member@test.com';
const NEW_MEMBER_EMAIL = 'newmember@test.com';

test.describe('User Management Flow', () => {
  let tenantId;

  test.beforeAll(async () => {
    // Setup: obter tenant ID do usuário de teste
    tenantId = process.env.TEST_TENANT_ID || 'test-tenant-123';
  });

  // ===== TEST 1: Convite & Aceitação =====

  test('01. Deve enviar convite e novo membro deve aceitar', async ({ browser, context }) => {
    // Admin: Abrir página de membros
    const adminPage = await context.newPage();
    await adminPage.goto(`${BASE_URL}/teams/${tenantId}/members`);
    await adminPage.waitForLoadState('networkidle');

    // Admin: Clicar "Convidar Membro"
    const inviteBtn = adminPage.locator('button:has-text("Convidar Membro")');
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();

    // Admin: Preencher modal
    const emailInput = adminPage.locator('input[type="email"]');
    const roleSelect = adminPage.locator('input[value="member"]');
    const submitBtn = adminPage.locator('button:has-text("Enviar Convite")');

    await emailInput.fill(NEW_MEMBER_EMAIL);
    await roleSelect.check();
    await submitBtn.click();

    // Admin: Verificar sucesso
    await expect(adminPage.locator('text=Convite enviado')).toBeVisible();
    await adminPage.waitForTimeout(2000);

    // Admin: Verificar convite na lista
    const invitesTab = adminPage.locator('button:has-text("Convites Pendentes")');
    await invitesTab.click();
    await expect(adminPage.locator(`text=${NEW_MEMBER_EMAIL}`)).toBeVisible();

    // Novo membro: Aceitar convite
    const memberPage = await context.newPage();
    await memberPage.goto(`${BASE_URL}/accept-invite?email=${NEW_MEMBER_EMAIL}`);
    await memberPage.waitForLoadState('networkidle');

    // Buscar token de convite (em produção viria via email)
    const inviteToken = await getInviteToken(NEW_MEMBER_EMAIL, tenantId);
    await memberPage.goto(`${BASE_URL}/accept-invite?token=${inviteToken}`);

    const acceptBtn = memberPage.locator('button:has-text("Aceitar Convite")');
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Novo membro: Verificar redirecionamento
    await expect(memberPage).toHaveURL(/.*\/teams\/.*$/);
    await expect(memberPage.locator('text=Bem-vindo')).toBeVisible();

    // Admin: Verificar novo membro na lista
    await adminPage.reload();
    const membersTab = adminPage.locator('button:has-text("Membros")');
    await membersTab.click();
    await expect(adminPage.locator(`text=${NEW_MEMBER_EMAIL}`)).toBeVisible();

    await adminPage.close();
    await memberPage.close();
  });

  // ===== TEST 2: Mudar Role =====

  test('02. Deve mudar role de membro de member para admin', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/teams/${tenantId}/members`);
    await page.waitForLoadState('networkidle');

    // Buscar linha do membro
    const memberRow = page.locator(`text=${NEW_MEMBER_EMAIL}`);
    await memberRow.hover();

    // Clicar "Mudar role"
    const changeRoleBtn = page.locator('button:has-text("Mudar role")');
    await expect(changeRoleBtn).toBeVisible();
    await changeRoleBtn.click();

    // Confirmar no dialog
    const confirmBtn = page.locator('button:has-text("Confirmar")');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Verificar role foi alterada
    await page.waitForTimeout(1000);
    await page.reload();
    const newRole = page.locator(`text=${NEW_MEMBER_EMAIL}`)
      .locator('xpath=..')
      .locator('span:has-text("admin")');
    await expect(newRole).toBeVisible();

    // Verificar no audit log
    const auditTab = page.locator('button:has-text("Auditoria")');
    await auditTab.click();
    await expect(page.locator('text=Role alterada')).toBeVisible();

    await page.close();
  });

  // ===== TEST 3: Remover Membro =====

  test('03. Deve remover membro com soft-delete', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/teams/${tenantId}/members`);
    await page.waitForLoadState('networkidle');

    // Buscar membro
    const memberRow = page.locator(`text=${NEW_MEMBER_EMAIL}`);
    await memberRow.hover();

    // Clicar "Remover"
    const removeBtn = page.locator('button:has-text("Remover")');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Confirmar no dialog de danger
    const confirmBtn = page.locator('button:has-text("Remover")');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Verificar membro desapareceu
    await page.waitForTimeout(1000);
    await expect(memberRow).not.toBeVisible();

    // Verificar no audit
    const auditTab = page.locator('button:has-text("Auditoria")');
    await auditTab.click();
    await expect(page.locator('text=Membro removido')).toBeVisible();

    await page.close();
  });

  // ===== TEST 4: Rate Limiting =====

  test('04. Deve enforçar rate limiting em convites', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/teams/${tenantId}/members`);
    await page.waitForLoadState('networkidle');

    const inviteBtn = page.locator('button:has-text("Convidar Membro")');

    // Enviar 20 convites (limite)
    for (let i = 0; i < 20; i++) {
      await inviteBtn.click();
      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill(`user${i}@test.com`);
      const submitBtn = page.locator('button:has-text("Enviar Convite")');
      await submitBtn.click();
      await page.waitForTimeout(100);
    }

    // 21º convite deve falhar
    await inviteBtn.click();
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('user21@test.com');
    const submitBtn = page.locator('button:has-text("Enviar Convite")');
    await submitBtn.click();

    // Verificar erro de rate limit
    await expect(page.locator('text=Rate limit exceeded')).toBeVisible();

    await page.close();
  });

  // ===== TEST 5: Permission Isolation =====

  test('05. Membro normal não deve ver tab Auditoria', async ({ context }) => {
    const page = await context.newPage();
    // Login como member (não admin)
    await authenticateAs(page, MEMBER_EMAIL);
    await page.goto(`${BASE_URL}/teams/${tenantId}/members`);
    await page.waitForLoadState('networkidle');

    // Tab Auditoria deve estar oculta
    const auditTab = page.locator('button:has-text("Auditoria")');
    await expect(auditTab).not.toBeVisible();

    // Botão Convidar deve estar oculto
    const inviteBtn = page.locator('button:has-text("Convidar Membro")');
    await expect(inviteBtn).not.toBeVisible();

    await page.close();
  });

  // ===== TEST 6: Último Admin Protection =====

  test('06. Não deve permitir remover último admin', async ({ context }) => {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/teams/${tenantId}/members`);
    await page.waitForLoadState('networkidle');

    // Buscar último admin
    const adminRow = page.locator('text=admin').first();
    await adminRow.hover();

    const removeBtn = page.locator('button:has-text("Remover")');
    await removeBtn.click();

    // Dialog deve mostrar erro específico
    await expect(page.locator('text=Cannot remove last admin')).toBeVisible();

    await page.close();
  });

  // ===== TEST 7: Real-time Sync =====

  test('07. Deve sincronizar em tempo real entre abas', async ({ browser, context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Abrir página em 2 abas
    await page1.goto(`${BASE_URL}/teams/${tenantId}/members`);
    await page2.goto(`${BASE_URL}/teams/${tenantId}/members`);
    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');

    // Página 1: Enviar convite
    const inviteBtn = page1.locator('button:has-text("Convidar Membro")');
    await inviteBtn.click();
    const emailInput = page1.locator('input[type="email"]');
    await emailInput.fill('realtime@test.com');
    const submitBtn = page1.locator('button:has-text("Enviar Convite")');
    await submitBtn.click();

    // Página 2: Verificar convite apareceu automaticamente
    const invitesTab = page2.locator('button:has-text("Convites")');
    await invitesTab.click();

    // Esperar listener propagar
    await page2.waitForTimeout(1000);

    await expect(page2.locator('text=realtime@test.com')).toBeVisible();

    await page1.close();
    await page2.close();
  });
});

// ===== HELPERS =====

async function getInviteToken(email, tenantId) {
  // Buscar token via API (em produção, viria via email)
  const response = await fetch(
    `http://localhost:3000/api/test/invite-token?email=${email}&tenantId=${tenantId}`
  );
  const { token } = await response.json();
  return token;
}

async function authenticateAs(page, email) {
  // Mock login para testes
  await page.goto(`${BASE_URL}/login?email=${email}`);
  // ... completar com seu fluxo de auth
}
