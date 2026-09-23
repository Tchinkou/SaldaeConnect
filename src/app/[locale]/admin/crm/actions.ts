"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { assertOwnerInScope } from "@/server/core/authz/ownership";
import { ValidationError } from "@/server/core/errors";
import { recordActivity } from "@/server/core/crm/timeline";

/**
 * Déplacement d'une opportunité dans le pipeline (§E.3) : glisser-déposer
 * (manuel), donc toujours autorisé dans les deux sens, contrairement aux
 * automatismes système qui n'avancent jamais une opportunité en arrière.
 * `orderedIdsInTargetStage` est l'ordre final de la colonne cible tel que
 * dnd-kit l'a calculé côté client ; les positions de la colonne source ne
 * sont pas réécrites (leur ordre relatif reste correct malgré le trou).
 */
const moveSchema = z.object({
  opportunityId: z.string().min(1),
  toStageId: z.string().min(1),
  orderedIdsInTargetStage: z.array(z.string()).min(1),
  lostReasonId: z.string().nullable().optional(),
});

export const moveOpportunityAction = defineAction({
  permission: "opportunity.write",
  schema: moveSchema,
  handler: async (input, { user }) => {
    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { id: input.opportunityId },
      include: { stage: { include: { translations: { where: { locale: "fr" } } } } },
    });
    assertOwnerInScope(user, "opportunity.write", opportunity.ownerId);

    const toStage = await prisma.pipelineStage.findUniqueOrThrow({
      where: { id: input.toStageId },
      include: { translations: { where: { locale: "fr" } } },
    });

    if (toStage.kind === "LOST" && !input.lostReasonId) {
      throw new ValidationError("Un motif de perte est requis pour marquer une opportunité comme perdue.");
    }

    const stageChanged = opportunity.stageId !== input.toStageId;

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        input.orderedIdsInTargetStage.map((id, index) =>
          tx.opportunity.update({
            where: { id },
            data: {
              stageId: input.toStageId,
              position: index,
              ...(id === input.opportunityId
                ? {
                    lostReasonId: toStage.kind === "LOST" ? input.lostReasonId : null,
                    closedAt: toStage.kind !== "OPEN" ? new Date() : null,
                  }
                : {}),
            },
          }),
        ),
      );

      if (stageChanged) {
        await tx.opportunityStageChange.create({
          data: {
            opportunityId: opportunity.id,
            fromStageId: opportunity.stageId,
            toStageId: input.toStageId,
            changedById: user.user.id,
          },
        });

        await recordActivity(tx, {
          type: "STAGE_CHANGE",
          subject: `Étape changée : ${opportunity.stage.translations[0]?.name ?? opportunity.stage.key} → ${toStage.translations[0]?.name ?? toStage.key}`,
          actorId: user.user.id,
          leadId: opportunity.leadId ?? undefined,
          clientId: opportunity.clientId ?? undefined,
          opportunityId: opportunity.id,
        });
      }
    });

    return { id: opportunity.id };
  },
  audit: {
    category: "BUSINESS",
    action: "opportunity.stage_change",
    entityType: "Opportunity",
    entityId: (input) => input.opportunityId,
    changes: (input) => ({ toStageId: input.toStageId }),
  },
});
