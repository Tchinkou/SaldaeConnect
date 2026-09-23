import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Le staff à prévenir d'un événement sur un devis (vue, décision — §F.3, §I.7) : le propriétaire du client, sinon tous les admins actifs (repli). */
export async function resolveQuoteRecipients(tx: Prisma.TransactionClient, clientOwnerId: string | null) {
  if (clientOwnerId) {
    const owner = await tx.user.findUnique({
      where: { id: clientOwnerId },
      select: { id: true, email: true, locale: true, name: true },
    });
    if (owner) return [owner];
  }
  return tx.user.findMany({
    where: { status: "ACTIVE", userType: "STAFF", roles: { some: { role: { key: "admin" } } } },
    select: { id: true, email: true, locale: true, name: true },
  });
}
