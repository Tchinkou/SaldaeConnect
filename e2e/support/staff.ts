import type { Page } from "@playwright/test";
import { runDbCommand } from "./db";
import { totp } from "./totp";

export const STAFF_EMAIL = "chakib@saldaeconnect.test";
export const STAFF_PASSWORD = "SaldaeConnect2026!";

/**
 * Connecte le compte STAFF de seed et passe la double authentification
 * obligatoire (Phase 11, §H.2) — que le compte soit déjà enrôlé ou non. Ne
 * contourne jamais le contrôle 2FA : simule une vraie application
 * d'authentification via `totp()`.
 *
 * Laisse le compte enrôlé après le test (comme le seed initial ne l'est
 * pas) — appeler `resetStaffTwoFactor()` en nettoyage pour revenir à l'état
 * de départ (règle de résidu zéro, voir mémoire projet).
 */
export async function loginAsStaff(page: Page, path = "/fr/admin"): Promise<void> {
  await page.goto("/fr/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', STAFF_EMAIL);
  await page.fill('input[type="password"]', STAFF_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("networkidle", { timeout: 15000 });
  // Le passage par /admin avant la redirection serveur vers
  // /two-factor-setup peut apparaître brièvement dans l'URL avant que la
  // vraie redirection se termine (piège déjà rencontré en Phase 11) — on
  // laisse un délai franc plutôt que de lire l'URL immédiatement.
  await page.waitForTimeout(1000);

  if (page.url().includes("two-factor-setup")) {
    await page.fill("#tfa-password", STAFF_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector("code", { timeout: 15000 });
    const secret = (await page.textContent("code"))!.trim();
    await page.fill("#tfa-code", totp(secret));
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    // La session ne marque le 2FA vérifié qu'après la réponse de
    // verify-totp (cookie posé côté client) — une navigation immédiate
    // vers une page protégée peut encore voir l'ancien état et rebondir
    // sur /two-factor-setup (déjà observé). On laisse le cookie se poser.
    await page.waitForTimeout(1000);
  } else if (page.url().includes("/login/two-factor")) {
    const { secret } = await runDbCommand<{ secret: string | null }>({ op: "getStaffTotpSecret", email: STAFF_EMAIL });
    if (!secret) throw new Error("Compte STAFF marqué 2FA actif mais aucun secret TOTP en base.");
    await page.fill("#code", totp(secret));
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(1000);
  }

  if (path !== "/fr/admin") {
    await page.goto(path, { waitUntil: "networkidle" });
  }
}

/** Remet le compte STAFF de seed à son état de départ (2FA désactivée). */
export async function resetStaffTwoFactor(): Promise<void> {
  await runDbCommand({ op: "resetStaffTwoFactor", email: STAFF_EMAIL });
}
