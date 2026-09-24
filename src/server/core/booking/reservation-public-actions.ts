"use server";
import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/core/db/client";
import { definePublicAction } from "@/server/core/public-action";
import { ValidationError } from "@/server/core/errors";
import { nextNumber } from "@/server/core/numbering";
import { computeAvailableSlots } from "@/server/core/booking/availability";
import { parseBookingConfig } from "@/server/core/booking/config";
import { encryptSensitiveFields } from "@/server/core/crypto";
import { receiveAndValidateUploads, promoteUploads, discardUploads, PUBLIC_UPLOAD_MAX_FILES } from "@/server/core/storage";
import { getActiveAdmins, createNotifications } from "@/server/core/notify-admins";
import { sendReservationConfirmationEmail } from "@/server/core/email/send-reservation-confirmation-email";

/** Un seul champ démonstratif de « donnée sensible » chiffrée (§B.3) : le n° de pièce d'identité, quand le service le demande. */
const SENSITIVE_ANSWER_KEYS = ["documentNumber"];

const createReservationSchema = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  serviceId: z.string().min(1),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email().max(255),
  phone: z.string().trim().max(30).optional(),
  documentNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
  // AGENCY_SLOT : créneau choisi parmi les disponibilités affichées.
  startsAt: z.string().datetime().optional(),
  // EXTERNAL_APPOINTMENT : période souhaitée.
  preferredFrom: z.string().date().optional(),
  preferredTo: z.string().date().optional(),
  files: z.array(z.instanceof(File)).max(PUBLIC_UPLOAD_MAX_FILES).default([]),
  privacyAccepted: z.literal(true, "Vous devez accepter l'utilisation de vos données."),
  website: z.string().max(0).optional().default(""),
  renderedAt: z.coerce.number(),
});

