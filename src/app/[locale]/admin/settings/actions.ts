"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format #RRGGBB attendu).");

const brandSchema = z.object({
  key: z.literal("brand"),
  value: z.object({
    name: z.string().trim().min(1).max(120),
    slogan: z.object({
      fr: z.string().trim().max(200),
      en: z.string().trim().max(200),
      ar: z.string().trim().max(200),
    }),
    logoFileId: z.string().nullable(),
    faviconFileId: z.string().nullable(),
  }),
});

const themeSchema = z.object({
  key: z.literal("theme"),
  value: z.object({
    colors: z.object({
      ink: hexColor,
      brand: hexColor,
      accent: hexColor,
    }),
  }),
});

const contactSchema = z.object({
  key: z.literal("contact"),
  value: z.object({
    email: z.email(),
    phone: z.string().trim().max(30).nullable(),
    whatsapp: z.string().trim().max(30).nullable(),
    address: z.string().trim().max(200).nullable(),
    city: z.string().trim().max(120).nullable(),
    country: z.string().trim().max(2).nullable(),
    timezone: z.string().trim().max(60),
    hours: z.string().trim().max(200).nullable(),
  }),
});

const socialSchema = z.object({
  key: z.literal("social"),
  value: z.object({
    facebook: z.string().trim().max(300),
    instagram: z.string().trim().max(300),
    linkedin: z.string().trim().max(300),
    whatsapp: z.string().trim().max(60),
  }),
});

const schema = z.discriminatedUnion("key", [brandSchema, themeSchema, contactSchema, socialSchema]);

export type BrandSettingValue = z.infer<typeof brandSchema>["value"];
export type ThemeSettingValue = z.infer<typeof themeSchema>["value"];
export type ContactSettingValue = z.infer<typeof contactSchema>["value"];
export type SocialSettingValue = z.infer<typeof socialSchema>["value"];

/**
 * Une action pour les 4 sections de paramètres globaux (§0.3, Annexe 1) —
 * même vérification de permission et même journal d'audit pour toutes ;
 * seule la forme de `value` change selon `key`.
 */
export const updateSettingAction = defineAction({
  permission: "settings.write",
  schema,
  audit: {
    category: "BUSINESS",
    action: "settings.update",
    entityType: "setting",
    entityId: (input) => input.key,
    changes: (input) => input.value,
  },
  handler: async (input, { user }) => {
    await prisma.setting.update({
      where: { key: input.key },
      data: { value: input.value, updatedById: user.user.id },
    });
    return { key: input.key };
  },
});
