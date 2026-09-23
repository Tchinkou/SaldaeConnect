import "server-only";
import { headers } from "next/headers";
import type { z } from "zod";
import type { AuditCategory } from "@/generated/prisma/client";
import { getCurrentUser, type CurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { logAudit } from "@/server/core/audit";
import { AppError, ForbiddenError, UnauthenticatedError, ValidationError } from "@/server/core/errors";
import type { ActionResult } from "@/server/core/action";

/**
 * Enveloppeur des server actions du **portail client** (§D.9) : session
 * client authentifiée → contact/client résolu → validation Zod → exécution
 * → audit. Distinct de `defineAction` (staff, permissions par rôle) : un
 * client n'a pas de `PermissionKey`, son seul périmètre possible est « ses
 * propres données », résolu ici une fois pour toutes via `ClientContact`.
 */
export function definePortalAction<Schema extends z.ZodType, Output>(config: {
  schema: Schema;
  audit?: {
    category: AuditCategory;
    action: string;
    entityType?: string;
    entityId?: (input: z.infer<Schema>, output: Output) => string | undefined;
    entityLabel?: (input: z.infer<Schema>, output: Output) => string | undefined;
  };
  handler: (
    input: z.infer<Schema>,
    ctx: { user: CurrentUser; clientId: string; contactId: string; ip: string | null; userAgent: string | null },
  ) => Promise<Output>;
}) {
  return async (rawInput: z.input<Schema>): Promise<ActionResult<Output>> => {
    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for");
    const userAgent = requestHeaders.get("user-agent");

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser || currentUser.user.userType !== "CLIENT" || currentUser.user.status !== "ACTIVE") {
        throw new UnauthenticatedError();
      }

      const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser.user.id } });
      if (!contact) {
        throw new ForbiddenError();
      }

      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? "Données invalides.");
      }

      const output = await config.handler(parsed.data, {
        user: currentUser,
        clientId: contact.clientId,
        contactId: contact.id,
        ip,
        userAgent,
      });

      if (config.audit) {
        await logAudit({
          category: config.audit.category,
          action: config.audit.action,
          actorUserId: currentUser.user.id,
          actorLabel: currentUser.user.name,
          entityType: config.audit.entityType,
          entityId: config.audit.entityId?.(parsed.data, output),
          entityLabel: config.audit.entityLabel?.(parsed.data, output),
          ip,
          userAgent,
        });
      }

      return { ok: true, data: output };
    } catch (error) {
      if (error instanceof AppError) {
        return { ok: false, error: error.message };
      }
      console.error("Erreur inattendue dans une action du portail", error);
      return { ok: false, error: "Une erreur inattendue est survenue." };
    }
  };
}
