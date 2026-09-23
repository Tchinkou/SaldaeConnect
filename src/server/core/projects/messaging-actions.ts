"use server";
import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { defineAction } from "@/server/core/action";
import { definePortalAction } from "@/server/core/portal-action";
import { prisma } from "@/server/core/db/client";
import { ValidationError } from "@/server/core/errors";
import { assertProjectManagerInScope } from "@/server/core/authz/ownership";
import { resolveOwnerNames } from "@/server/core/crm/owners";
import { createNotifications, resolveStaffRecipients } from "@/server/core/notify-admins";
import {
  receiveAndValidateUploads,
  promoteUploads,
  discardUploads,
  PROJECT_UPLOAD_MAX_FILES,
  PROJECT_UPLOAD_MAX_BYTES,
  PROJECT_ADMIN_ALLOWED_TYPES,
  PROJECT_CLIENT_ALLOWED_TYPES,
} from "@/server/core/storage";

/**
 * Messagerie de projet (§F.4, §D.4) : une conversation `PROJECT` par projet,
 * créée à la volée au premier message plutôt qu'à la création du projet
 * (aucune UI ne l'utilise avant qu'un message n'existe). Les notes internes
 * (`isInternalNote`) ne sont jamais visibles du client — ni le message, ni
 * ses pièces jointes (`visibility` suit `isInternalNote`).
 */
async function getOrCreateProjectConversation(tx: Prisma.TransactionClient, projectId: string, clientId: string) {
  const existing = await tx.conversation.findFirst({ where: { projectId, type: "PROJECT" } });
  if (existing) return existing;
  return tx.conversation.create({ data: { type: "PROJECT", projectId, clientId } });
}

async function loadProjectScope(projectId: string) {
  return prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { clientId: true, managerId: true, client: { select: { ownerId: true } } },
  });
}

const listProjectMessagesSchema = z.object({ projectId: z.string().min(1) });

export const listProjectMessagesAction = defineAction({
  permission: "message.read",
  schema: listProjectMessagesSchema,
  handler: async (input, { user }) => {
    const project = await loadProjectScope(input.projectId);
    assertProjectManagerInScope(user, "message.read", project.managerId ?? project.client.ownerId);

    const conversation = await prisma.conversation.findFirst({ where: { projectId: input.projectId, type: "PROJECT" } });
    if (!conversation) return [];

    const contacts = await prisma.clientContact.findMany({
      where: { clientId: project.clientId, userId: { not: null } },
      select: { userId: true },
    });
    const clientUserIds = new Set(contacts.map((c) => c.userId));

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { files: true },
    });
    const nameById = await resolveOwnerNames(messages.map((m) => m.authorId));

    return messages.map((m) => ({
      id: m.id,
      body: m.body,
      isInternalNote: m.isInternalNote,
      createdAt: m.createdAt.toISOString(),
      authorName: m.authorId ? (nameById.get(m.authorId) ?? null) : null,
      fromClient: m.authorId ? clientUserIds.has(m.authorId) : false,
      files: m.files.map((f) => ({ id: f.id, originalName: f.originalName, sizeBytes: f.sizeBytes.toString() })),
    }));
  },
});

const sendProjectMessageSchema = z.object({
  projectId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  isInternalNote: z.boolean().default(false),
  files: z.array(z.instanceof(File)).max(PROJECT_UPLOAD_MAX_FILES).default([]),
});

