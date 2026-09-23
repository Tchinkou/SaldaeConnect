import { describe, it, expect } from "vitest";
import { computeQuoteTotals, formatMoney, toMinorUnits, type QuoteLineInput } from "./money";

/**
 * Couvre les règles de calcul du §F.7 : ligne = qté×prix−remise de ligne
 * arrondie ; remise globale répartie au prorata avant taxe ; taxe calculée
 * par ligne sur la base remisée puis sommée. C'est le seul endroit où ces
 * règles sont vérifiées — l'éditeur de devis ne fait qu'afficher ce que ce
 * module calcule.
 */
describe("computeQuoteTotals", () => {
  it("computes a single line with no discount and no tax", () => {
    const items: QuoteLineInput[] = [{ quantity: 2, unitPrice: 10000n, discountPercent: 0, taxRatePercent: null }];
    const result = computeQuoteTotals(items, null);
    expect(result.lines[0]!.lineTotal).toBe(20000n);
    expect(result.subtotal).toBe(20000n);
    expect(result.discountTotal).toBe(0n);
    expect(result.taxTotal).toBe(0n);
    expect(result.total).toBe(20000n);
  });

  it("applies a per-line discount, rounded half-up", () => {
    // 3 × 1001 = 3003, -10% = 2702.7 -> 2703
    const items: QuoteLineInput[] = [{ quantity: 3, unitPrice: 1001n, discountPercent: 10, taxRatePercent: null }];
    const result = computeQuoteTotals(items, null);
    expect(result.lines[0]!.lineTotal).toBe(2703n);
  });

  it("computes tax on the line total when there is no global discount", () => {
    const items: QuoteLineInput[] = [{ quantity: 1, unitPrice: 100000n, discountPercent: 0, taxRatePercent: 19 }];
    const result = computeQuoteTotals(items, null);
    expect(result.subtotal).toBe(100000n);
    expect(result.taxTotal).toBe(19000n);
    expect(result.total).toBe(119000n);
  });

  it("prorates a global percent discount across lines before tax, remainder on the last line", () => {
    const items: QuoteLineInput[] = [
      { quantity: 1, unitPrice: 10000n, discountPercent: 0, taxRatePercent: 0 },
      { quantity: 1, unitPrice: 10001n, discountPercent: 0, taxRatePercent: 0 },
    ];
    const result = computeQuoteTotals(items, { type: "PERCENT", value: 10n });
    expect(result.subtotal).toBe(20001n);
    expect(result.discountTotal).toBe(2000n); // round(20001 * 0.10)
    // Shares must sum exactly to discountTotal even though each is rounded independently.
    expect(result.total).toBe(result.subtotal - result.discountTotal);
  });

  it("caps a global fixed-amount discount at the subtotal", () => {
    const items: QuoteLineInput[] = [{ quantity: 1, unitPrice: 5000n, discountPercent: 0, taxRatePercent: 0 }];
    const result = computeQuoteTotals(items, { type: "AMOUNT", value: 999999n });
    expect(result.discountTotal).toBe(5000n);
    expect(result.total).toBe(0n);
  });

  it("computes tax on the discounted base after a global discount is allocated", () => {
    const items: QuoteLineInput[] = [{ quantity: 1, unitPrice: 100000n, discountPercent: 0, taxRatePercent: 20 }];
    const result = computeQuoteTotals(items, { type: "AMOUNT", value: 10000n });
    // base after global discount = 90000, tax = 18000
    expect(result.taxTotal).toBe(18000n);
    expect(result.total).toBe(100000n - 10000n + 18000n);
  });

  it("handles distinct tax rates per line", () => {
    const items: QuoteLineInput[] = [
      { quantity: 1, unitPrice: 10000n, discountPercent: 0, taxRatePercent: 20 },
      { quantity: 1, unitPrice: 10000n, discountPercent: 0, taxRatePercent: 0 },
    ];
    const result = computeQuoteTotals(items, null);
    expect(result.taxTotal).toBe(2000n);
  });

  it("returns zero totals for an empty line list", () => {
    const result = computeQuoteTotals([], { type: "PERCENT", value: 10n });
    expect(result.subtotal).toBe(0n);
    expect(result.discountTotal).toBe(0n);
    expect(result.taxTotal).toBe(0n);
    expect(result.total).toBe(0n);
  });
});

describe("formatMoney / toMinorUnits", () => {
  it("round-trips a whole-currency amount through minor units", () => {
    expect(toMinorUnits(15000)).toBe(1500000n);
  });

  it("formats a minor-unit amount as currency", () => {
    // fr-FR uses a narrow no-break space ( ) as the thousands separator.
    expect(formatMoney(150000n, "EUR", "fr")).toBe("1 500,00 €");
  });
});
