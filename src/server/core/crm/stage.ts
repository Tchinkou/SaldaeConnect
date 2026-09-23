import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Avance une opportunité vers une étape du pipeline par sa clé système
 * (`quote_sent`, `accepted`, `active_client`, `completed`…), en dehors du
 * drag-and-drop du Kanban (§E.3) : utilisée par l'envoi d'un devis, son
 * acceptation, et le démarrage/l'achèvement d'un projet. « N'avance que si
 * l'étape actuelle est antérieure » (§E.3) se lit sur l'ordre des étapes,
 * pas sur leur type `OPEN`/`WON`/`LOST` — une fois l'opportunité gagnée
 * (`accepted`), elle doit encore pouvoir progresser jusqu'à `active_client`
 * puis `completed`. Ne rétrograde jamais, et ne touche `closedAt` qu'au
 * premier passage hors `OPEN` (la date de clôture réelle ne doit pas être
 * réécrite par une avancée ultérieure au sein des étapes `WON`).
 */
export async function advanceOpportunityStage(
  tx: Prisma.TransactionClient,
  opportunityId: string,
  toStageKey: string,
  changedById: string | null,
): Promise<void> {
  const opportunity = await tx.opportunity.findUnique({ where: { id: opportunityId }, include: { stage: true } });
  if (!opportunity) return;

  const toStage = await tx.pipelineStage.findUnique({ where: { key: toStageKey } });
  if (!toStage || toStage.id === opportunity.stageId) return;
  if (toStage.order <= opportunity.stage.order) return;

  await tx.opportunity.update({
    where: { id: opportunityId },
    data: {
      stageId: toStage.id,
      closedAt: opportunity.stage.kind === "OPEN" && toStage.kind !== "OPEN" ? new Date() : undefined,
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
