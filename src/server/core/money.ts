/**
 * Calcul des montants de devis/facture (§F.7). Pur, sans I/O — testé
 * unitairement et importable aussi bien depuis une Server Action que
 * depuis un composant client pour l'aperçu indicatif des totaux
 * (§F.7 : "le navigateur affiche des totaux indicatifs, mais seuls ceux du
 * serveur sont enregistrés"). N'importe donc PAS "server-only".
 *
 * Convention pour `Quote.globalDiscountValue` (BigInt, pas Decimal) :
 * un pourcentage global est un entier 0-100 (pas de décimale), un montant
 * global est en unité mineure. La méthode d'arrondi (demi supérieur) et le
 * calcul des taxes restent des paramètres à valider avec le comptable (§K).
 */

export type QuoteLineInput = {
  quantity: number;
  unitPrice: bigint;
  discountPercent: number;
  taxRatePercent: number | null;
};

export type QuoteLineResult = {
  /** Net de la remise de ligne, avant remise globale (c'est `QuoteItem.lineTotal`). */
  lineTotal: bigint;
};

export type GlobalDiscount = { type: "PERCENT" | "AMOUNT"; value: bigint } | null;

export type QuoteTotals = {
  lines: QuoteLineResult[];
  subtotal: bigint;
  discountTotal: bigint;
  taxTotal: bigint;
  total: bigint;
};

function roundHalfUp(value: number): bigint {
  return BigInt(Math.round(value));
}

export function computeQuoteTotals(items: QuoteLineInput[], globalDiscount: GlobalDiscount): QuoteTotals {
  const lines: QuoteLineResult[] = items.map((item) => {
    const gross = item.quantity * Number(item.unitPrice);
    const discountAmount = gross * (item.discountPercent / 100);
    return { lineTotal: roundHalfUp(gross - discountAmount) };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0n);

  const discountTotal = computeGlobalDiscount(subtotal, globalDiscount);

  // La remise globale est répartie au prorata sur les lignes avant taxe
  // (§F.7). L'arrondi de chaque part peut ne pas sommer exactement à
  // `discountTotal` : la dernière ligne absorbe la différence pour que la
  // somme des parts reste toujours exacte.
  let allocatedDiscount = 0n;
  let taxTotal = 0n;
  items.forEach((item, index) => {
    const line = lines[index]!;
    const isLast = index === items.length - 1;
    const share = isLast
      ? discountTotal - allocatedDiscount
      : subtotal === 0n
        ? 0n
        : roundHalfUp((Number(line.lineTotal) / Number(subtotal)) * Number(discountTotal));
    allocatedDiscount += share;

    const taxBase = line.lineTotal - share;
    const taxRate = item.taxRatePercent ?? 0;
    taxTotal += roundHalfUp(Number(taxBase) * (taxRate / 100));
  });

  const total = subtotal - discountTotal + taxTotal;

  return { lines, subtotal, discountTotal, taxTotal, total };
}

function computeGlobalDiscount(subtotal: bigint, globalDiscount: GlobalDiscount): bigint {
  if (!globalDiscount) return 0n;
  if (globalDiscount.type === "AMOUNT") {
    return globalDiscount.value > subtotal ? subtotal : globalDiscount.value;
  }
  const amount = (subtotal * globalDiscount.value + 50n) / 100n;
  return amount > subtotal ? subtotal : amount;
}

/** Unité mineure fixe (2 décimales) : correcte pour DZD, EUR, USD. */
export function formatMoney(amountMinor: bigint, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amountMinor) / 100);
}

export function toMinorUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}
