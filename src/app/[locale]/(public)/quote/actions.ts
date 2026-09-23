"use server";

import { z } from "zod";
import { prisma } from "@/server/core/db/client";
import { definePublicAction } from "@/server/core/public-action";
import { ValidationError } from "@/server/core/errors";
import { nextNumber } from "@/server/core/numbering";
import {
  receiveAndValidateUploads,
  promoteUploads,
  discardUploads,
  PUBLIC_UPLOAD_MAX_FILES,
} from "@/server/core/storage";
import { getActiveAdmins, createNotifications } from "@/server/core/notify-admins";
import { pickDefaultOwner } from "@/server/core/crm/attribution";
import { sendRequestConfirmationEmail } from "@/server/core/email/send-request-confirmation-email";
import { sendNewRequestNotificationEmail } from "@/server/core/email/send-new-request-notification-email";
import { env } from "@/server/core/env";

const requestSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  serviceId: z.string().min(1),
  answers: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  budgetMin: z.coerce.number().int().nonnegative().optional(),
  budgetMax: z.coerce.number().int().nonnegative().optional(),
  desiredDeadline: z.string().optional(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email().max(255),
  phone: z.string().trim().max(30).optional(),
  companyName: z.string().trim().max(200).optional(),
  country: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  message: z.string().trim().min(1).max(5000),
  files: z.array(z.instanceof(File)).max(PUBLIC_UPLOAD_MAX_FILES).default([]),
  privacyAccepted: z.literal(true, "Vous devez accepter l'utilisation de vos données."),
  // Anti-spam (§H.2) : piège à robots (doit rester vide) + temps de saisie minimal.
  website: z.string().max(0).optional().default(""),
  renderedAt: z.coerce.number(),
});

