import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ValidationError } from "@/server/core/errors";
import { computeQuoteTotals, type GlobalDiscount } from "@/server/core/money";

/**
 * Recalcule et persiste les totaux d'un devis (lignes + en-tête) après toute
 * modification de ses lignes ou de sa remise globale (§F.7). Appelée dans la
 * même transaction que la modification pour que `Quote.total` ne soit jamais
 * incohérent avec ses lignes, même un court instant.
 */
export async function recomputeQuoteTotals(tx: Prisma.TransactionClient, quoteId: string): Promise<void> {
  const quote = await tx.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { items: { orderBy: { position: "asc" } } },
  });

  const globalDiscount: GlobalDiscount =
    quote.globalDiscountType && quote.globalDiscountValue != null
      ? { type: quote.globalDiscountType as "PERCENT" | "AMOUNT", value: quote.globalDiscountValue }
      : null;

  const result = computeQuoteTotals(
    quote.items.map((item) => ({
      quantity: Number(item.quantity),
      unitPrice: item.unitPrice,
      discountPercent: Number(item.discountPercent),
      taxRatePercent: item.taxRatePercent != null ? Number(item.taxRatePercent) : null,
    })),
    globalDiscount,
  );

  await Promise.all(
    quote.items.map((item, index) =>
      tx.quoteItem.update({ where: { id: item.id }, data: { lineTotal: result.lines[index]!.lineTotal } }),
    ),
  );

  await tx.quote.update({
    where: { id: quoteId },
    data: {
      subtotal: result.subtotal,
      discountTotal: result.discountTotal,
      taxTotal: result.taxTotal,
      total: result.total,
    },
  });
}

/** Un devis n'est modifiable que tant qu'il est en brouillon (§F.1) — l'envoi le verrouille derrière une nouvelle version. */
export function assertQuoteIsDraft(status: string): void {
  if (status !== "DRAFT") {
    throw new ValidationError("Ce devis n'est plus modifiable (déjà envoyé).");
  }
}
