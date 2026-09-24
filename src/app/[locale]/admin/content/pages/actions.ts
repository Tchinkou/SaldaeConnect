"use server";
import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { AppError, ValidationError } from "@/server/core/errors";

const blockSchema = z.object({
  type: z.enum(["heading", "paragraph"]),
  text: z.string().trim().min(1).max(4000),
});

const translationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Le slug ne peut contenir que des lettres minuscules, chiffres et tirets."),
  blocks: z.array(blockSchema),
  seoTitle: z.string().trim().max(160).nullable(),
  seoDescription: z.string().trim().max(320).nullable(),
  isPublished: z.boolean(),
});

const upsertSchema = z.object({
  id: z.string().nullable(),
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "La clé ne peut contenir que des lettres minuscules, chiffres et tirets.")
    .nullable(),
  translations: z.object({ fr: translationSchema, en: translationSchema, ar: translationSchema }),
});

/**
 * Pages libres et pages système (à propos, mentions légales…) partagent le
 * même modèle (§30, §49) — seule `isSystem` (posée à la création, jamais
 * modifiable ici) empêche la suppression d'une page système. `key` est
 * généré à partir du slug FR pour une nouvelle page libre.
 */
export const upsertPageAction = defineAction({
  permission: "cms.write",
  schema: upsertSchema,
  handler: async (input) => {
    try {
      return await prisma.$transaction(async (tx) => {
        let page = input.id ? await tx.page.findUnique({ where: { id: input.id } }) : null;
        if (input.id && !page) throw new ValidationError("Page introuvable.");

        if (!page) {
          const key = input.key || input.translations.fr.slug;
          const existing = await tx.page.findUnique({ where: { key } });
          if (existing) throw new AppError("Une page avec cette clé existe déjà.");
          page = await tx.page.create({ data: { key, isSystem: false } });
        }

        await Promise.all(
          (["fr", "en", "ar"] as const).map((locale) =>
            tx.pageTranslation.upsert({
              where: { parentId_locale: { parentId: page!.id, locale } },
              update: input.translations[locale],
              create: { parentId: page!.id, locale, ...input.translations[locale] },
            }),
          ),
        );

        return { id: page.id };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("Ce slug est déjà utilisé par une autre page dans cette langue.");
      }
      throw error;
    }
  },
  audit: {
    category: "BUSINESS",
    action: "page.update",
    entityType: "page",
    entityId: (_input, output) => output.id,
    entityLabel: (input) => input.translations.fr.title,
  },
});
