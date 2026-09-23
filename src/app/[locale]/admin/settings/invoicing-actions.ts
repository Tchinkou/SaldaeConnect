"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { ValidationError } from "@/server/core/errors";

/**
 * Taux de taxe (§F.5, §K) : aucun n'est pré-rempli (prisma/schema/60-billing.prisma
 * l.45), à saisir ici après validation du comptable. Un taux utilisé par au
 * moins une ligne de devis/facture n'est jamais supprimé, seulement désactivé
 * (`isActive: false`) — il reste lisible sur les documents déjà émis.
 */
const taxRateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120),
  ratePercent: z.number().min(0).max(100),
  legalMentionFr: z.string().trim().max(500).nullable().optional(),
  legalMentionEn: z.string().trim().max(500).nullable().optional(),
  legalMentionAr: z.string().trim().max(500).nullable().optional(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export const upsertTaxRateAction = defineAction({
  permission: "settings.write",
  schema: taxRateSchema,
  audit: {
    category: "BUSINESS",
    action: "taxRate.upsert",
    entityType: "TaxRate",
    entityId: (input) => input.id ?? "new",
    entityLabel: (input) => input.name,
  },
  handler: async (input) => {
    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.taxRate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }

      const data = {
        name: input.name,
        ratePercent: input.ratePercent,
        legalMentionFr: input.legalMentionFr || null,
        legalMentionEn: input.legalMentionEn || null,
        legalMentionAr: input.legalMentionAr || null,
        isDefault: input.isDefault,
        isActive: input.isActive,
      };

      const taxRate = input.id
        ? await tx.taxRate.update({ where: { id: input.id }, data })
        : await tx.taxRate.create({ data });

      return { taxRateId: taxRate.id };
    });
  },
});

export const deleteTaxRateAction = defineAction({
  permission: "settings.write",
  schema: z.object({ taxRateId: z.string().min(1) }),
  audit: { category: "BUSINESS", action: "taxRate.delete", entityType: "TaxRate", entityId: (input) => input.taxRateId },
  handler: async (input) => {
    const [quoteUsage, invoiceUsage] = await Promise.all([
      prisma.quoteItem.count({ where: { taxRateId: input.taxRateId } }),
      prisma.invoiceItem.count({ where: { taxRateId: input.taxRateId } }),
    ]);
    if (quoteUsage > 0 || invoiceUsage > 0) {
      throw new ValidationError("Ce taux est utilisé par au moins un devis ou une facture — désactivez-le plutôt que de le supprimer.");
    }
    await prisma.taxRate.delete({ where: { id: input.taxRateId } });
    return { taxRateId: input.taxRateId };
  },
});

const paymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1),
  isActive: z.boolean(),
  translations: z.object({
    fr: z.string().trim().min(1).max(120),
    en: z.string().trim().min(1).max(120),
    ar: z.string().trim().min(1).max(120),
  }),
});

export const updatePaymentMethodAction = defineAction({
  permission: "settings.write",
  schema: paymentMethodSchema,
  audit: {
    category: "BUSINESS",
    action: "paymentMethod.update",
    entityType: "PaymentMethod",
    entityId: (input) => input.paymentMethodId,
  },
  handler: async (input) => {
    await prisma.$transaction([
      prisma.paymentMethod.update({ where: { id: input.paymentMethodId }, data: { isActive: input.isActive } }),
      ...(["fr", "en", "ar"] as const).map((locale) =>
        prisma.paymentMethodTranslation.update({
          where: { parentId_locale: { parentId: input.paymentMethodId, locale } },
          data: { name: input.translations[locale] },
        }),
      ),
    ]);
    return { paymentMethodId: input.paymentMethodId };
  },
});

/**
 * Bascule du paramètre §F.3.5 : "si le devis prévoit un acompte et que le
 * paramètre est activé : brouillon de facture d'acompte". Action dédiée
 * plutôt que le formulaire générique `updateSettingAction` (settings/actions.ts)
 * pour ne jamais risquer d'écraser les autres champs de la clé "invoicing"
 * (devise, mode d'arrondi…) avec un formulaire qui n'en connaît qu'un seul.
 */
export const updateAutoDraftDepositInvoiceAction = defineAction({
  permission: "settings.write",
  schema: z.object({ enabled: z.boolean() }),
  audit: {
    category: "BUSINESS",
    action: "settings.invoicing.autoDraftDepositInvoice",
    entityType: "Setting",
    entityId: () => "invoicing",
  },
  handler: async (input) => {
    const setting = await prisma.setting.findUnique({ where: { key: "invoicing" } });
    const value = (setting?.value && typeof setting.value === "object" ? setting.value : {}) as Record<string, unknown>;
    await prisma.setting.update({
      where: { key: "invoicing" },
      data: { value: { ...value, autoDraftDepositInvoice: input.enabled } },
    });
    return { enabled: input.enabled };
  },
});
