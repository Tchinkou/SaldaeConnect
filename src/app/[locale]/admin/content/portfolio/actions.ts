"use server";
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { AppError } from "@/server/core/errors";

const translationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets."),
  summary: z.string().trim().max(400).nullable(),
  problem: z.string().trim().max(2000).nullable(),
  solution: z.string().trim().max(2000).nullable(),
  execution: z.string().trim().max(2000).nullable(),
  result: z.string().trim().max(2000).nullable(),
});

const schema = z.object({
  id: z.string().nullable(),
  clientName: z.string().trim().max(200).nullable(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  order: z.coerce.number().int().min(0),
  translations: z.object({ fr: translationSchema, en: translationSchema, ar: translationSchema }),
});

export const upsertPortfolioProjectAction = defineAction({
  permission: "cms.write",
  schema,
  handler: async (input) => {
    try {
      return await prisma.$transaction(async (tx) => {
        const data = {
          clientName: input.clientName,
          isFeatured: input.isFeatured,
          isPublished: input.isPublished,
          order: input.order,
        };

        const project = input.id
          ? await tx.portfolioProject.update({ where: { id: input.id }, data })
          : await tx.portfolioProject.create({ data });

        await Promise.all(
          (["fr", "en", "ar"] as const).map((locale) =>
            tx.portfolioProjectTranslation.upsert({
              where: { parentId_locale: { parentId: project.id, locale } },
              update: input.translations[locale],
              create: { parentId: project.id, locale, ...input.translations[locale] },
            }),
          ),
        );

        return { id: project.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("Ce slug est déjà utilisé par une autre réalisation dans cette langue.");
      }
      throw error;
    }
  },
  audit: {
    category: "BUSINESS",
    action: "portfolio_project.update",
    entityType: "portfolio_project",
    entityId: (_input, output) => output.id,
    entityLabel: (input) => input.translations.fr.title,
  },
});
