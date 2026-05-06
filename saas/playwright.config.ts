import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 * E2E tests for Ruptur SaaS Payment Workflow
 */

const WARMUP_HOST = process.env.WARMUP_RUNTIME_HOST || '127.0.0.1';
const WARMUP_PORT = process.env.WARMUP_RUNTIME_PORT || '4173';
const WARMUP_BASE_URL =
  process.env.WARMUP_BASE_URL ||
  process.env.BASE_URL ||
  `http://${WARMUP_HOST}:${WARMUP_PORT}`;

const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = process.env.PORT_API || '3001';
const API_BASE_URL = process.env.API_BASE_URL || `http://${API_HOST}:${API_PORT}`;

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: WARMUP_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: [
    {
      command: `WARMUP_RUNTIME_HOST=${WARMUP_HOST} WARMUP_RUNTIME_PORT=${WARMUP_PORT} npm start`,
      url: `${WARMUP_BASE_URL}/api/local/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `API_HOST=${API_HOST} PORT_API=${API_PORT} GETNET_WEBHOOK_SECRET=${process.env.GETNET_WEBHOOK_SECRET || 'playwright-getnet-secret'} node api/gateway.mjs`,
      url: `${API_BASE_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile tests
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
