import "server-only";
import { prisma } from "@/server/core/db/client";
import { createNotifications, isEmailNotificationEnabled } from "@/server/core/notify-admins";
import { sendReservationStatusChangeEmail } from "@/server/core/email/send-reservation-status-change-email";
import { logAudit } from "@/server/core/audit";

/**
 * Rappel automatique la veille d'un rendez-vous confirmé en mode
 * `AGENCY_SLOT` (§D.5). `remindedAt` sert de garde d'idempotence — comme
 * `runInvoicesOverdueJob`, chaque envoi passe par un `updateMany` filtré sur
 * l'état actuel avant d'agir, pour rester correct si le job tourne deux
 * fois en parallèle. Fenêtre large (24h à 48h) plutôt qu'un créneau étroit :
 * une exécution manquée (serveur arrêté) rattrape le rappel à la prochaine
 * exécution plutôt que de le perdre silencieusement.
 */
export async function runReservationsRemindJob(): Promise<{ remindedCount: number; remindedIds: string[]; failedIds: string[] }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const candidates = await prisma.reservation.findMany({
    where: { status: "CONFIRMED", startsAt: { gte: windowStart, lte: windowEnd }, remindedAt: null },
    include: { service: { include: { translations: { where: { locale: "fr" } } } } },
  });

  const remindedIds: string[] = [];
  const failedIds: string[] = [];

  for (const reservation of candidates) {
    try {
      const updated = await prisma.reservation.updateMany({ where: { id: reservation.id, remindedAt: null }, data: { remindedAt: now } });
      if (updated.count === 0) continue;

      const contact = reservation.contact as { email?: string };
      const clientContact = reservation.clientId
        ? await prisma.clientContact.findFirst({ where: { clientId: reservation.clientId, userId: { not: null } }, orderBy: { isPrimary: "desc" } })
        : null;

      if (contact.email && (await isEmailNotificationEnabled(clientContact?.userId ?? null, "reservation.status_changed"))) {
        await sendReservationStatusChangeEmail({ to: contact.email, reservationNumber: reservation.number, status: "CONFIRMED", locale: "fr" });
      }
      if (clientContact?.userId) {
        await createNotifications(
          [{ id: clientContact.userId }],
          "reservation.status_changed",
          { number: reservation.number, status: "CONFIRMED" },
          `/portal/reservations`,
        );
      }
      remindedIds.push(reservation.id);
    } catch (error) {
      console.error(`Échec du rappel de la réservation ${reservation.id}`, error);
      failedIds.push(reservation.id);
    }
  }

  if (remindedIds.length > 0 || failedIds.length > 0) {
    await logAudit({
      category: "BUSINESS",
      action: "reservation.remind_cron",
      actorLabel: "cron",
      changes: { remindedIds, failedIds },
    });
  }

  return { remindedCount: remindedIds.length, remindedIds, failedIds };
}
