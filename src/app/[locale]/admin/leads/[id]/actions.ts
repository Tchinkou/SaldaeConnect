"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { assertOwnerInScope } from "@/server/core/authz/ownership";
import { recordActivity } from "@/server/core/crm/timeline";

const addActivitySchema = z.object({
  leadId: z.string().min(1),
  type: z.enum(["NOTE", "CALL", "EMAIL", "MEETING", "WHATSAPP"]),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(1).max(5000),
});

export const addLeadActivityAction = defineAction({
  permission: "lead.write",
  schema: addActivitySchema,
  handler: async (input, { user }) => {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: input.leadId }, select: { ownerId: true } });
    assertOwnerInScope(user, "lead.write", lead.ownerId);

    const activity = await recordActivity(prisma, {
      type: input.type,
      subject: input.subject || undefined,
      body: input.body,
      actorId: user.user.id,
      leadId: input.leadId,
    });
    return { id: activity.id };
  },
  audit: {
    category: "BUSINESS",
    action: "lead.activity.add",
    entityType: "Lead",
    entityId: (input) => input.leadId,
  },
});

const reassignSchema = z.object({ id: z.string().min(1), ownerId: z.string().nullable() });

export const reassignLeadOwnerAction = defineAction({
  permission: "lead.write",
  schema: reassignSchema,
  handler: async (input, { user }) => {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: input.id }, select: { ownerId: true } });
    assertOwnerInScope(user, "lead.write", lead.ownerId);
    await prisma.lead.update({ where: { id: input.id }, data: { ownerId: input.ownerId } });
    return { id: input.id };
  },
  audit: {
    category: "BUSINESS",
    action: "lead.reassign",
    entityType: "Lead",
    entityId: (input) => input.id,
    changes: (input) => ({ ownerId: input.ownerId }),
  },
});

const disqualifySchema = z.object({ id: z.string().min(1), reason: z.string().trim().min(1).max(500) });

export const disqualifyLeadAction = defineAction({
  permission: "lead.write",
  schema: disqualifySchema,
  handler: async (input, { user }) => {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: input.id }, select: { ownerId: true } });
    assertOwnerInScope(user, "lead.write", lead.ownerId);
    await prisma.lead.update({ where: { id: input.id }, data: { status: "DISQUALIFIED" } });
    await recordActivity(prisma, {
      type: "NOTE",
      subject: "Lead disqualifié",
      body: input.reason,
      actorId: user.user.id,
      leadId: input.id,
    });
    return { id: input.id };
  },
  audit: {
    category: "BUSINESS",
    action: "lead.disqualify",
    entityType: "Lead",
    entityId: (input) => input.id,
    changes: (input) => ({ reason: input.reason }),
  },
});
