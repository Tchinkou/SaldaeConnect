import "server-only";
import { prisma } from "@/server/core/db/client";
import { recordActivity } from "@/server/core/crm/timeline";
import { createNotifications, resolveStaffRecipients } from "@/server/core/notify-admins";
import { logAudit } from "@/server/core/audit";

/**
 * Passe en `OVERDUE` les factures `SENT`/`PARTIALLY_PAID` dont la date
 * d'échéance est dépassée (§F.5). Même schéma que `runQuotesExpireJob` :
 * une facture par transaction, `updateMany` filtré par statut au moment de
 * l'écriture pour rester idempotent si le job tourne deux fois en parallèle.
 */
export async function runInvoicesOverdueJob(): Promise<{
  overdueCount: number;
  overdueInvoiceIds: string[];
  failedInvoiceIds: string[];
}> {
  const now = new Date();
  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
    include: { client: true },
  });

  const overdueIds: string[] = [];
  const failedIds: string[] = [];

  for (const invoice of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.invoice.updateMany({
          where: { id: invoice.id, status: { in: ["SENT", "PARTIALLY_PAID"] } },
          data: { status: "OVERDUE" },
        });
        if (updated.count === 0) return;

        await recordActivity(tx, {
          type: "SYSTEM",
          subject: "Facture en retard",
          body: invoice.dueDate ? `Date d'échéance dépassée (${invoice.dueDate.toISOString().slice(0, 10)}).` : undefined,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
        });

        const recipients = await resolveStaffRecipients(tx, invoice.client.ownerId);
        await createNotifications(recipients, "invoice.overdue", { number: invoice.number ?? "" }, `/admin/invoices/${invoice.id}`);
      });
      overdueIds.push(invoice.id);
    } catch (error) {
      console.error(`Échec du passage en retard de la facture ${invoice.id}`, error);
      failedIds.push(invoice.id);
    }
  }

  if (overdueIds.length > 0 || failedIds.length > 0) {
    await logAudit({
      category: "BUSINESS",
      action: "invoice.overdue_cron",
      actorLabel: "cron",
      changes: { overdueInvoiceIds: overdueIds, failedInvoiceIds: failedIds },
    });
  }

  return { overdueCount: overdueIds.length, overdueInvoiceIds: overdueIds, failedInvoiceIds: failedIds };
}
