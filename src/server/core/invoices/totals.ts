import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ValidationError } from "@/server/core/errors";
import { computeQuoteTotals } from "@/server/core/money";

/**
 * Recalcule et persiste les totaux d'une facture (lignes + en-tête, §F.7).
 * Pas de remise globale sur `Invoice` (contrairement à `Quote`) — seulement
 * une remise par ligne — d'où `globalDiscount: null` systématique.
 */
export async function recomputeInvoiceTotals(tx: Prisma.TransactionClient, invoiceId: string): Promise<void> {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: { orderBy: { position: "asc" } } },
  });

  const result = computeQuoteTotals(
    invoice.items.map((item) => ({
      quantity: Number(item.quantity),
      unitPrice: item.unitPrice,
      discountPercent: Number(item.discountPercent),
      taxRatePercent: item.taxRatePercent != null ? Number(item.taxRatePercent) : null,
    })),
    null,
  );

  await Promise.all(
    invoice.items.map((item, index) =>
      tx.invoiceItem.update({ where: { id: item.id }, data: { lineTotal: result.lines[index]!.lineTotal } }),
    ),
  );

  const balanceDue = result.total - invoice.amountPaid;
  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal: result.subtotal,
      discountTotal: result.discountTotal,
      taxTotal: result.taxTotal,
      total: result.total,
      balanceDue,
    },
  });
}

/** Une facture n'est modifiable (lignes, en-tête) que tant qu'elle est en brouillon (§F.5). */
export function assertInvoiceIsDraft(status: string): void {
  if (status !== "DRAFT") {
    throw new ValidationError("Cette facture n'est plus modifiable (déjà émise).");
  }
}
