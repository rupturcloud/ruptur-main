import { expect, test } from "@playwright/test";

test.describe("preview local Ruptur", () => {
  test("health API responde com runtime ativo", async ({ request }) => {
    const response = await request.get("/api/local/health");

    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toMatch(/application\/json/);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.port).toBe(4173);
  });

  test("home carrega o front principal", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/Ruptur/i);
    await expect(page.locator("body")).toContainText(/Ruptur|Warmup|Dashboard/i);
    expect(pageErrors).toEqual([]);
  });

  test("warmup manager carrega no path isolado", async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto("/warmup/", { waitUntil: "networkidle" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("#root")).toBeAttached();
    await expect(page.locator("body")).toContainText(
      /Warmup|Dashboard|Instâncias|UAZAPI|Business Boost/i,
    );
    expect(pageErrors).toEqual([]);
  });
});
