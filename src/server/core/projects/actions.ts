"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { assertProjectManagerInScope } from "@/server/core/authz/ownership";
import { recordActivity } from "@/server/core/crm/timeline";
import { createNotifications, resolveStaffRecipients } from "@/server/core/notify-admins";
import { advanceOpportunityStage } from "@/server/core/crm/stage";
import { env } from "@/server/core/env";
import { sendProjectStatusChangeEmail } from "@/server/core/email/send-project-status-change-email";
import { ValidationError } from "@/server/core/errors";

const STATUS_LABEL_FR: Record<string, string> = {
  PLANNING: "Planification",
  IN_PROGRESS: "En cours",
  WAITING_CLIENT: "En attente client",
  REVIEW: "Révision",
  COMPLETED: "Terminé",
  ARCHIVED: "Archivé",
};

async function loadProjectForScope(projectId: string) {
  return prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status: true,
      opportunityId: true,
      managerId: true,
      client: {
        select: {
          id: true,
          ownerId: true,
          contacts: {
            where: { userId: { not: null } },
            orderBy: { isPrimary: "desc" },
            take: 1,
            select: { email: true, userId: true },
          },
        },
      },
    },
  });
}

/**
 * Changement de statut d'un projet (§F.4). Pas de machine à états stricte
 * imposée côté serveur — l'admin garde la main (comme pour le pipeline CRM,
 * "passage manuel" toujours autorisé) — mais deux transitions déclenchent
 * un effet automatique documenté par le cahier des charges : le premier
 * passage à `IN_PROGRESS` (« démarrage du projet ») fait avancer
 * l'opportunité à `active_client`, et le passage à `COMPLETED` (« projet
 * terminé ») la fait avancer à `completed`.
 */
const updateProjectStatusSchema = z.object({
  projectId: z.string().min(1),
  status: z.enum(["PLANNING", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW", "COMPLETED", "ARCHIVED"]),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const updateProjectStatusAction = defineAction({
  permission: "project.write",
  schema: updateProjectStatusSchema,
  handler: async (input, { user }) => {
    const project = await loadProjectForScope(input.projectId);
    assertProjectManagerInScope(user, "project.write", project.managerId ?? project.client.ownerId);
    if (project.status === input.status) {
      throw new ValidationError("Le projet a déjà ce statut.");
    }

    const wasFirstStart = project.status === "PLANNING" && input.status === "IN_PROGRESS";

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: project.id },
        data: {
          status: input.status,
          completedAt: input.status === "COMPLETED" ? new Date() : input.status === "ARCHIVED" ? undefined : null,
        },
      });

      await tx.projectStatusChange.create({
        data: {
          projectId: project.id,
          fromStatus: project.status,
          toStatus: input.status,
          changedById: user.user.id,
          note: input.note || null,
        },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Statut du projet modifié",
        body: `${STATUS_LABEL_FR[project.status]} → ${STATUS_LABEL_FR[input.status]}${input.note ? ` — ${input.note}` : ""}`,
        clientId: project.client.id,
        projectId: project.id,
      });

      if (project.opportunityId) {
        if (wasFirstStart) {
          await advanceOpportunityStage(tx, project.opportunityId, "active_client", user.user.id);
        } else if (input.status === "COMPLETED") {
          await advanceOpportunityStage(tx, project.opportunityId, "completed", user.user.id);
        }
      }

      const staffRecipients = await resolveStaffRecipients(tx, project.managerId ?? project.client.ownerId);
      await createNotifications(
        staffRecipients,
        "project.status_changed",
        { projectId: project.id, projectName: project.name, status: input.status },
        `/admin/projects/${project.id}`,
      );

      const portalContact = project.client.contacts[0] ?? null;
      if (portalContact?.userId) {
        await createNotifications(
          [{ id: portalContact.userId }],
          "project.status_changed",
          { projectId: project.id, projectName: project.name, status: input.status },
          `/portal/projects/${project.id}`,
        );
      }

      return { portalContact };
    });

    try {
      if (outcome.portalContact?.email) {
        await sendProjectStatusChangeEmail({
          to: outcome.portalContact.email,
          projectName: project.name,
          statusLabel: STATUS_LABEL_FR[input.status],
          note: input.note,
          ctaUrl: `${env.NEXT_PUBLIC_APP_URL}/fr/portal/projects/${project.id}`,
        });
      }
    } catch (error) {
      console.error("Échec de l'envoi de l'email de changement de statut du projet", error);
    }

    return { id: project.id };
  },
  audit: {
    category: "BUSINESS",
    action: "project.status_change",
    entityType: "Project",
    entityId: (input) => input.projectId,
    changes: (input) => ({ status: input.status }),
  },
});

const addProjectMemberSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["MANAGER", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export const addProjectMemberAction = defineAction({
  permission: "project.write",
  schema: addProjectMemberSchema,
  handler: async (input, { user }) => {
    const project = await loadProjectForScope(input.projectId);
    assertProjectManagerInScope(user, "project.write", project.managerId ?? project.client.ownerId);

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
      update: { role: input.role },
      create: { projectId: input.projectId, userId: input.userId, role: input.role },
    });
    return { ok: true as const };
  },
  audit: { category: "BUSINESS", action: "project.member.add", entityType: "Project", entityId: (input) => input.projectId },
});

const removeProjectMemberSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
});

export const removeProjectMemberAction = defineAction({
  permission: "project.write",
  schema: removeProjectMemberSchema,
  handler: async (input, { user }) => {
    const project = await loadProjectForScope(input.projectId);
    assertProjectManagerInScope(user, "project.write", project.managerId ?? project.client.ownerId);

    await prisma.projectMember.deleteMany({ where: { projectId: input.projectId, userId: input.userId } });
    return { ok: true as const };
  },
  audit: { category: "BUSINESS", action: "project.member.remove", entityType: "Project", entityId: (input) => input.projectId },
});

const addMilestoneSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  dueDate: z.string().trim().min(1).nullable().optional(),
  weight: z.number().int().min(1).max(100).default(1),
});

export const addMilestoneAction = defineAction({
  permission: "project.write",
  schema: addMilestoneSchema,
  handler: async (input, { user }) => {
    const project = await loadProjectForScope(input.projectId);
    assertProjectManagerInScope(user, "project.write", project.managerId ?? project.client.ownerId);

    const count = await prisma.milestone.count({ where: { projectId: input.projectId } });
    const milestone = await prisma.milestone.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        description: input.description || null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        weight: input.weight,
        position: count,
      },
    });
    return { id: milestone.id };
  },
  audit: { category: "BUSINESS", action: "project.milestone.add", entityType: "Milestone", entityId: (_input, output) => output.id },
});

const updateMilestoneStatusSchema = z.object({
  milestoneId: z.string().min(1),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
});

export const updateMilestoneStatusAction = defineAction({
  permission: "project.write",
  schema: updateMilestoneStatusSchema,
  handler: async (input, { user }) => {
    const milestone = await prisma.milestone.findUniqueOrThrow({
      where: { id: input.milestoneId },
      select: { projectId: true },
    });
    const project = await loadProjectForScope(milestone.projectId);
    assertProjectManagerInScope(user, "project.write", project.managerId ?? project.client.ownerId);

    await prisma.milestone.update({
      where: { id: input.milestoneId },
      data: { status: input.status, completedAt: input.status === "DONE" ? new Date() : null },
    });
    return { ok: true as const };
  },
  audit: { category: "BUSINESS", action: "project.milestone.update_status", entityType: "Milestone", entityId: (input) => input.milestoneId },
});

const removeMilestoneSchema = z.object({ milestoneId: z.string().min(1) });

export const removeMilestoneAction = defineAction({
  permission: "project.write",
  schema: removeMilestoneSchema,
  handler: async (input, { user }) => {
    const milestone = await prisma.milestone.findUniqueOrThrow({
      where: { id: input.milestoneId },
      select: { projectId: true },
    });
    const project = await loadProjectForScope(milestone.projectId);
    assertProjectManagerInScope(user, "project.write", project.managerId ?? project.client.ownerId);

    await prisma.milestone.delete({ where: { id: input.milestoneId } });
    return { ok: true as const };
  },
  audit: { category: "BUSINESS", action: "project.milestone.remove", entityType: "Milestone", entityId: (input) => input.milestoneId },
});

const updateProgressModeSchema = z.object({
  projectId: z.string().min(1),
  progressMode: z.enum(["TASKS", "MILESTONES", "MANUAL"]),
  progressManual: z.number().int().min(0).max(100).nullable().optional(),
});

export const updateProjectProgressModeAction = defineAction({
  permission: "project.write",
  schema: updateProgressModeSchema,
  handler: async (input, { user }) => {
    const project = await loadProjectForScope(input.projectId);
    assertProjectManagerInScope(user, "project.write", project.managerId ?? project.client.ownerId);

    await prisma.project.update({
      where: { id: input.projectId },
      data: {
        progressMode: input.progressMode,
        progressManual: input.progressMode === "MANUAL" ? (input.progressManual ?? 0) : null,
      },
    });
    return { ok: true as const };
  },
  audit: { category: "BUSINESS", action: "project.progress_mode.update", entityType: "Project", entityId: (input) => input.projectId },
});
