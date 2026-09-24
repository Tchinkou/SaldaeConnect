import { test, expect } from "@playwright/test";
import { loginAsStaff, resetStaffTwoFactor } from "./support/staff";
import { runDbCommand } from "./support/db";

/**
 * Parcours clé #2 (§J, Phase 12) : staff CRM — lead → conversion en client →
 * devis → projet. La création d'un Projet ne passe que par l'acceptation
 * d'un devis (aucune route admin ne crée un Projet directement — vérifié en
 * lisant le code avant d'écrire ce test), donc ce parcours rejoint celui du
 * devis à partir de l'étape « Créer un devis » sur l'opportunité, plutôt que
 * de dupliquer entièrement `public-quote-journey.spec.ts`.
 */
test.describe("parcours CRM staff", () => {
  test.afterAll(async () => {
    await resetStaffTwoFactor();
  });

  test("un lead créé manuellement est converti en client, son opportunité produit un devis accepté et un projet", async ({
    page,
    browser,
  }) => {
    const email = `e2e-crm-lead-${Date.now()}@saldaeconnect.test`;
    let leadId = "";
    let clientId = "";
    let clientLoginUserId = "";

    try {
      await loginAsStaff(page);

      // 1) Création manuelle d'un lead, avec un service choisi : crée
      // automatiquement une Opportunity liée (comportement documenté du
      // formulaire), évitant de passer par le Kanban pour en créer une.
      await page.goto("/fr/admin/leads/new", { waitUntil: "networkidle" });
      await page.fill("#new-lead-first-name", "E2E");
      await page.fill("#new-lead-last-name", "CRM Lead");
      await page.fill("#new-lead-email", email);
      await page.selectOption("#new-lead-service", { index: 1 });
      await page.getByRole("button", { name: "Créer le prospect" }).click();
      // L'URL du formulaire (/admin/leads/new) matcherait un regex non
      // exclusif — même piège que documenté pour /admin/quotes/new.
      await page.waitForURL(/\/admin\/leads\/(?!new$)[^/]+$/, { timeout: 15000 });
      leadId = page.url().match(/\/admin\/leads\/([^/]+)$/)![1]!;

      // 2) Conversion en client — le bouton ne redirige nulle part (état
      // local uniquement), donc on vérifie en base plutôt que sur l'UI.
      await page.getByRole("button", { name: "Convertir en client" }).click();
      await expect(page.getByRole("link", { name: "Voir la fiche client" })).toBeVisible({ timeout: 10000 });

      const convertedLead = await runDbCommand<{ status: string; convertedClientId: string | null } | null>({
        op: "raw",
        model: "lead",
        method: "findUnique",
        args: { where: { id: leadId } },
      });
      expect(convertedLead?.status).toBe("CONVERTED");
      expect(convertedLead?.convertedClientId).toBeTruthy();
      clientId = convertedLead!.convertedClientId!;

      const opportunity = await runDbCommand<{ id: string; clientId: string | null } | null>({
        op: "raw",
        model: "opportunity",
        method: "findFirst",
        args: { where: { leadId } },
      });
      expect(opportunity).not.toBeNull();

      // 3) Depuis l'opportunité, création du devis (convertit aussi le lead
      // en client si ce n'était pas déjà fait — ici déjà fait à l'étape 2).
      await page.goto(`/fr/admin/crm/opportunities/${opportunity!.id}`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Créer un devis" }).click();
      await page.waitForURL(/\/admin\/quotes\/(?!new$)[^/]+$/, { timeout: 15000 });
      const quoteId = page.url().match(/\/admin\/quotes\/([^/]+)$/)![1]!;

      await page.getByRole("button", { name: "Ajouter une ligne" }).click();
      await page.fill("#quote-item-title", "Prestation CRM E2E");
      await page.fill("#quote-item-quantity", "1");
      await page.fill("#quote-item-unit-price", "75000");
      // Même libellé pour le déclencheur et la soumission du formulaire de
      // ligne — un seul bouton reste dans le DOM une fois le formulaire ouvert.
      await page.getByRole("button", { name: "Ajouter une ligne" }).click();
      await expect(page.getByText("Prestation CRM E2E")).toBeVisible();

      await page.getByRole("button", { name: "Envoyer le devis" }).click();
      await page.getByRole("button", { name: "Oui, envoyer" }).click();
      await page.waitForLoadState("networkidle");

      const sentQuote = await runDbCommand<{ status: string } | null>({
        op: "raw",
        model: "quote",
        method: "findUnique",
        args: { where: { id: quoteId } },
      });
      expect(sentQuote?.status).toBe("SENT");

      // 4) Le client issu d'une conversion de lead n'a par nature aucun
      // compte de connexion — on lui en crée un directement en base (même
      // contournement de la limite HIBP du bac à sable que dans
      // `public-quote-journey.spec.ts`), pour pouvoir accepter le devis.
      const login = await runDbCommand<{ email: string; password: string; userId: string }>({
        op: "createClientLogin",
        clientId,
        label: "crm-lead-client",
      });
      clientLoginUserId = login.userId;

      const clientContext = await browser.newContext();
      const clientPage = await clientContext.newPage();
      await clientPage.goto("/fr/login", { waitUntil: "networkidle" });
      await clientPage.fill('input[type="email"]', login.email);
      await clientPage.fill('input[type="password"]', login.password);
      await clientPage.click('button[type="submit"]');
      await clientPage.waitForLoadState("networkidle");
      await clientPage.waitForTimeout(1000);

      await clientPage.goto(`/fr/portal/quotes/${quoteId}`, { waitUntil: "networkidle" });
      await clientPage.getByRole("button", { name: "Accepter ce devis" }).click();
      await clientPage.fill("#quote-decision-signer-name", "E2E CRM Lead");
      await clientPage.getByRole("button", { name: "Accepter ce devis" }).click();
      await clientPage.waitForLoadState("networkidle");
      await clientContext.close();

      const acceptedQuote = await runDbCommand<{ status: string } | null>({
        op: "raw",
        model: "quote",
        method: "findUnique",
        args: { where: { id: quoteId } },
      });
      expect(acceptedQuote?.status).toBe("ACCEPTED");

      const project = await runDbCommand<{ id: string; clientId: string } | null>({
        op: "raw",
        model: "project",
        method: "findFirst",
        args: { where: { clientId } },
      });
      expect(project).not.toBeNull();
      expect(project?.clientId).toBe(clientId);
    } finally {
      // Nettoyage (règle de résidu zéro), quel que soit le point d'échec.
      await runDbCommand({ op: "cleanupCrmJourney", leadId, clientId, userId: clientLoginUserId || undefined });
    }
  });
});
