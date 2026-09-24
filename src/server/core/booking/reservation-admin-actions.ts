"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { reservationWhereClause, assertReservationAssigneeInScope } from "@/server/core/authz/ownership";
import { createNotifications, isEmailNotificationEnabled } from "@/server/core/notify-admins";
import { sendReservationStatusChangeEmail } from "@/server/core/email/send-reservation-status-change-email";

const RESERVATION_STATUSES = ["REQUESTED", "CONFIRMED", "PENDING", "COMPLETED", "CANCELLED"] as const;

async function loadReservationForScope(reservationId: string) {
  return prisma.reservation.findUniqueOrThrow({ where: { id: reservationId }, select: { assignedToId: true } });
}

const updateStatusSchema = z.object({
  reservationId: z.string().min(1),
  status: z.enum(RESERVATION_STATUSES),
  note: z.string().trim().max(2000).nullable(),
  cancelReason: z.string().trim().max(500).nullable().optional(),
  externalAppointmentAt: z.string().datetime().nullable().optional(),
  externalReference: z.string().trim().max(200).nullable().optional(),
});

export const updateReservationStatusAction = defineAction({
  permission: "reservation.write",
  schema: updateStatusSchema,
  handler: async (input, { user }) => {
    const reservation = await loadReservationForScope(input.reservationId);
    assertReservationAssigneeInScope(user, "reservation.write", reservation.assignedToId);

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId } });
      const result = await tx.reservation.update({
        where: { id: input.reservationId },
        data: {
          status: input.status,
          cancelReason: input.status === "CANCELLED" ? (input.cancelReason ?? null) : current.cancelReason,
          externalAppointmentAt: input.externalAppointmentAt !== undefined ? (input.externalAppointmentAt ? new Date(input.externalAppointmentAt) : null) : current.externalAppointmentAt,
          externalReference: input.externalReference !== undefined ? input.externalReference : current.externalReference,
        },
      });
      await tx.reservationStatusChange.create({
        data: {
          reservationId: input.reservationId,
          fromStatus: current.status,
          toStatus: input.status,
          changedById: user.user.id,
          note: input.note,
        },
      });
      return result;
    });

    try {
      const clientContact = updated.clientId
        ? await prisma.clientContact.findFirst({ where: { clientId: updated.clientId, userId: { not: null } }, orderBy: { isPrimary: "desc" } })
        : null;

      const contact = updated.contact as { email?: string };
      if (contact.email && (await isEmailNotificationEnabled(clientContact?.userId ?? null, "reservation.status_changed"))) {
        await sendReservationStatusChangeEmail({ to: contact.email, reservationNumber: updated.number, status: updated.status, locale: "fr" });
      }
      if (clientContact?.userId) {
        await createNotifications(
          [{ id: clientContact.userId }],
          "reservation.status_changed",
          { number: updated.number, status: updated.status },
          `/portal/reservations/${updated.id}`,
        );
      }
    } catch (error) {
      console.error("Échec de la notification après changement de statut de réservation", error);
    }

    return updated;
  },
  audit: {
    category: "BUSINESS",
    action: "reservation.status.update",
    entityType: "Reservation",
    entityId: (input) => input.reservationId,
    changes: (input) => ({ status: input.status }),
  },
});

export const assignReservationAction = defineAction({
  permission: "reservation.write",
  schema: z.object({ reservationId: z.string().min(1), assignedToId: z.string().min(1).nullable() }),
  handler: async (input, { user }) => {
    const reservation = await loadReservationForScope(input.reservationId);
    assertReservationAssigneeInScope(user, "reservation.write", reservation.assignedToId);
    return prisma.reservation.update({ where: { id: input.reservationId }, data: { assignedToId: input.assignedToId } });
  },
  audit: {
    category: "BUSINESS",
    action: "reservation.assign",
    entityType: "Reservation",
    entityId: (input) => input.reservationId,
  },
});

export const listReservationsAction = defineAction({
  permission: "reservation.read",
  schema: z.object({ status: z.enum(RESERVATION_STATUSES).optional() }),
  handler: async (input, { user }) => {
    const where: Record<string, unknown> = { ...reservationWhereClause(user, "reservation.read") };
    if (input.status) where.status = input.status;
    return prisma.reservation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { service: { include: { translations: { where: { locale: "fr" } } } } },
    });
  },
});