export const sendProjectMessageAction = defineAction({
  permission: "message.write",
  schema: sendProjectMessageSchema,
  handler: async (input, { user }) => {
    const project = await loadProjectScope(input.projectId);
    assertProjectManagerInScope(user, "message.write", project.managerId ?? project.client.ownerId);

    const uploads =
      input.files.length > 0
        ? await receiveAndValidateUploads(input.files, {
            maxFiles: PROJECT_UPLOAD_MAX_FILES,
            maxBytesPerFile: PROJECT_UPLOAD_MAX_BYTES,
            allowedTypes: PROJECT_ADMIN_ALLOWED_TYPES,
          })
        : [];
    const visibility = input.isInternalNote ? "INTERNAL" : "CLIENT";

    let messageId: string;
    try {
      messageId = await prisma.$transaction(async (tx) => {
        const conversation = await getOrCreateProjectConversation(tx, input.projectId, project.clientId);
        await tx.conversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: conversation.id, userId: user.user.id } },
          create: { conversationId: conversation.id, userId: user.user.id, lastReadAt: new Date() },
          update: { lastReadAt: new Date() },
        });
        const message = await tx.message.create({
          data: { conversationId: conversation.id, authorId: user.user.id, body: input.body, isInternalNote: input.isInternalNote },
        });
        await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
        if (uploads.length > 0) {
          await tx.file.createMany({
            data: uploads.map((upload) => ({
              storageKey: upload.storageKey,
              originalName: upload.originalName,
              safeName: upload.safeName,
              mimeType: upload.mimeType,
              sizeBytes: upload.sizeBytes,
              sha256: upload.sha256,
              scanStatus: upload.scanStatus,
              category: "ATTACHMENT",
              status: "QUARANTINE",
              visibility,
              uploadedById: user.user.id,
              messageId: message.id,
            })),
          });
        }
        return message.id;
      });
    } catch (error) {
      await discardUploads(uploads.map((upload) => upload.storageKey));
      throw error;
    }

    if (uploads.length > 0) {
      await promoteUploads(uploads.map((upload) => upload.storageKey));
      await prisma.file.updateMany({ where: { storageKey: { in: uploads.map((upload) => upload.storageKey) } }, data: { status: "ACTIVE" } });
    }

    if (!input.isInternalNote) {
      try {
        const contact = await prisma.clientContact.findFirst({
          where: { clientId: project.clientId, userId: { not: null } },
          orderBy: { isPrimary: "desc" },
          select: { userId: true },
        });
        if (contact?.userId) {
          await createNotifications(
            [{ id: contact.userId }],
            "project.message",
            { projectId: input.projectId },
            `/portal/projects/${input.projectId}`,
          );
        }
      } catch (error) {
        console.error("Échec de la notification client après message de projet", error);
      }
    }

    return { id: messageId };
  },
  audit: {
    category: "BUSINESS",
    action: "project.message.send",
    entityType: "Project",
    entityId: (input) => input.projectId,
  },
});

const sendPortalProjectMessageSchema = z.object({
  projectId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  files: z.array(z.instanceof(File)).max(PROJECT_UPLOAD_MAX_FILES).default([]),
});

export const sendPortalProjectMessageAction = definePortalAction({
  schema: sendPortalProjectMessageSchema,
  handler: async (input, { clientId, user }) => {
    const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { clientId: true, managerId: true, client: { select: { ownerId: true } } } });
    if (!project || project.clientId !== clientId) {
      throw new ValidationError("Projet introuvable.");
    }

    const uploads =
      input.files.length > 0
        ? await receiveAndValidateUploads(input.files, {
            maxFiles: PROJECT_UPLOAD_MAX_FILES,
            maxBytesPerFile: PROJECT_UPLOAD_MAX_BYTES,
            allowedTypes: PROJECT_CLIENT_ALLOWED_TYPES,
          })
        : [];

    let messageId: string;
    try {
      messageId = await prisma.$transaction(async (tx) => {
        const conversation = await getOrCreateProjectConversation(tx, input.projectId, clientId);
        await tx.conversationParticipant.upsert({
          where: { conversationId_userId: { conversationId: conversation.id, userId: user.user.id } },
          create: { conversationId: conversation.id, userId: user.user.id, lastReadAt: new Date() },
          update: { lastReadAt: new Date() },
        });
        const message = await tx.message.create({
          data: { conversationId: conversation.id, authorId: user.user.id, body: input.body, isInternalNote: false },
        });
        await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
        if (uploads.length > 0) {
          await tx.file.createMany({
            data: uploads.map((upload) => ({
              storageKey: upload.storageKey,
              originalName: upload.originalName,
              safeName: upload.safeName,
              mimeType: upload.mimeType,
              sizeBytes: upload.sizeBytes,
              sha256: upload.sha256,
              scanStatus: upload.scanStatus,
              category: "ATTACHMENT",
              status: "QUARANTINE",
              visibility: "CLIENT",
              messageId: message.id,
            })),
          });
        }
        return message.id;
      });
    } catch (error) {
      await discardUploads(uploads.map((upload) => upload.storageKey));
      throw error;
    }

    if (uploads.length > 0) {
      await promoteUploads(uploads.map((upload) => upload.storageKey));
      await prisma.file.updateMany({ where: { storageKey: { in: uploads.map((upload) => upload.storageKey) } }, data: { status: "ACTIVE" } });
    }

    try {
      const staff = await resolveStaffRecipients(prisma, project.managerId ?? project.client.ownerId);
      await createNotifications(staff, "project.message", { projectId: input.projectId }, `/admin/projects/${input.projectId}`);
    } catch (error) {
      console.error("Échec de la notification staff après message client", error);
    }

    return { id: messageId };
  },
});
