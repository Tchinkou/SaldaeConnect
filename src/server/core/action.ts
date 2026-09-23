import "server-only";
import { headers } from "next/headers";
import type { z } from "zod";
import type { AuditCategory } from "@/generated/prisma/client";
import type { PermissionKey } from "@/lib/permissions";
import { getCurrentUser, hasPermission, type CurrentUser } from "@/server/core/authz/session";
import { logAudit } from "@/server/core/audit";
import { AppError, ForbiddenError, UnauthenticatedError, ValidationError } from "@/server/core/errors";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Enveloppeur des server actions admin : authentification → autorisation →
 * validation → exécution → audit (§A.2, §H.2). Aucune action admin ne doit
 * appeler Prisma directement en dehors de ce chemin.
 *
 * Ne relance jamais d'exception vers le composant client (`ActionResult`
 * toujours renvoyé) — sauf bug interne inattendu, journalisé côté serveur
 * et renvoyé sous forme de message générique pour ne rien exposer.
 */
export function defineAction<Schema extends z.ZodType, Output>(config: {
  permission: PermissionKey;
  schema: Schema;
  audit?: {
    category: AuditCategory;
    action: string;
    entityType?: string;
    entityId?: (input: z.infer<Schema>, output: Output) => string | undefined;
    entityLabel?: (input: z.infer<Schema>, output: Output) => string | undefined;
    changes?: (input: z.infer<Schema>, output: Output) => Record<string, unknown> | undefined;
  };
  handler: (input: z.infer<Schema>, ctx: { user: CurrentUser }) => Promise<Output>;
}) {
  return async (rawInput: z.infer<Schema>): Promise<ActionResult<Output>> => {
    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for");
    const userAgent = requestHeaders.get("user-agent");

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new UnauthenticatedError();
      }

      if (!hasPermission(currentUser, config.permission)) {
        await logAudit({
          category: "SECURITY",
          action: "access.denied",
          actorUserId: currentUser.user.id,
          actorLabel: currentUser.user.name,
          actorRoles: currentUser.roles,
          entityType: "permission",
          entityLabel: config.permission,
          ip,
          userAgent,
        });
        throw new ForbiddenError();
      }

      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? "Données invalides.");
      }

      const output = await config.handler(parsed.data, { user: currentUser });

      if (config.audit) {
        await logAudit({
          category: config.audit.category,
          action: config.audit.action,
          actorUserId: currentUser.user.id,
          actorLabel: currentUser.user.name,
          actorRoles: currentUser.roles,
          entityType: config.audit.entityType,
          entityId: config.audit.entityId?.(parsed.data, output),
          entityLabel: config.audit.entityLabel?.(parsed.data, output),
          changes: config.audit.changes?.(parsed.data, output),
          ip,
          userAgent,
        });
      }

      return { ok: true, data: output };
    } catch (error) {
      if (error instanceof AppError) {
        return { ok: false, error: error.message };
      }
      console.error("Erreur inattendue dans une action serveur", error);
      return { ok: false, error: "Une erreur inattendue est survenue." };
    }
  };
}
