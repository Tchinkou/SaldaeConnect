import { defineConfig, devices } from "@playwright/test";

/**
 * E2E "parcours clés" (Phase 12, §J). Suppose un serveur de dev déjà lancé
 * (`npm run dev`) et une base PostgreSQL migrée+seedée — pas de `webServer`
 * ici : ces tests s'exécutent contre un environnement réel préparé par
 * l'opérateur (voir `docs/deployment.md`), jamais contre un mock.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
