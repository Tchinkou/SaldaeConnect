"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { ValidationError } from "@/server/core/errors";
import { pickDefaultOwner } from "@/server/core/crm/attribution";
import { nextNumber } from "@/server/core/numbering";
import { recordActivity } from "@/server/core/crm/timeline";

/**
 * Saisie manuelle rapide (§E.2) : WhatsApp, téléphone, visite, réseaux
 * sociaux, recommandation — le staff renseigne la source lui-même. Le même
 * dédoublonnage par email/téléphone que les formulaires publics s'applique.
 * Un service optionnel crée directement une opportunité liée.
 */
const createLeadSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email().max(255).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  companyName: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  sourceId: z.string().min(1),
  note: z.string().trim().max(2000).nullable().optional(),
  serviceId: z.string().nullable().optional(),
});

export const createLeadAction = defineAction({
  permission: "lead.write",
  schema: createLeadSchema,
  handler: async (input, { user }) => {
    if (!input.email && !input.phone) {
      throw new ValidationError("Un email ou un téléphone est requis.");
    }

    return prisma.$transaction(async (tx) => {
      const dedupWhere = input.email && input.phone
        ? { OR: [{ email: input.email }, { phone: input.phone }] }
        : input.email
          ? { email: input.email }
          : { phone: input.phone! };

      const [existingClient, existingLead] = await Promise.all([
        tx.client.findFirst({ where: dedupWhere }),
        tx.lead.findFirst({ where: dedupWhere }),
      ]);

      if (existingClient || existingLead) {
        throw new ValidationError(
          existingClient
            ? "Un client existe déjà avec cet email ou ce téléphone."
            : "Un lead existe déjà avec cet email ou ce téléphone.",
        );
      }

      const lead = await tx.lead.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email || null,
          phone: input.phone || null,
          companyName: input.companyName || null,
          country: input.country || null,
          city: input.city || null,
          sourceId: input.sourceId,
          ownerId: await pickDefaultOwner(tx),
        },
      });

      if (input.note) {
        await recordActivity(tx, { type: "NOTE", body: input.note, actorId: user.user.id, leadId: lead.id });
      }

      let opportunityId: string | null = null;
      if (input.serviceId) {
        const service = await tx.service.findUniqueOrThrow({
          where: { id: input.serviceId },
          include: { translations: { where: { locale: lead.locale } } },
        });
        const stage = await tx.pipelineStage.findUniqueOrThrow({ where: { key: "new_lead" } });
        const requestNumber = await nextNumber(tx, "REQUEST");
        const opportunity = await tx.opportunity.create({
          data: {
            number: requestNumber,
            title: `${service.translations[0]?.name ?? service.id} — ${input.firstName} ${input.lastName}`,
            leadId: lead.id,
            serviceId: service.id,
            stageId: stage.id,
            ownerId: lead.ownerId,
            sourceId: input.sourceId,
          },
        });
        opportunityId = opportunity.id;
        await recordActivity(tx, {
          type: "SYSTEM",
          subject: "Opportunité créée manuellement",
          actorId: user.user.id,
          leadId: lead.id,
          opportunityId: opportunity.id,
        });
      }

      return { leadId: lead.id, opportunityId };
    });
  },
  audit: {
    category: "BUSINESS",
    action: "lead.create_manual",
    entityType: "Lead",
    entityId: (_input, output) => output.leadId,
    entityLabel: (input) => `${input.firstName} ${input.lastName}`,
  },
});
