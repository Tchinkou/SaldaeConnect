import "server-only";
import type { Prisma, NumberSequenceKey } from "@/generated/prisma/client";

/**
 * Numérotation atomique des documents (§B.4, §F.5, §D.2) : incrémentée dans
 * la même transaction que l'enregistrement qui la porte, jamais après coup —
 * deux demandes simultanées ne peuvent jamais recevoir le même numéro.
 * `tx` doit être le client de la transaction appelante, pas `prisma` direct.
 */
export async function nextNumber(tx: Prisma.TransactionClient, key: NumberSequenceKey): Promise<string> {
  const currentYear = new Date().getFullYear();
  const sequence = await tx.numberSequence.findUniqueOrThrow({ where: { key } });

  const yearReset = sequence.resetPolicy === "YEARLY" && sequence.year !== currentYear;
  const value = yearReset ? 1 : sequence.nextValue;
  const effectiveYear = sequence.resetPolicy === "YEARLY" ? currentYear : (sequence.year ?? currentYear);

  await tx.numberSequence.update({
    where: { key },
    data: { nextValue: value + 1, year: effectiveYear },
  });

  return formatPattern(sequence.pattern, sequence.prefix, effectiveYear, value);
}

function formatPattern(pattern: string, prefix: string, year: number, value: number): string {
  return pattern
    .replaceAll("{PREFIX}", prefix)
    .replaceAll("{YYYY}", String(year))
    .replace(/\{SEQ:(\d+)\}/, (_match, width: string) => String(value).padStart(Number(width), "0"));
}
