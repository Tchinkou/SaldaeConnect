"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { ValidationError } from "@/server/core/errors";

const weekdaySchema = z.number().int().min(0).max(6);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format attendu : HH:MM");

const upsertRuleSchema = z.object({
  id: z.string().min(1).optional(),
  serviceId: z.string().min(1),
  weekday: weekdaySchema,
  startTime: timeSchema,
  endTime: timeSchema,
});

export const listAvailabilityRulesAction = defineAction({
  permission: "reservation.write",
  schema: z.object({ serviceId: z.string().min(1) }),
  handler: async (input) => {
    return prisma.availabilityRule.findMany({ where: { serviceId: input.serviceId }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
  },
});

export const upsertAvailabilityRuleAction = defineAction({
  permission: "reservation.write",
  schema: upsertRuleSchema,
  handler: async (input) => {
    if (input.startTime >= input.endTime) {
      throw new ValidationError("L'heure de fin doit être après l'heure de début.");
    }
    if (input.id) {
      return prisma.availabilityRule.update({
        where: { id: input.id },
        data: { weekday: input.weekday, startTime: input.startTime, endTime: input.endTime },
      });
    }
    return prisma.availabilityRule.create({
      data: { serviceId: input.serviceId, weekday: input.weekday, startTime: input.startTime, endTime: input.endTime },
    });
  },
  audit: {
    category: "BUSINESS",
    action: "availability.rule.upsert",
    entityType: "AvailabilityRule",
    entityId: (_input, output) => output.id,
  },
});

export const deleteAvailabilityRuleAction = defineAction({
  permission: "reservation.write",
  schema: z.object({ id: z.string().min(1) }),
  audit: { category: "BUSINESS", action: "availability.rule.delete", entityType: "AvailabilityRule", entityId: (input) => input.id },
  handler: async (input) => {
    await prisma.availabilityRule.delete({ where: { id: input.id } });
    return { id: input.id };
  },
});

const createExceptionSchema = z.object({
  date: z.string().date(),
  startTime: timeSchema.nullable(),
  endTime: timeSchema.nullable(),
  type: z.enum(["CLOSED", "EXTRA"]),
  reason: z.string().trim().max(200).nullable(),
});

export const listAvailabilityExceptionsAction = defineAction({
  permission: "reservation.write",
  schema: z.object({}),
  handler: async () => {
    return prisma.availabilityException.findMany({ orderBy: { date: "desc" }, take: 100 });
  },
});

export const createAvailabilityExceptionAction = defineAction({
  permission: "reservation.write",
  schema: createExceptionSchema,
  handler: async (input) => {
    return prisma.availabilityException.create({
      data: { date: new Date(input.date), startTime: input.startTime, endTime: input.endTime, type: input.type, reason: input.reason },
    });
  },
  audit: { category: "BUSINESS", action: "availability.exception.create", entityType: "AvailabilityException", entityId: (_input, output) => output.id },
});

export const deleteAvailabilityExceptionAction = defineAction({
  permission: "reservation.write",
  schema: z.object({ id: z.string().min(1) }),
  audit: { category: "BUSINESS", action: "availability.exception.delete", entityType: "AvailabilityException", entityId: (input) => input.id },
  handler: async (input) => {
    await prisma.availabilityException.delete({ where: { id: input.id } });
    return { id: input.id };
  },
});
