import { test, expect } from "@playwright/test";
import { loginAsStaff, resetStaffTwoFactor } from "./support/staff";
import { runDbCommand } from "./support/db";

/**
 * Parcours clé #4a (§J, Phase 12) : réservation — un visiteur réserve un
 * créneau sur un service BOOKING, puis le staff change son statut.
 * Aucun bookingConfig / AvailabilityRule n'est seedé (vérifié dans le code
 * avant d'écrire ce test) : on configure le service de seed
 * "rendez-vous-visa" directement en base pour un test déterministe, puis on
 * restaure son état d'origine (bookingConfig: null) en nettoyage.
 */
const SERVICE_SLUG = "rendez-vous-visa";

test.describe("parcours réservation", () => {
  let serviceId = "";
  let ruleId = "";
  let reservationId = "";

  test.afterAll(async () => {
    if (reservationId) {
      await runDbCommand({ op: "raw", model: "reservation", method: "delete", args: { where: { id: reservationId } } });
    }
    if (ruleId) {
      await runDbCommand({ op: "raw", model: "availabilityRule", method: "delete", args: { where: { id: ruleId } } });
    }
    if (serviceId) {
      await runDbCommand({ op: "raw", model: "service", method: "update", args: { where: { id: serviceId }, data: { bookingConfig: null } } });
    }
    await resetStaffTwoFactor();
  });

  test("un visiteur réserve un créneau, le staff confirme la réservation", async ({ page }) => {
    const service = await runDbCommand<{ id: string } | null>({
      op: "raw",
      model: "service",
      method: "findFirst",
      args: { where: { translations: { some: { locale: "fr", slug: SERVICE_SLUG } } } },
    });
    expect(service).not.toBeNull();
    serviceId = service!.id;

    // Config non seedée par défaut : mode AGENCY_SLOT, aucun préavis
    // minimal pour ne pas dépendre de l'heure d'exécution du test.
    await runDbCommand({
      op: "raw",
      model: "service",
      method: "update",
      args: {
        where: { id: serviceId },
        data: {
          bookingConfig: {
            mode: "AGENCY_SLOT",
            slotMinutes: 30,
            capacityPerSlot: 5,
            minNoticeHours: 0,
            maxAdvanceDays: 60,
            requiredDocuments: [],
            fee: null,
          },
        },
      },
    });
    const rule = await runDbCommand<{ id: string }>({
      op: "raw",
      model: "availabilityRule",
      method: "create",
      args: { data: { serviceId, weekday: new Date().getDay(), startTime: "00:00", endTime: "23:59" } },
    });
    ruleId = rule.id;

    const email = `e2e-booking-${Date.now()}@saldaeconnect.test`;

    await page.goto(`/fr/services/${SERVICE_SLUG}`, { waitUntil: "networkidle" });
    // Anti-spam (§H.2), même piège que le formulaire de devis public.
    await page.waitForTimeout(2200);

    await expect(page.getByText("Choisir un créneau")).toBeVisible();
    // Attend que les créneaux (chargés en client) remplacent "Chargement…".
    await expect(page.getByText("Chargement des créneaux…")).toBeHidden({ timeout: 15000 });
    const firstSlot = page.locator("form button[type=\"button\"]").first();
    await expect(firstSlot).toBeVisible({ timeout: 15000 });
    await firstSlot.click();

    await page.fill("#booking-first-name", "E2E");
    await page.fill("#booking-last-name", "Visiteur Réservation");
    await page.fill("#booking-email", email);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Envoyer la demande" }).click();

    await expect(page.getByText(/Demande envoyée, numéro/)).toBeVisible({ timeout: 15000 });

    const reservation = await runDbCommand<{ id: string; status: string } | null>({
      op: "raw",
      model: "reservation",
      method: "findFirst",
      args: { where: { serviceId, contact: { path: ["email"], equals: email } } },
    });
    expect(reservation).not.toBeNull();
    reservationId = reservation!.id;
    expect(reservation?.status).toBe("REQUESTED");

    // Le staff confirme la réservation.
    await loginAsStaff(page);
    await page.goto(`/fr/admin/bookings/${reservationId}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await page.locator("select").first().selectOption("CONFIRMED");
    await page.getByRole("button", { name: "Confirmer" }).click();
    await page.waitForLoadState("networkidle");

    const confirmedReservation = await runDbCommand<{ status: string } | null>({
      op: "raw",
      model: "reservation",
      method: "findUnique",
      args: { where: { id: reservationId } },
    });
    expect(confirmedReservation?.status).toBe("CONFIRMED");
  });
});
