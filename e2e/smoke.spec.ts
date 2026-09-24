import { test, expect } from "@playwright/test";
import { loginAsStaff, resetStaffTwoFactor } from "./support/staff";
import { createTestClientContact } from "./support/client";

/**
 * Vérifie que l'infrastructure E2E elle-même fonctionne (connexion STAFF
 * avec 2FA réelle, création/nettoyage d'un compte client de test) avant
 * d'y construire les parcours clés. Pas un parcours métier en soi.
 */
test("infra: connexion STAFF avec 2FA puis remise à zéro", async ({ page }) => {
  await loginAsStaff(page);
  await expect(page).toHaveURL(/\/admin/);
  await resetStaffTwoFactor();
});

test("infra: création puis nettoyage d'un compte client de test", async ({ page }) => {
  const testClient = await createTestClientContact("smoke");
  try {
    await page.goto("/fr/login", { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', testClient.email);
    await page.fill('input[type="password"]', testClient.password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    // La redirection post-connexion peut accuser un léger retard par
    // rapport à networkidle (même piège que documenté dans
    // public-quote-journey.spec.ts pour la connexion du client de test).
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/portal/, { timeout: 15000 });
  } finally {
    await testClient.cleanup();
  }
});
