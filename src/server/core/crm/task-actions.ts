"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { assertOwnerInScope, assertProjectManagerInScope } from "@/server/core/authz/ownership";

/**
 * Tâches (§E.4) : une seule permission (`task.write`) quelle que soit
 * l'entité rattachée (`opportunityId`, `clientId` ou `projectId`), donc une
 * seule action suffit pour toutes les fiches qui en affichent. Une tâche de
 * projet peut être `visibleToClient` (§F.4 — le client voit les tâches
 * marquées visibles, jamais les tâches internes) ; ignoré pour les tâches
 * CRM (jamais montrées au client).
 */
const addTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  dueAt: z.string().trim().min(1).nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assigneeId: z.string().nullable().optional(),
  opportunityId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  visibleToClient: z.boolean().default(false),
});

export const addTaskAction = defineAction({
  permission: "task.write",
  schema: addTaskSchema,
  handler: async (input, { user }) => {
    if (input.projectId) {
      const project = await prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { managerId: true, client: { select: { ownerId: true } } },
      });
      assertProjectManagerInScope(user, "task.write", project.managerId ?? project.client.ownerId);
    } else if (input.opportunityId) {
      const opportunity = await prisma.opportunity.findUniqueOrThrow({
        where: { id: input.opportunityId },
        select: { ownerId: true },
      });
      assertOwnerInScope(user, "task.write", opportunity.ownerId);
    } else if (input.clientId) {
      const client = await prisma.client.findUniqueOrThrow({
        where: { id: input.clientId },
        select: { ownerId: true },
      });
      assertOwnerInScope(user, "task.write", client.ownerId);
    } else {
      assertOwnerInScope(user, "task.write", input.assigneeId ?? null);
    }

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description || null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        priority: input.priority,
        assigneeId: input.assigneeId || null,
        createdById: user.user.id,
        opportunityId: input.opportunityId || null,
        clientId: input.clientId || null,
        projectId: input.projectId || null,
        milestoneId: input.milestoneId || null,
        visibleToClient: input.projectId ? input.visibleToClient : false,
      },
    });
    return { id: task.id };
  },
  audit: {
    category: "BUSINESS",
    action: "task.create",
    entityType: "Task",
    entityId: (_input, output) => output.id,
    entityLabel: (input) => input.title,
  },
});

const updateTaskStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
});

export const updateTaskStatusAction = defineAction({
  permission: "task.write",
  schema: updateTaskStatusSchema,
  handler: async (input, { user }) => {
    const existing = await prisma.task.findUniqueOrThrow({
      where: { id: input.id },
      select: {
        assigneeId: true,
        opportunity: { select: { ownerId: true } },
        client: { select: { ownerId: true } },
        project: { select: { managerId: true, client: { select: { ownerId: true } } } },
      },
    });
    if (existing.project) {
      assertProjectManagerInScope(user, "task.write", existing.project.managerId ?? existing.project.client.ownerId);
    } else {
      assertOwnerInScope(
        user,
        "task.write",
        existing.opportunity?.ownerId ?? existing.client?.ownerId ?? existing.assigneeId ?? null,
      );
    }

    const task = await prisma.task.update({
      where: { id: input.id },
      data: { status: input.status, completedAt: input.status === "DONE" ? new Date() : null },
    });
    return { id: task.id };
  },
  audit: {
    category: "BUSINESS",
    action: "task.update_status",
    entityType: "Task",
    entityId: (input) => input.id,
    changes: (input) => ({ status: input.status }),
  },
});
