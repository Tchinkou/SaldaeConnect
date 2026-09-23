"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { definePortalAction } from "@/server/core/portal-action";
import { prisma } from "@/server/core/db/client";
import { ValidationError } from "@/server/core/errors";
import { assertProjectManagerInScope } from "@/server/core/authz/ownership";
import {
  receiveAndValidateUploads,
  promoteUploads,
  discardUploads,
  removeStoredFile,
  PROJECT_UPLOAD_MAX_FILES,
  PROJECT_UPLOAD_MAX_BYTES,
  PROJECT_ADMIN_ALLOWED_TYPES,
  PROJECT_CLIENT_ALLOWED_TYPES,
} from "@/server/core/storage";

/**
 * Fichiers de projet (§F.4, §H.4) : « envoi sécurisé complet » — type réel
 * détecté par les octets, taille, antivirus si configuré, quarantaine puis
 * promotion une fois l'enregistrement confirmé en base (même séquence que le
 * formulaire public, §H.4). Deux points d'entrée : admin (toute catégorie,
 * y compris DELIVERABLE, visibilité au choix du staff) et portail client
 * (toujours `visibility: CLIENT`, jamais DELIVERABLE — un client ne livre
 * pas, il dépose une pièce).
 */
const uploadProjectFileSchema = z.object({
  projectId: z.string().min(1),
  files: z.array(z.instanceof(File)).min(1).max(PROJECT_UPLOAD_MAX_FILES),
  category: z.enum(["DOCUMENT", "DELIVERABLE", "MEDIA", "ATTACHMENT"]).default("DOCUMENT"),
  visibility: z.enum(["INTERNAL", "CLIENT"]).default("INTERNAL"),
});

export const uploadProjectFileAction = defineAction({
  permission: "file.write",
  schema: uploadProjectFileSchema,
  handler: async (input, { user }) => {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: input.projectId },
      select: { managerId: true, client: { select: { ownerId: true } } },
    });
    assertProjectManagerInScope(user, "file.write", project.managerId ?? project.client.ownerId);

    const uploads = await receiveAndValidateUploads(input.files, {
      maxFiles: PROJECT_UPLOAD_MAX_FILES,
      maxBytesPerFile: PROJECT_UPLOAD_MAX_BYTES,
      allowedTypes: PROJECT_ADMIN_ALLOWED_TYPES,
    });

    try {
      await prisma.file.createMany({
        data: uploads.map((upload) => ({
          storageKey: upload.storageKey,
          originalName: upload.originalName,
          safeName: upload.safeName,
          mimeType: upload.mimeType,
          sizeBytes: upload.sizeBytes,
          sha256: upload.sha256,
          scanStatus: upload.scanStatus,
          category: input.category,
          status: "QUARANTINE",
          visibility: input.visibility,
          uploadedById: user.user.id,
          projectId: input.projectId,
        })),
      });
    } catch (error) {
      await discardUploads(uploads.map((upload) => upload.storageKey));
      throw error;
    }

    await promoteUploads(uploads.map((upload) => upload.storageKey));
    await prisma.file.updateMany({
      where: { storageKey: { in: uploads.map((upload) => upload.storageKey) } },
      data: { status: "ACTIVE" },
    });

    return { count: uploads.length };
  },
  audit: {
    category: "BUSINESS",
    action: "project.file.upload",
    entityType: "Project",
    entityId: (input) => input.projectId,
    changes: (input, output) => ({ count: output.count, category: input.category }),
  },
});

const deleteProjectFileSchema = z.object({ fileId: z.string().min(1) });

export const deleteProjectFileAction = defineAction({
  permission: "file.write",
  schema: deleteProjectFileSchema,
  handler: async (input, { user }) => {
    const file = await prisma.file.findUniqueOrThrow({
      where: { id: input.fileId },
      select: { storageKey: true, projectId: true, project: { select: { managerId: true, client: { select: { ownerId: true } } } } },
    });
    if (!file.projectId || !file.project) {
      throw new ValidationError("Fichier introuvable.");
    }
    assertProjectManagerInScope(user, "file.write", file.project.managerId ?? file.project.client.ownerId);

    await prisma.file.update({ where: { id: input.fileId }, data: { status: "DELETED", deletedAt: new Date() } });
    await removeStoredFile(file.storageKey);

    return { id: input.fileId };
  },
  audit: {
    category: "BUSINESS",
    action: "project.file.delete",
    entityType: "File",
    entityId: (input) => input.fileId,
  },
});

const uploadPortalProjectFileSchema = z.object({
  projectId: z.string().min(1),
  files: z.array(z.instanceof(File)).min(1).max(PROJECT_UPLOAD_MAX_FILES),
});

export const uploadPortalProjectFileAction = definePortalAction({
  schema: uploadPortalProjectFileSchema,
  handler: async (input, { clientId }) => {
    const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { clientId: true } });
    if (!project || project.clientId !== clientId) {
      throw new ValidationError("Projet introuvable.");
    }

    const uploads = await receiveAndValidateUploads(input.files, {
      maxFiles: PROJECT_UPLOAD_MAX_FILES,
      maxBytesPerFile: PROJECT_UPLOAD_MAX_BYTES,
      allowedTypes: PROJECT_CLIENT_ALLOWED_TYPES,
    });

    try {
      await prisma.file.createMany({
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
          projectId: input.projectId,
        })),
      });
    } catch (error) {
      await discardUploads(uploads.map((upload) => upload.storageKey));
      throw error;
    }

    await promoteUploads(uploads.map((upload) => upload.storageKey));
    await prisma.file.updateMany({
      where: { storageKey: { in: uploads.map((upload) => upload.storageKey) } },
      data: { status: "ACTIVE" },
    });

    return { count: uploads.length };
  },
  audit: {
    category: "BUSINESS",
    action: "project.file.upload_client",
    entityType: "Project",
    entityId: (input) => input.projectId,
  },
});
