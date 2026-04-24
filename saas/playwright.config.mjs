import { defineConfig, devices } from "@playwright/test";

const host = process.env.WARMUP_RUNTIME_HOST || "127.0.0.1";
const port = process.env.WARMUP_RUNTIME_PORT || "4173";
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  outputDir: "tmp/playwright-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "tmp/playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `WARMUP_RUNTIME_HOST=${host} WARMUP_RUNTIME_PORT=${port} npm start`,
    url: `${baseURL}/api/local/health`,
    reuseExistingServer: true,
    timeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
