import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Avance une opportunité vers une étape du pipeline par sa clé système
 * (`quote_sent`, `accepted`…), en dehors du drag-and-drop du Kanban (§E.3) :
 * utilisée par l'envoi d'un devis et par son acceptation. N'avance que
 * depuis une étape encore ouverte (`OPEN`) — ne rétrograde jamais une
 * opportunité déjà gagnée ou perdue par ailleurs.
 */
export async function advanceOpportunityStage(
  tx: Prisma.TransactionClient,
  opportunityId: string,
  toStageKey: string,
  changedById: string | null,
): Promise<void> {
  const opportunity = await tx.opportunity.findUnique({ where: { id: opportunityId }, include: { stage: true } });
  if (!opportunity || opportunity.stage.kind !== "OPEN") return;

  const toStage = await tx.pipelineStage.findUnique({ where: { key: toStageKey } });
  if (!toStage || toStage.id === opportunity.stageId) return;

  await tx.opportunity.update({
    where: { id: opportunityId },
    data: {
      stageId: toStage.id,
      closedAt: toStage.kind !== "OPEN" ? new Date() : null,
    },
  });

  await tx.opportunityStageChange.create({
    data: {
      opportunityId,
      fromStageId: opportunity.stageId,
      toStageId: toStage.id,
      changedById,
    },
  });
}