export const submitRequestAction = definePublicAction({
  schema: requestSchema,
  rateLimits: (input, { ip }) => [
    ...(ip ? [{ key: `quote:ip:${ip}`, windowSeconds: 3600, max: 10 }] : []),
    { key: `quote:email:${input.email.toLowerCase()}`, windowSeconds: 3600, max: 5 },
  ],
  handler: async (input) => {
    if (Date.now() - input.renderedAt < 2000) {
      throw new ValidationError("Envoi trop rapide, réessayez.");
    }

    const service = await prisma.service.findUnique({
      where: { id: input.serviceId },
      include: { translations: { where: { locale: input.locale } } },
    });
    if (!service || !service.isActive || !service.translations[0]?.isPublished) {
      throw new ValidationError("Service invalide.");
    }

    // E/S disque avant la transaction (§H.4) — les fichiers restent en
    // quarantaine tant que l'Opportunité n'est pas confirmée en base.
    const uploads = await receiveAndValidateUploads(input.files);

    let opportunityRecord: { id: string; number: string };
    try {
      opportunityRecord = await prisma.$transaction(async (tx) => {
        const [existingClient, existingLead] = await Promise.all([
          tx.client.findFirst({
            where: input.phone
              ? { OR: [{ email: input.email }, { phone: input.phone }] }
              : { email: input.email },
          }),
          tx.lead.findFirst({
            where: input.phone
              ? { OR: [{ email: input.email }, { phone: input.phone }] }
              : { email: input.email },
          }),
        ]);

        const isNewLead = !existingClient && !existingLead;
        const lead =
          existingClient || existingLead
            ? existingLead
            : await tx.lead.create({
                data: {
                  firstName: input.firstName,
                  lastName: input.lastName,
                  email: input.email,
                  phone: input.phone,
                  companyName: input.companyName,
                  country: input.country,
                  city: input.city,
                  locale: input.locale,
                  privacyAcceptedAt: new Date(),
                  sourceId: (await tx.leadSource.findUnique({ where: { key: "website" } }))?.id,
                  ownerId: await pickDefaultOwner(tx),
                },
              });

        // Une opportunité rattachée à un lead/client existant suit son
        // responsable ; sinon (ou s'il n'en a pas encore) on en attribue un.
        const ownerId = isNewLead
          ? lead!.ownerId
          : ((existingClient?.ownerId ?? existingLead?.ownerId) || (await pickDefaultOwner(tx)));

        const stage = await tx.pipelineStage.findUniqueOrThrow({ where: { key: "new_lead" } });
        const requestNumber = await nextNumber(tx, "REQUEST");

        const opportunity = await tx.opportunity.create({
          data: {
            number: requestNumber,
            title: `${service.translations[0]!.name} — ${input.firstName} ${input.lastName}`,
            leadId: lead?.id,
            clientId: existingClient?.id,
            serviceId: service.id,
            stageId: stage.id,
            ownerId,
            budgetMin: input.budgetMin !== undefined ? BigInt(input.budgetMin) : undefined,
            budgetMax: input.budgetMax !== undefined ? BigInt(input.budgetMax) : undefined,
            budgetCurrency: input.budgetMin !== undefined || input.budgetMax !== undefined ? "DZD" : undefined,
            desiredDeadline: input.desiredDeadline ? new Date(input.desiredDeadline) : undefined,
            answers: input.answers,
            message: input.message,
            locale: input.locale,
            sourceId: lead?.sourceId,
          },
        });

        await tx.activity.create({
          data: {
            type: "SYSTEM",
            subject: "Demande reçue depuis le site",
            body: input.message,
            leadId: lead?.id,
            clientId: existingClient?.id,
            opportunityId: opportunity.id,
          },
        });

        if (uploads.length > 0) {
          await tx.file.createMany({
            data: uploads.map((upload) => ({
              storageKey: upload.storageKey,
              originalName: upload.originalName,
              safeName: upload.safeName,
              mimeType: upload.mimeType,
              sizeBytes: upload.sizeBytes,
              sha256: upload.sha256,
              category: "ATTACHMENT",
              status: "QUARANTINE",
              visibility: "INTERNAL",
              scanStatus: upload.scanStatus,
              opportunityId: opportunity.id,
            })),
          });
        }

        return { id: opportunity.id, number: requestNumber };
      });
    } catch (error) {
      await discardUploads(uploads.map((upload) => upload.storageKey));
      throw error;
    }

    // Après confirmation en base : sortie de quarantaine (§H.4), notifications
    // et emails. Ces effets de bord ne doivent jamais faire échouer la
    // réponse à l'utilisateur — sa demande est déjà enregistrée et numérotée.
    try {
      if (uploads.length > 0) {
        await promoteUploads(uploads.map((upload) => upload.storageKey));
        await prisma.file.updateMany({
          where: { storageKey: { in: uploads.map((upload) => upload.storageKey) } },
          data: { status: "ACTIVE" },
        });
      }

      const admins = await getActiveAdmins();
      await createNotifications(
        admins,
        "opportunity.created",
        { opportunityId: opportunityRecord.id, requestNumber: opportunityRecord.number },
        `/admin/crm/opportunities/${opportunityRecord.id}`,
      );

      await Promise.all([
        sendRequestConfirmationEmail({
          to: input.email,
          requestNumber: opportunityRecord.number,
          locale: input.locale,
        }),
        ...admins
          .filter((admin) => admin.email)
          .map((admin) =>
            sendNewRequestNotificationEmail({
              to: admin.email,
              requestNumber: opportunityRecord.number,
              serviceName: service.translations[0]!.name,
              contactName: `${input.firstName} ${input.lastName}`,
              crmUrl: `${env.NEXT_PUBLIC_APP_URL}/${admin.locale}/admin/crm/opportunities/${opportunityRecord.id}`,
              locale: admin.locale,
            }),
          ),
      ]);
    } catch (error) {
      console.error("Échec des effets secondaires après création de la demande", error);
    }

    return { opportunityId: opportunityRecord.id, requestNumber: opportunityRecord.number };
  },
  audit: {
    category: "BUSINESS",
    action: "opportunity.created",
    entityType: "Opportunity",
    entityId: (output) => output.opportunityId,
    entityLabel: (output) => output.requestNumber,
  },
});