export const createReservationAction = definePublicAction({
  schema: createReservationSchema,
  rateLimits: (input, { ip }) => [
    ...(ip ? [{ key: `reservation:ip:${ip}`, windowSeconds: 3600, max: 10 }] : []),
    { key: `reservation:email:${input.email.toLowerCase()}`, windowSeconds: 3600, max: 5 },
  ],
  handler: async (input) => {
    if (Date.now() - input.renderedAt < 2000) {
      throw new ValidationError("Envoi trop rapide, réessayez.");
    }

    const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
    if (!service || !service.isActive || service.fulfillmentType !== "BOOKING") {
      throw new ValidationError("Service invalide.");
    }
    const config = parseBookingConfig(service.bookingConfig);
    if (!config) {
      throw new ValidationError("Ce service n'est pas encore ouvert à la réservation.");
    }

    const contact = { firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone ?? null };
    const answers = encryptSensitiveFields({ documentNumber: input.documentNumber, notes: input.notes }, SENSITIVE_ANSWER_KEYS);

    const uploads = await receiveAndValidateUploads(input.files);

    let startsAt: Date | null = null;
    let endsAt: Date | null = null;

    let reservationRecord: { id: string; number: string };
    try {
      reservationRecord = await prisma.$transaction(async (tx) => {
        if (config.mode === "AGENCY_SLOT") {
          if (!input.startsAt) throw new ValidationError("Choisissez un créneau.");
          startsAt = new Date(input.startsAt);
          endsAt = new Date(startsAt.getTime() + config.slotMinutes * 60 * 1000);

          // Verrou transactionnel par (service, créneau) : deux demandes simultanées sur le
          // même créneau se sérialisent ici plutôt que de risquer une surréservation (§B.3).
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${service.id + "|" + startsAt.toISOString()}))`;

          const [rules, exceptions, existingReservations] = await Promise.all([
            tx.availabilityRule.findMany({ where: { serviceId: service.id } }),
            tx.availabilityException.findMany({}),
            tx.reservation.findMany({
              where: { serviceId: service.id, status: { notIn: ["CANCELLED"] }, startsAt: { not: null } },
              select: { startsAt: true, endsAt: true },
            }),
          ]);

          const slots = computeAvailableSlots({
            rules,
            exceptions,
            existingReservations: existingReservations.filter((r): r is { startsAt: Date; endsAt: Date } => r.startsAt !== null && r.endsAt !== null),
            slotMinutes: config.slotMinutes,
            capacityPerSlot: config.capacityPerSlot,
            minNoticeHours: config.minNoticeHours,
            maxAdvanceDays: config.maxAdvanceDays,
            from: startsAt,
            to: new Date(startsAt.getTime() + 60 * 1000),
          });
          const stillAvailable = slots.some((slot) => slot.start.getTime() === startsAt!.getTime());
          if (!stillAvailable) {
            throw new ValidationError("Ce créneau n'est plus disponible, merci d'en choisir un autre.");
          }
        } else {
          if (!input.preferredFrom || !input.preferredTo) {
            throw new ValidationError("Indiquez la période souhaitée.");
          }
        }

        // Rattachement au client existant (portail) si l'email correspond déjà à un dossier —
        // à la différence du flux devis (§D.2), on ne crée jamais de Lead/Opportunité ici :
        // une demande de rendez-vous n'est pas une opportunité commerciale.
        const existingClient = await tx.client.findFirst({ where: { email: input.email } });

        const number = await nextNumber(tx, "RESERVATION");
        const reservation = await tx.reservation.create({
          data: {
            number,
            serviceId: service.id,
            clientId: existingClient?.id,
            contact: contact as Prisma.InputJsonValue,
            answers: answers as Prisma.InputJsonValue,
            startsAt,
            endsAt,
            preferredFrom: input.preferredFrom ? new Date(input.preferredFrom) : null,
            preferredTo: input.preferredTo ? new Date(input.preferredTo) : null,
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
              reservationId: reservation.id,
            })),
          });
        }

        return { id: reservation.id, number };
      });
    } catch (error) {
      await discardUploads(uploads.map((upload) => upload.storageKey));
      throw error;
    }

    try {
      if (uploads.length > 0) {
        await promoteUploads(uploads.map((upload) => upload.storageKey));
        await prisma.file.updateMany({ where: { storageKey: { in: uploads.map((upload) => upload.storageKey) } }, data: { status: "ACTIVE" } });
      }

      const admins = await getActiveAdmins();
      await createNotifications(
        admins,
        "reservation.created",
        { number: reservationRecord.number },
        `/admin/bookings/${reservationRecord.id}`,
      );

      await sendReservationConfirmationEmail({ to: input.email, reservationNumber: reservationRecord.number, locale: input.locale });
    } catch (error) {
      console.error("Échec des notifications après création de réservation", error);
    }

    return reservationRecord;
  },
  audit: {
    category: "BUSINESS",
    action: "reservation.create",
    entityType: "Reservation",
    entityId: (output) => output.id,
    entityLabel: (output) => output.number,
  },
});

const listPublicSlotsSchema = z.object({ serviceId: z.string().min(1), from: z.string().date(), to: z.string().date() });

export const listPublicAvailableSlotsAction = definePublicAction({
  schema: listPublicSlotsSchema,
  rateLimits: (_input, { ip }) => [...(ip ? [{ key: `slots:ip:${ip}`, windowSeconds: 60, max: 60 }] : [])],
  audit: { category: "DATA", action: "reservation.slots.query" },
  handler: async (input) => {
    const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
    if (!service || !service.isActive || service.fulfillmentType !== "BOOKING") {
      throw new ValidationError("Service invalide.");
    }
    const config = parseBookingConfig(service.bookingConfig);
    if (!config || config.mode !== "AGENCY_SLOT") {
      return [];
    }

    const [rules, exceptions, existingReservations] = await Promise.all([
      prisma.availabilityRule.findMany({ where: { serviceId: service.id } }),
      prisma.availabilityException.findMany({}),
      prisma.reservation.findMany({
        where: { serviceId: service.id, status: { notIn: ["CANCELLED"] }, startsAt: { not: null } },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const slots = computeAvailableSlots({
      rules,
      exceptions,
      existingReservations: existingReservations.filter((r): r is { startsAt: Date; endsAt: Date } => r.startsAt !== null && r.endsAt !== null),
      slotMinutes: config.slotMinutes,
      capacityPerSlot: config.capacityPerSlot,
      minNoticeHours: config.minNoticeHours,
      maxAdvanceDays: config.maxAdvanceDays,
      from: new Date(input.from),
      to: new Date(input.to),
    });

    return slots.map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString(), remaining: slot.remaining }));
  },
});
