import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Recalcule `amountPaid`/`balanceDue` d'une facture à partir de ses
 * paiements RECORDED (les REVERSED ne comptent plus) et dérive son statut
 * (§F.5) : ÉMISE/EN RETARD → PARTIELLEMENT PAYÉE dès qu'un paiement est
 * enregistré et que le solde reste positif, → PAYÉE quand le solde atteint
 * zéro. Une annulation de paiement peut donc faire redescendre une facture
 * de PAYÉE ou PARTIELLEMENT PAYÉE vers ÉMISE. Ne touche jamais DRAFT ou
 * CANCELLED (le solde n'a pas de sens pour ces statuts).
 */
export async function recomputeInvoicePaymentStatus(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return;

  const recorded = await tx.payment.findMany({ where: { invoiceId, status: "RECORDED" } });
  const amountPaid = recorded.reduce((sum, payment) => sum + payment.amount, 0n);
  const balanceDue = invoice.total - amountPaid;

  let status: "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";
  if (balanceDue <= 0n) {
    status = "PAID";
  } else if (amountPaid > 0n) {
    status = "PARTIALLY_PAID";
  } else {
    status = invoice.status === "OVERDUE" ? "OVERDUE" : "SENT";
  }

  await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid, balanceDue, status } });
}
