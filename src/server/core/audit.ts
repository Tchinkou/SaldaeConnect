import "server-only";
import type { AuditCategory, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/core/db/client";

/**
 * Journal d'actions sensibles, en ajout seul (§H.5). Volontairement
 * silencieux à l'échec (`.catch`) : une panne d'écriture d'audit ne doit
 * jamais faire échouer l'action métier elle-même.
 */
export async function logAudit(entry: {
  category: AuditCategory;
  action: string;
  actorUserId?: string | null;
  actorLabel?: string | null;
  actorRoles?: string[];
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  changes?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        category: entry.category,
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        actorLabel: entry.actorLabel ?? null,
        actorRoles: entry.actorRoles ?? [],
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityLabel: entry.entityLabel,
        changes: entry.changes as Prisma.InputJsonValue | undefined,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        requestId: entry.requestId,
      },
    });
  } catch (error) {
    console.error("Échec de l'écriture du journal d'audit", error);
  }
}
