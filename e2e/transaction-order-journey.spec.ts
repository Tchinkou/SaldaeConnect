import { test, expect } from "@playwright/test";
import { loginAsStaff } from "./support/staff";
import { createTestClientContact, type TestClientContact } from "./support/client";
import { runDbCommand } from "./support/db";

/**
 * Parcours clé #4b (§J, Phase 12) : transaction — module strictement interne
 * (§D.6, jamais public, confirmé dans le code) : REQUESTED → PRICE_CONFIRMED
 * → AWAITING_PAYMENT → PAID (via un paiement couvrant le total) → COMPLETED.
 * Aucun produit n'est seedé : on en crée un directement en base (trackStock
 * à false pour ne pas avoir à nettoyer de mouvement de stock).
 */
test.describe("parcours transaction", () => {
  let testClient: TestClientContact;
  let productId = "";

  test.beforeAll(async () => {
    testClient = await createTestClientContact("transaction-lifecycle");
    const product = await runDbCommand<{ id: string }>({
      op: "raw",
      model: "product",
      method: "create",
      args: {
        data: {
          kind: "CURRENCY",
          sku: `E2E-EUR-${Date.now()}`,
          trackStock: false,
          isActive: true,
          isPubliclyVisible: false,
          currentPrice: "15000",
          currentCurrency: "EUR",
          translations: {
            create: [
              { locale: "fr", name: "Euro E2E" },
              { locale: "en", name: "Euro E2E" },
              { locale: "ar", name: "Euro E2E" },
            ],
          },
        },
      },
    });
    productId = product.id;
  });

  test.afterAll(async () => {
    if (productId) {
      // TransactionPayment→TransactionOrder est en onDelete: Restrict : les
      // paiements doivent partir avant la commande.
      await runDbCommand({
        op: "raw",
        model: "transactionPayment",
        method: "deleteMany",
        args: { where: { order: { items: { some: { productId } } } } },
      });
      await runDbCommand({ op: "raw", model: "transactionOrder", method: "deleteMany", args: { where: { items: { some: { productId } } } } });
      await runDbCommand({ op: "raw", model: "stockMovement", method: "deleteMany", args: { where: { productId } } });
      await runDbCommand({ op: "raw", model: "product", method: "delete", args: { where: { id: productId } } });
    }
    await testClient.cleanup();
  });

  test("une commande passe par toutes les transitions jusqu'à COMPLETED", async ({ page }) => {
    await loginAsStaff(page);

    await page.goto("/fr/admin/transactions/new", { waitUntil: "networkidle" });
    await page.selectOption("#new-transaction-client", { value: testClient.clientId });
    await page.selectOption("#new-transaction-item-product", { value: productId });
    await page.getByRole("button", { name: "Créer la commande" }).click();
    // L'URL du formulaire (/admin/transactions/new) matcherait un regex non
    // exclusif — même piège que documenté pour /admin/quotes/new.
    await page.waitForURL(/\/admin\/transactions\/(?!new$)[^/]+$/, { timeout: 15000 });
    const orderId = page.url().match(/\/admin\/transactions\/([^/]+)$/)![1]!;

    type OrderRow = { status: string; total: string; completedAt: string | null };
    let order = await runDbCommand<OrderRow | null>({
      op: "raw",
      model: "transactionOrder",
      method: "findUnique",
      args: { where: { id: orderId } },
    });
    expect(order?.status).toBe("REQUESTED");

    // REQUESTED → PRICE_CONFIRMED : l'option par défaut du select de statut
    // est déjà PRICE_CONFIRMED (premher choix autorisé depuis REQUESTED),
    // seul le total confirmé doit être saisi.
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await page.fill("#transaction-confirmed-total", "30000");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await page.waitForLoadState("networkidle");

    order = await runDbCommand({ op: "raw", model: "transactionOrder", method: "findUnique", args: { where: { id: orderId } } });
    expect(order?.status).toBe("PRICE_CONFIRMED");
    expect(order?.total).toBe("30000"); // TransactionOrder.total est stocké en unités entières, pas en centimes

    // PRICE_CONFIRMED → AWAITING_PAYMENT : même mécanisme, premier choix
    // par défaut déjà AWAITING_PAYMENT.
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await page.getByRole("button", { name: "Confirmer" }).click();
    await page.waitForLoadState("networkidle");

    order = await runDbCommand({ op: "raw", model: "transactionOrder", method: "findUnique", args: { where: { id: orderId } } });
    expect(order?.status).toBe("AWAITING_PAYMENT");

    // AWAITING_PAYMENT → PAID : un paiement couvrant le total bascule le
    // statut automatiquement (sans passer par le contrôle de statut).
    await page.getByPlaceholder("Montant").fill("30000");
    await page.getByRole("button", { name: "Enregistrer un paiement" }).click();
    await page.waitForLoadState("networkidle");

    order = await runDbCommand({ op: "raw", model: "transactionOrder", method: "findUnique", args: { where: { id: orderId } } });
    expect(order?.status).toBe("PAID");

    // PAID → COMPLETED : premier choix par défaut déjà COMPLETED.
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await page.getByRole("button", { name: "Confirmer" }).click();
    await page.waitForLoadState("networkidle");

    order = await runDbCommand<OrderRow | null>({
      op: "raw",
      model: "transactionOrder",
      method: "findUnique",
      args: { where: { id: orderId } },
    });
    expect(order?.status).toBe("COMPLETED");
    expect(order?.completedAt).toBeTruthy();
  });
});
