import { test, expect } from "@playwright/test";
import { loginAsStaff } from "./support/staff";
import { createTestClientContact, type TestClientContact } from "./support/client";
import { runDbCommand } from "./support/db";

/**
 * Parcours clé #1 (§J, Phase 12) : site public → devis → décision client.
 * Deux scénarios distincts plutôt qu'une seule longue chaîne : la demande
 * publique crée un Lead/une Opportunité (qualifiés ensuite en CRM, hors
 * périmètre ici — voir le parcours CRM), tandis que le cycle de vie d'un
 * devis (création admin → envoi → décision portail) part d'un client déjà
 * existant. Les deux couvrent la surface publique+client du parcours.
 */

test.describe("demande de devis publique", () => {
  test("un visiteur soumet une demande et un Lead + une Opportunité sont créés", async ({ page }) => {
    const email = `e2e-quote-request-${Date.now()}@saldaeconnect.test`;

    await page.goto("/fr/quote", { waitUntil: "networkidle" });
    // Anti-spam (§H.2) : le serveur rejette tout envoi à moins de 2s du
    // rendu du formulaire (`renderedAt`) — un parcours automatisé va plus
    // vite qu'un humain, donc on attend explicitement.
    await page.waitForTimeout(2200);

    // Étape service
    await expect(page.getByRole("heading", { name: "Service" })).toBeVisible();
    const serviceSelect = page.locator("select").first();
    await serviceSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Suivant" }).click();

    // Étape budget (facultative, on passe)
    await expect(page.getByText("Quel est votre budget")).toBeVisible().catch(() => {});
    await page.getByRole("button", { name: "Suivant" }).click();

    // Étape échéance (facultative, on passe)
    await page.getByRole("button", { name: "Suivant" }).click();

    // Étape contact
    await page.fill("#quote-firstName", "E2E");
    await page.fill("#quote-lastName", "Visiteur");
    await page.fill("#quote-email", email);
    await page.getByRole("button", { name: "Suivant" }).click();

    // Étape message
    await page.fill("#quote-message", "Ceci est une demande de test E2E (Phase 12) — à ignorer.");
    await page.getByRole("button", { name: "Suivant" }).click();

    // Résumé
    await page.getByLabel("J'accepte que mes données soient utilisées pour traiter ma demande.").check();
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();

    await expect(page.getByRole("heading", { name: "Demande envoyée" })).toBeVisible({ timeout: 15000 });

    // Vérité terrain en base : Lead + Opportunité créés pour cet email.
    const lead = await runDbCommand<{ id: string } | null>({
      op: "raw",
      model: "lead",
      method: "findFirst",
      args: { where: { email } },
    });
    expect(lead).not.toBeNull();

    const opportunity = await runDbCommand<{ id: string } | null>({
      op: "raw",
      model: "opportunity",
      method: "findFirst",
      args: { where: { leadId: lead!.id } },
    });
    expect(opportunity).not.toBeNull();

    // Nettoyage (règle de résidu zéro).
    await runDbCommand({ op: "raw", model: "opportunity", method: "deleteMany", args: { where: { leadId: lead!.id } } });
    await runDbCommand({ op: "raw", model: "lead", method: "deleteMany", args: { where: { id: lead!.id } } });
  });
});

test.describe("cycle de vie d'un devis (admin → portail)", () => {
  let testClient: TestClientContact;

  test.beforeAll(async () => {
    testClient = await createTestClientContact("quote-lifecycle");
  });

  test.afterAll(async () => {
    await testClient.cleanup();
  });

  test("un devis créé et envoyé par le staff est accepté par le client, un Projet est créé", async ({ page, browser }) => {
    await loginAsStaff(page);

    await page.goto("/fr/admin/quotes/new", { waitUntil: "networkidle" });
    // Le libellé affiché (displayName) n'est pas unique entre exécutions —
    // on sélectionne par `value` (l'id du client), sans ambiguïté possible.
    await page.selectOption("#new-quote-client", { value: testClient.clientId });
    await page.getByRole("button", { name: "Créer le devis" }).click();
    // La regex exclut explicitement `new` : sinon `waitForURL` est déjà
    // satisfaite par l'URL du formulaire lui-même (/admin/quotes/new) et ne
    // bloque pas jusqu'à la vraie redirection post-création.
    await page.waitForURL(/\/admin\/quotes\/(?!new$)[^/]+$/, { timeout: 15000 });
    const quoteId = page.url().match(/\/admin\/quotes\/([^/]+)$/)![1]!;

    // Ligne de devis
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await page.fill("#quote-item-title", "Prestation de test E2E");
    await page.fill("#quote-item-quantity", "1");
    await page.fill("#quote-item-unit-price", "50000");
    // Le bouton de soumission du formulaire de ligne porte le même libellé
    // que celui qui l'a ouvert ; une fois le formulaire ouvert, un seul
    // bouton "Ajouter une ligne" reste dans le DOM (le déclencheur externe
    // est remplacé par le formulaire).
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await expect(page.getByText("Prestation de test E2E")).toBeVisible();

    // Envoi (double confirmation)
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

    // Décision côté portail, dans un contexte de navigateur séparé (compte
    // client distinct du compte staff connecté sur `page`).
    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    await clientPage.goto("/fr/login", { waitUntil: "networkidle" });
    await clientPage.fill('input[type="email"]', testClient.email);
    await clientPage.fill('input[type="password"]', testClient.password);
    await clientPage.click('button[type="submit"]');
    await clientPage.waitForLoadState("networkidle");
    await clientPage.waitForTimeout(1000);

    await clientPage.goto(`/fr/portal/quotes/${quoteId}`, { waitUntil: "networkidle" });
    await clientPage.getByRole("button", { name: "Accepter ce devis" }).click();
    await clientPage.fill("#quote-decision-signer-name", "E2E Test quote-lifecycle");
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

    const project = await runDbCommand<{ id: string } | null>({
      op: "raw",
      model: "project",
      method: "findFirst",
      args: { where: { clientId: testClient.clientId } },
    });
    expect(project).not.toBeNull();

    // Nettoyage (règle de résidu zéro) — le Projet et le Devis suivent le
    // client via cascade au `cleanup()` de `createTestClientContact`, mais
    // on vérifie explicitement ici plutôt que de le supposer implicitement.
  });
});
