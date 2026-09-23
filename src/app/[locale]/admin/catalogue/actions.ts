"use server";
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { AppError } from "@/server/core/errors";

const translationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets."),
  shortDescription: z.string().trim().max(400).nullable(),
  isPublished: z.boolean(),
});

const schema = z.object({
  serviceId: z.string().min(1),
  isActive: z.boolean(),
  translations: z.object({
    fr: translationSchema,
    en: translationSchema,
    ar: translationSchema,
  }),
});

export const updateServiceAction = defineAction({
  permission: "cms.write",
  schema,
  audit: {
    category: "BUSINESS",
    action: "service.update",
    entityType: "service",
    entityId: (input) => input.serviceId,
    entityLabel: (input) => input.translations.fr.name,
  },
  handler: async (input) => {
    try {
      await prisma.$transaction([
        prisma.service.update({
          where: { id: input.serviceId },
          data: { isActive: input.isActive },
        }),
        ...(["fr", "en", "ar"] as const).map((locale) =>
          prisma.serviceTranslation.update({
            where: { serviceId_locale: { serviceId: input.serviceId, locale } },
            data: {
              name: input.translations[locale].name,
              slug: input.translations[locale].slug,
              shortDescription: input.translations[locale].shortDescription,
              isPublished: input.translations[locale].isPublished,
            },
          }),
        ),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("Ce slug est déjà utilisé par un autre service dans cette langue.");
      }
      throw error;
    }

    return { serviceId: input.serviceId };
  },
});
