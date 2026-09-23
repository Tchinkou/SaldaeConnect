"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { assertOwnerInScope, assertProjectManagerInScope } from "@/server/core/authz/ownership";
import { resolveOwnerNames } from "@/server/core/crm/owners";
import type { CurrentUser } from "@/server/core/authz/session";
import type { PermissionKey } from "@/lib/permissions";

/**
 * Commentaires de tâche (§F.4) : scopés par `taskId`, avec la même règle que
 * `visibleToClient` sur Task — n'a de sens que pour une tâche de projet,
 * ignoré pour les tâches CRM (jamais montrées au client).
 */
async function assertTaskInScope(user: CurrentUser, permission: PermissionKey, taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: {
      assigneeId: true,
      opportunity: { select: { ownerId: true } },
      client: { select: { ownerId: true } },
      project: { select: { managerId: true, client: { select: { ownerId: true } } } },
    },
  });
  if (task.project) {
    assertProjectManagerInScope(user, permission, task.project.managerId ?? task.project.client.ownerId);
  } else {
    assertOwnerInScope(user, permission, task.opportunity?.ownerId ?? task.client?.ownerId ?? task.assigneeId ?? null);
  }
  return task;
}

const listCommentsSchema = z.object({ taskId: z.string().min(1) });

export const listCommentsAction = defineAction({
  permission: "task.read",
  schema: listCommentsSchema,
  handler: async (input, { user }) => {
    await assertTaskInScope(user, "task.read", input.taskId);
    const comments = await prisma.comment.findMany({
      where: { taskId: input.taskId },
      orderBy: { createdAt: "asc" },
    });
    const nameById = await resolveOwnerNames(comments.map((c) => c.authorId));
    return comments.map((c) => ({
      id: c.id,
      body: c.body,
      visibleToClient: c.visibleToClient,
      createdAt: c.createdAt.toISOString(),
      authorName: c.authorId ? (nameById.get(c.authorId) ?? null) : null,
    }));
  },
});

const addCommentSchema = z.object({
  taskId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
  visibleToClient: z.boolean().default(false),
});

export const addCommentAction = defineAction({
  permission: "task.write",
  schema: addCommentSchema,
  handler: async (input, { user }) => {
    const task = await assertTaskInScope(user, "task.write", input.taskId);
    const comment = await prisma.comment.create({
      data: {
        taskId: input.taskId,
        authorId: user.user.id,
        body: input.body,
        visibleToClient: task.project ? input.visibleToClient : false,
      },
    });
    return { id: comment.id };
  },
  audit: {
    category: "BUSINESS",
    action: "task.comment",
    entityType: "Comment",
    entityId: (_input, output) => output.id,
  },
});
