import "server-only";
import { prisma } from "@/server/core/db/client";
import { recordActivity } from "@/server/core/crm/timeline";
import { createNotifications, resolveStaffRecipients } from "@/server/core/notify-admins";
import { logAudit } from "@/server/core/audit";

/**
 * Passe en `EXPIRED` les devis `SENT`/`VIEWED` dont la date de validité est
 * dépassée (§J — « le cron passe en Expiré les devis dont la date de
 * validité est dépassée ; un admin peut prolonger en envoyant une nouvelle
 * version »). Un devis par transaction, avec re-vérification du statut au
 * moment de l'écriture (`updateMany` filtré), pour rester idempotent si le
 * job est déclenché deux fois en parallèle ou relancé après un échec
 * partiel — un devis déjà traité entre-temps est simplement ignoré plutôt
 * que de provoquer une double activité/notification.
 */
export async function runQuotesExpireJob(): Promise<{
  expiredCount: number;
  expiredQuoteIds: string[];
  failedQuoteIds: string[];
}> {
  const now = new Date();
  const candidates = await prisma.quote.findMany({
    where: { status: { in: ["SENT", "VIEWED"] }, validUntil: { lt: now } },
    include: { client: true },
  });

  const expiredIds: string[] = [];
  const failedIds: string[] = [];

  for (const quote of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.quote.updateMany({
          where: { id: quote.id, status: { in: ["SENT", "VIEWED"] } },
          data: { status: "EXPIRED" },
        });
        if (updated.count === 0) return;

        await recordActivity(tx, {
          type: "SYSTEM",
          subject: "Devis expiré",
          body: quote.validUntil
            ? `Date de validité dépassée (${quote.validUntil.toISOString().slice(0, 10)}).`
            : undefined,
          clientId: quote.clientId,
          opportunityId: quote.opportunityId ?? undefined,
          quoteId: quote.id,
        });

        const recipients = await resolveStaffRecipients(tx, quote.client.ownerId);
        await createNotifications(
          recipients,
          "quote.expired",
          { quoteId: quote.id, quoteNumber: quote.number, clientName: quote.client.displayName },
          `/admin/quotes/${quote.id}`,
        );
      });
      expiredIds.push(quote.id);
    } catch (error) {
      console.error(`Échec de l'expiration du devis ${quote.id}`, error);
      failedIds.push(quote.id);
    }
  }

  if (expiredIds.length > 0 || failedIds.length > 0) {
    await logAudit({
      category: "BUSINESS",
      action: "quote.expire_cron",
      actorLabel: "cron",
      changes: { expiredQuoteIds: expiredIds, failedQuoteIds: failedIds },
    });
  }

  return { expiredCount: expiredIds.length, expiredQuoteIds: expiredIds, failedQuoteIds: failedIds };
}
