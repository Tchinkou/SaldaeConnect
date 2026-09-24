import { test, expect } from "@playwright/test";
import { loginAsStaff, resetStaffTwoFactor } from "./support/staff";
import { createTestClientContact, type TestClientContact } from "./support/client";
import { runDbCommand } from "./support/db";

/**
 * Parcours clé #3 (§J, Phase 12) : facturation — facture émise → acompte
 * (paiement partiel) → solde (paiement final), jusqu'au statut PAID.
 * L'acompte automatique à l'acceptation d'un devis dépend d'un `Setting`
 * optionnel et de champs `depositPercent`/`depositAmount` non renseignés
 * dans le parcours devis déjà testé — on crée donc la facture directement
 * (chemin déterministe), et on modélise « l'acompte » comme le premier des
 * deux paiements partiels menant au solde.
 */
test.describe("cycle de vie d'une facture (émission → acompte → solde)", () => {
  let testClient: TestClientContact;

  test.beforeAll(async () => {
    testClient = await createTestClientContact("invoice-lifecycle");
  });

  test.afterAll(async () => {
    await testClient.cleanup();
    await resetStaffTwoFactor();
  });

  test("une facture émise passe par un paiement partiel puis un paiement soldant intégralement le solde", async ({
    page,
  }) => {
    await loginAsStaff(page);

    await page.goto("/fr/admin/invoices/new", { waitUntil: "networkidle" });
    await page.selectOption("#new-invoice-client", { value: testClient.clientId });
    await page.getByRole("button", { name: "Créer le brouillon" }).click();
    // L'URL du formulaire (/admin/invoices/new) matcherait un regex non
    // exclusif — même piège que documenté pour /admin/quotes/new.
    await page.waitForURL(/\/admin\/invoices\/(?!new$)[^/]+$/, { timeout: 15000 });
    const invoiceId = page.url().match(/\/admin\/invoices\/([^/]+)$/)![1]!;

    // Ligne unique à 100 000 DZD — deux paiements de 40 000 puis 60 000
    // couvrent le total exactement, sans reste dû résiduel par arrondi.
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await page.fill("#invoice-item-title", "Prestation facturation E2E");
    await page.fill("#invoice-item-quantity", "1");
    await page.fill("#invoice-item-unit-price", "100000");
    // Même libellé pour le déclencheur et la soumission du formulaire de
    // ligne — un seul bouton reste dans le DOM une fois le formulaire ouvert.
    await page.getByRole("button", { name: "Ajouter une ligne" }).click();
    await expect(page.getByText("Prestation facturation E2E")).toBeVisible();

    await page.getByRole("button", { name: "Émettre" }).click();
    await page.getByRole("button", { name: "Oui, émettre" }).click();
    await page.waitForLoadState("networkidle");

    const issuedInvoice = await runDbCommand<{ status: string; total: string } | null>({
      op: "raw",
      model: "invoice",
      method: "findUnique",
      args: { where: { id: invoiceId } },
    });
    expect(issuedInvoice?.status).toBe("SENT");
    expect(issuedInvoice?.total).toBe("10000000"); // 100 000,00 DZD en centimes

    // Paiement partiel (« acompte ») : 40 000 DZD sur 100 000.
    await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
    await page.fill("#invoice-payment-amount", "40000");
    // Même libellé déclencheur/soumission que pour les lignes de devis/facture.
    await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
    await page.waitForLoadState("networkidle");

    const partiallyPaidInvoice = await runDbCommand<{ status: string; amountPaid: string; balanceDue: string } | null>({
      op: "raw",
      model: "invoice",
      method: "findUnique",
      args: { where: { id: invoiceId } },
    });
    expect(partiallyPaidInvoice?.status).toBe("PARTIALLY_PAID");
    expect(partiallyPaidInvoice?.amountPaid).toBe("4000000");
    expect(partiallyPaidInvoice?.balanceDue).toBe("6000000");

    // Paiement du solde : 60 000 DZD restants.
    await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
    await page.fill("#invoice-payment-amount", "60000");
    await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
    await page.waitForLoadState("networkidle");

    const paidInvoice = await runDbCommand<{ status: string; amountPaid: string; balanceDue: string } | null>({
      op: "raw",
      model: "invoice",
      method: "findUnique",
      args: { where: { id: invoiceId } },
    });
    expect(paidInvoice?.status).toBe("PAID");
    expect(paidInvoice?.amountPaid).toBe("10000000");
    expect(paidInvoice?.balanceDue).toBe("0");

    // Nettoyage explicite avant celui de `testClient.cleanup()` (qui gère
    // déjà Payment/Invoice par clientId, mais on vérifie ici l'état final
    // plutôt que de le supposer implicitement).
  });
});
