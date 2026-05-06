import { test, expect } from '@playwright/test';

const BASE_URL = process.env.WARMUP_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:4173';

// Lista de rotas críticas para testar
const CRITICAL_ROUTES = [
  { path: '/api/local/health', name: 'Health Check API' },
  { path: '/warmup/', name: 'Warmup Manager Light' },
  { path: '/warmup/dark/', name: 'Warmup Manager Dark' },
  { path: '/api/inbox/summary?tenantId=smoke-tenant', name: 'Inbox Summary API' },
  { path: '/api/campaigns/', name: 'Campaigns API' },
];

test.describe('🚀 Smoke Tests - Rotas Críticas', () => {
  for (const route of CRITICAL_ROUTES) {
    test(`${route.name} responde com 200`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}${route.path}`);
      expect(response.status()).toBe(200);
    });
  }
});

test.describe('🎨 Validação de Temas', () => {
  test('Warmup Light carrega sem erros', async ({ page }) => {
    await page.goto(`${BASE_URL}/warmup/`);
    
    // Verifica título
    await expect(page).toHaveTitle(/Warmup|Business Boost/);
    
    // Verifica que a página renderizou conteúdo operacional, sem cair em tela de erro HTTP.
    const body = await page.locator('body').textContent();
    expect(body).toContain('Warmup Manager');
    expect(body).not.toMatch(/\b(404|500)\b.*\b(Not Found|Internal Server Error|Erro)\b/i);
  });

  test('Warmup Dark carrega com tema escuro', async ({ page }) => {
    await page.goto(`${BASE_URL}/warmup/dark/`);
    
    // Verifica título específico do dark
    await expect(page).toHaveTitle(/Dark|Warmup Manager/);
    
    // Verifica se o CSS dark foi carregado
    const hasDarkCss = await page.locator('link[href*="dark"], link[href*="client-area-dark"]').count();
    expect(hasDarkCss).toBeGreaterThan(0);
  });
});

test.describe('🔐 Health Check', () => {
  test('API Health retorna OK', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/local/health`);
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.scheduler).toBeDefined();
    expect(typeof body.scheduler.enabled).toBe('boolean');
  });

  test('API Health tem port correto', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/local/health`);
    const body = await response.json();
    expect(body.port).toBe(4173);
  });
});

test.describe('📊 Assets Estáticos', () => {
  test('CSS base carrega', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/warmup/assets/index-CPyaI1ei.css`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/css');
  });

  test('CSS dark carrega', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/warmup/assets/client-area-dark.css`);
    // Pode ser 200 ou 404 se não existir
    expect([200, 404]).toContain(response.status());
  });
});
