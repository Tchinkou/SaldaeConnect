import "server-only";
import { prisma } from "@/server/core/db/client";

/**
 * `ownerId` (Lead/Opportunity/Client/Task) est une FK "libre", sans relation
 * Prisma déclarée (§B.3) — les noms des responsables sont donc résolus à
 * part, jamais via `include`.
 */
export async function resolveOwnerNames(ownerIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  const ids = [...new Set(ownerIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const owners = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return new Map(owners.map((o) => [o.id, o.name]));
}
