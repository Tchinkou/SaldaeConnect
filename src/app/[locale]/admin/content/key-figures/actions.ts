"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";

const translationSchema = z.object({ label: z.string().trim().min(1).max(160) });

const schema = z.object({
  id: z.string().nullable(),
  value: z.string().trim().min(1).max(20),
  suffix: z.string().trim().max(20).nullable(),
  order: z.coerce.number().int().min(0),
  isActive: z.boolean(),
  translations: z.object({ fr: translationSchema, en: translationSchema, ar: translationSchema }),
});

export const upsertKeyFigureAction = defineAction({
  permission: "cms.write",
  schema,
  handler: async (input) => {
    const data = { value: input.value, suffix: input.suffix, order: input.order, isActive: input.isActive };

    const keyFigure = input.id
      ? await prisma.keyFigure.update({ where: { id: input.id }, data })
      : await prisma.keyFigure.create({ data });

    await Promise.all(
      (["fr", "en", "ar"] as const).map((locale) =>
        prisma.keyFigureTranslation.upsert({
          where: { parentId_locale: { parentId: keyFigure.id, locale } },
          update: { label: input.translations[locale].label },
          create: { parentId: keyFigure.id, locale, label: input.translations[locale].label },
        }),
      ),
    );

    return { id: keyFigure.id };
  },
  audit: {
    category: "BUSINESS",
    action: "key_figure.update",
    entityType: "key_figure",
    entityId: (_input, output) => output.id,
    entityLabel: (input) => input.translations.fr.label,
  },
});
