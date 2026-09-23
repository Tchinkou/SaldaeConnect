import "server-only";
import { headers } from "next/headers";
import type { z } from "zod";
import type { AuditCategory } from "@/generated/prisma/client";
import { rateLimit } from "@/server/core/rate-limit";
import { logAudit } from "@/server/core/audit";
import { AppError, ValidationError } from "@/server/core/errors";
import type { ActionResult } from "@/server/core/action";

/**
 * Enveloppeur des server actions **publiques**, non authentifiées
 * (formulaire de demande, formulaire de contact — §D.2, §H.2) : limitation
 * de débit → validation Zod → exécution → journal d'audit. Même contrat que
 * `defineAction` (jamais d'exception vers le client), sans l'étape
 * d'autorisation puisqu'il n'y a pas de session.
 */
export function definePublicAction<Schema extends z.ZodType, Output>(config: {
  schema: Schema;
  rateLimits: (input: z.infer<Schema>, ctx: { ip: string | null }) => Array<{
    key: string;
    windowSeconds: number;
    max: number;
  }>;
  audit: {
    category: AuditCategory;
    action: string;
    entityType?: string;
    entityId?: (output: Output) => string | undefined;
    entityLabel?: (output: Output) => string | undefined;
  };
  handler: (input: z.infer<Schema>, ctx: { ip: string | null; userAgent: string | null }) => Promise<Output>;
}) {
  // `z.input<Schema>` (forme avant analyse), pas `z.infer` (forme après) : un
  // champ `.optional().default(...)` doit rester facultatif pour l'appelant.
  return async (rawInput: z.input<Schema>): Promise<ActionResult<Output>> => {
    const requestHeaders = await headers();
    const ip = requestHeaders.get("x-forwarded-for");
    const userAgent = requestHeaders.get("user-agent");

    try {
      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? "Données invalides.");
      }

      for (const limit of config.rateLimits(parsed.data, { ip })) {
        await rateLimit(limit.key, limit);
      }

      const output = await config.handler(parsed.data, { ip, userAgent });

      await logAudit({
        category: config.audit.category,
        action: config.audit.action,
        actorLabel: "Visiteur",
        entityType: config.audit.entityType,
        entityId: config.audit.entityId?.(output),
        entityLabel: config.audit.entityLabel?.(output),
        ip,
        userAgent,
      });

      return { ok: true, data: output };
    } catch (error) {
      if (error instanceof AppError) {
        return { ok: false, error: error.message };
      }
      console.error("Erreur inattendue dans une action publique", error);
      return { ok: false, error: "Une erreur inattendue est survenue." };
    }
  };
}
