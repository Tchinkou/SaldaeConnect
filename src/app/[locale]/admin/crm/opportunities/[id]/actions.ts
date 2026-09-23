"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { assertOwnerInScope } from "@/server/core/authz/ownership";
import { recordActivity } from "@/server/core/crm/timeline";

const addActivitySchema = z.object({
  opportunityId: z.string().min(1),
  type: z.enum(["NOTE", "CALL", "EMAIL", "MEETING", "WHATSAPP"]),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(1).max(5000),
});

export const addOpportunityActivityAction = defineAction({
  permission: "opportunity.write",
  schema: addActivitySchema,
  handler: async (input, { user }) => {
    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { id: input.opportunityId },
      select: { ownerId: true, leadId: true, clientId: true },
    });
    assertOwnerInScope(user, "opportunity.write", opportunity.ownerId);

    const activity = await recordActivity(prisma, {
      type: input.type,
      subject: input.subject || undefined,
      body: input.body,
      actorId: user.user.id,
      leadId: opportunity.leadId ?? undefined,
      clientId: opportunity.clientId ?? undefined,
      opportunityId: input.opportunityId,
    });
    return { id: activity.id };
  },
  audit: {
    category: "BUSINESS",
    action: "opportunity.activity.add",
    entityType: "Opportunity",
    entityId: (input) => input.opportunityId,
  },
});

const reassignSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().nullable(),
});

export const reassignOpportunityOwnerAction = defineAction({
  permission: "opportunity.write",
  schema: reassignSchema,
  handler: async (input, { user }) => {
    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { id: input.id },
      select: { ownerId: true },
    });
    assertOwnerInScope(user, "opportunity.write", opportunity.ownerId);

    await prisma.opportunity.update({ where: { id: input.id }, data: { ownerId: input.ownerId } });
    return { id: input.id };
  },
  audit: {
    category: "BUSINESS",
    action: "opportunity.reassign",
    entityType: "Opportunity",
    entityId: (input) => input.id,
    changes: (input) => ({ ownerId: input.ownerId }),
  },
});
