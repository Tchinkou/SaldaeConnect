import "server-only";
import type { ActivityType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/core/db/client";

/**
 * Chronologie unifiée (§E.4) : une même fonction pour créer une activité,
 * quel que soit l'écran d'où elle vient (fiche lead, fiche client, fiche
 * opportunité) — seule la permission requise diffère selon l'entité
 * rattachée, vérifiée par l'action appelante avant d'appeler cette fonction.
 */
export async function recordActivity(
  client: Prisma.TransactionClient | typeof prisma,
  params: {
    type: ActivityType;
    subject?: string;
    body?: string;
    actorId?: string;
    leadId?: string;
    clientId?: string;
    opportunityId?: string;
    projectId?: string;
    quoteId?: string;
  },
): Promise<{ id: string }> {
  return client.activity.create({
    data: {
      type: params.type,
      subject: params.subject,
      body: params.body,
      actorId: params.actorId,
      leadId: params.leadId,
      clientId: params.clientId,
      opportunityId: params.opportunityId,
      projectId: params.projectId,
      quoteId: params.quoteId,
    },
    select: { id: true },
  });
}
