"use server";
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { AppError } from "@/server/core/errors";

const pathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^\/\S*$/, "Le chemin doit commencer par / et ne pas contenir d'espace.");

const createSchema = z.object({
  fromPath: pathSchema,
  toPath: pathSchema,
  statusCode: z.union([z.literal(301), z.literal(302)]),
});

export const createRedirectAction = defineAction({
  permission: "cms.write",
  schema: createSchema,
  handler: async (input) => {
    try {
      return await prisma.redirect.create({ data: input });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("Une redirection existe déjà pour ce chemin.");
      }
      throw error;
    }
  },
  audit: { category: "BUSINESS", action: "redirect.create", entityType: "redirect", entityId: (_input, output) => output.id, entityLabel: (input) => input.fromPath },
});

export const deleteRedirectAction = defineAction({
  permission: "cms.write",
  schema: z.object({ redirectId: z.string().min(1) }),
  handler: async (input) => {
    await prisma.redirect.delete({ where: { id: input.redirectId } });
    return { redirectId: input.redirectId };
  },
  audit: { category: "BUSINESS", action: "redirect.delete", entityType: "redirect", entityId: (input) => input.redirectId },
});
