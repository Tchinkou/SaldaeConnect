"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { assertOwnerInScope } from "@/server/core/authz/ownership";
import { recordActivity } from "@/server/core/crm/timeline";

const addActivitySchema = z.object({
  clientId: z.string().min(1),
  type: z.enum(["NOTE", "CALL", "EMAIL", "MEETING", "WHATSAPP"]),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(1).max(5000),
});

export const addClientActivityAction = defineAction({
  permission: "client.write",
  schema: addActivitySchema,
  handler: async (input, { user }) => {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: input.clientId }, select: { ownerId: true } });
    assertOwnerInScope(user, "client.write", client.ownerId);

    const activity = await recordActivity(prisma, {
      type: input.type,
      subject: input.subject || undefined,
      body: input.body,
      actorId: user.user.id,
      clientId: input.clientId,
    });
    return { id: activity.id };
  },
  audit: {
    category: "BUSINESS",
    action: "client.activity.add",
    entityType: "Client",
    entityId: (input) => input.clientId,
  },
});

const reassignSchema = z.object({ id: z.string().min(1), ownerId: z.string().nullable() });

export const reassignClientOwnerAction = defineAction({
  permission: "client.write",
  schema: reassignSchema,
  handler: async (input, { user }) => {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: input.id }, select: { ownerId: true } });
    assertOwnerInScope(user, "client.write", client.ownerId);
    await prisma.client.update({ where: { id: input.id }, data: { ownerId: input.ownerId } });
    return { id: input.id };
  },
  audit: {
    category: "BUSINESS",
    action: "client.reassign",
    entityType: "Client",
    entityId: (input) => input.id,
    changes: (input) => ({ ownerId: input.ownerId }),
  },
});

const updateStatusSchema = z.object({ id: z.string().min(1), status: z.enum(["PROSPECT", "ACTIVE", "INACTIVE"]) });

export const updateClientStatusAction = defineAction({
  permission: "client.write",
  schema: updateStatusSchema,
  handler: async (input, { user }) => {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: input.id }, select: { ownerId: true } });
    assertOwnerInScope(user, "client.write", client.ownerId);
    await prisma.client.update({ where: { id: input.id }, data: { status: input.status } });
    return { id: input.id };
  },
  audit: {
    category: "BUSINESS",
    action: "client.update_status",
    entityType: "Client",
    entityId: (input) => input.id,
    changes: (input) => ({ status: input.status }),
  },
});
