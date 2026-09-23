"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { ValidationError } from "@/server/core/errors";
import type { CurrentUser } from "@/server/core/authz/session";
import { assertQuoteOwnerInScope } from "@/server/core/authz/ownership";
import { convertLeadToClient } from "@/server/core/crm/convert";
import { recomputeQuoteTotals, assertQuoteIsDraft } from "@/server/core/quotes/totals";
import { recordActivity } from "@/server/core/crm/timeline";
import { toMinorUnits } from "@/server/core/money";

/** Charge un devis en écriture : vérifie le périmètre (via le client rattaché) et qu'il est encore en brouillon. */
async function loadDraftQuoteForWrite(tx: Prisma.TransactionClient, user: CurrentUser, quoteId: string) {
  const quote = await tx.quote.findUnique({ where: { id: quoteId }, include: { client: true } });
  if (!quote) throw new ValidationError("Devis introuvable.");
  assertQuoteOwnerInScope(user, "quote.write", quote.client.ownerId);
  assertQuoteIsDraft(quote.status);
  return quote;
}

const createQuoteSchema = z
  .object({
    clientId: z.string().min(1).optional(),
    opportunityId: z.string().min(1).optional(),
  })
  .refine((data) => data.clientId || data.opportunityId, { message: "Un client ou une opportunité est requis." });

/**
 * Crée un devis brouillon (§J étape 6). Depuis une opportunité qui n'a
 * encore qu'un lead, convertit automatiquement le lead en client (§E.1) :
 * un devis ne peut porter que sur un client, jamais sur un lead.
 */
export const createQuoteAction = defineAction({
  permission: "quote.write",
  schema: createQuoteSchema,
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      let clientId = input.clientId ?? null;
      let opportunityId: string | null = null;
      let title = "Nouveau devis";
      let locale: string | null = null;

      if (input.opportunityId) {
        const opportunity = await tx.opportunity.findUnique({ where: { id: input.opportunityId } });
        if (!opportunity) throw new ValidationError("Opportunité introuvable.");
        opportunityId = opportunity.id;
        title = opportunity.title;
        locale = opportunity.locale;

        if (opportunity.clientId) {
          clientId = opportunity.clientId;
        } else if (opportunity.leadId) {
          const converted = await convertLeadToClient(tx, opportunity.leadId, user.user.id);
          clientId = converted.clientId;
        } else {
          throw new ValidationError("Cette opportunité n'a ni client ni lead associé.");
        }
      }

      if (!clientId) throw new ValidationError("Client introuvable.");
      const client = await tx.client.findUnique({ where: { id: clientId } });
      if (!client) throw new ValidationError("Client introuvable.");
      assertQuoteOwnerInScope(user, "quote.write", client.ownerId);

      const setting = await tx.setting.findUnique({ where: { key: "invoicing" } });
      const currency = (setting?.value as { defaultCurrency?: string } | null | undefined)?.defaultCurrency ?? "DZD";

      const quote = await tx.quote.create({
        data: {
          clientId,
          opportunityId,
          title,
          locale: client.preferredLocale || locale || "fr",
          currency,
          status: "DRAFT",
          createdById: user.user.id,
        },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Devis créé (brouillon)",
        actorId: user.user.id,
        clientId,
        opportunityId: opportunityId ?? undefined,
      });

      return { quoteId: quote.id };
    });
  },
  audit: {
    category: "BUSINESS",
    action: "quote.create",
    entityType: "Quote",
    entityId: (_input, output) => output.quoteId,
  },
});

const updateQuoteHeaderSchema = z.object({
  quoteId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  validUntil: z.iso.date().nullable().optional(),
  introduction: z.string().trim().max(5000).nullable().optional(),
  terms: z.string().trim().max(5000).nullable().optional(),
  internalNotes: z.string().trim().max(5000).nullable().optional(),
  globalDiscountType: z.enum(["PERCENT", "AMOUNT"]).nullable().optional(),
  globalDiscountValue: z.number().min(0).nullable().optional(),
  depositPercent: z.number().min(0).max(100).nullable().optional(),
  depositAmount: z.number().min(0).nullable().optional(),
});

export const updateQuoteHeaderAction = defineAction({
  permission: "quote.write",
  schema: updateQuoteHeaderSchema,
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftQuoteForWrite(tx, user, input.quoteId);

      if (input.globalDiscountType === "PERCENT" && (input.globalDiscountValue ?? 0) > 100) {
        throw new ValidationError("Une remise globale en pourcentage ne peut pas dépasser 100 %.");
      }

      await tx.quote.update({
        where: { id: input.quoteId },
        data: {
          title: input.title,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          introduction: input.introduction || null,
          terms: input.terms || null,
          internalNotes: input.internalNotes || null,
          globalDiscountType: input.globalDiscountType ?? null,
          globalDiscountValue:
            input.globalDiscountType && input.globalDiscountValue != null
              ? input.globalDiscountType === "PERCENT"
                ? BigInt(Math.round(input.globalDiscountValue))
                : toMinorUnits(input.globalDiscountValue)
              : null,
          depositPercent: input.depositPercent != null ? Math.round(input.depositPercent) : null,
          depositAmount: input.depositAmount != null ? toMinorUnits(input.depositAmount) : null,
        },
      });

      await recomputeQuoteTotals(tx, input.quoteId);
      return { quoteId: input.quoteId };
    });
  },
  audit: { category: "BUSINESS", action: "quote.update", entityType: "Quote", entityId: (input) => input.quoteId },
});

const quoteItemFields = {
  serviceId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  quantity: z.number().positive(),
  unit: z.string().trim().max(50).nullable().optional(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100),
  taxRateId: z.string().min(1).nullable().optional(),
};

export const addQuoteItemAction = defineAction({
  permission: "quote.write",
  schema: z.object({ quoteId: z.string().min(1), ...quoteItemFields }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftQuoteForWrite(tx, user, input.quoteId);

      const taxRate = input.taxRateId ? await tx.taxRate.findUnique({ where: { id: input.taxRateId } }) : null;
      if (input.taxRateId && !taxRate) throw new ValidationError("Taux de taxe introuvable.");

      const last = await tx.quoteItem.findFirst({ where: { quoteId: input.quoteId }, orderBy: { position: "desc" } });

      await tx.quoteItem.create({
        data: {
          quoteId: input.quoteId,
          position: (last?.position ?? -1) + 1,
          serviceId: input.serviceId || null,
          title: input.title,
          description: input.description || null,
          quantity: input.quantity,
          unit: input.unit || null,
          unitPrice: toMinorUnits(input.unitPrice),
          discountPercent: input.discountPercent,
          taxRateId: taxRate?.id ?? null,
          taxRatePercent: taxRate?.ratePercent ?? null,
          lineTotal: 0n,
        },
      });

      await recomputeQuoteTotals(tx, input.quoteId);
      return { quoteId: input.quoteId };
    });
  },
  audit: { category: "BUSINESS", action: "quote.item.add", entityType: "Quote", entityId: (input) => input.quoteId },
});

export const updateQuoteItemAction = defineAction({
  permission: "quote.write",
  schema: z.object({ quoteId: z.string().min(1), itemId: z.string().min(1), ...quoteItemFields }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftQuoteForWrite(tx, user, input.quoteId);

      const item = await tx.quoteItem.findUnique({ where: { id: input.itemId } });
      if (!item || item.quoteId !== input.quoteId) throw new ValidationError("Ligne de devis introuvable.");

      const taxRate = input.taxRateId ? await tx.taxRate.findUnique({ where: { id: input.taxRateId } }) : null;
      if (input.taxRateId && !taxRate) throw new ValidationError("Taux de taxe introuvable.");

      await tx.quoteItem.update({
        where: { id: input.itemId },
        data: {
          serviceId: input.serviceId || null,
          title: input.title,
          description: input.description || null,
          quantity: input.quantity,
          unit: input.unit || null,
          unitPrice: toMinorUnits(input.unitPrice),
          discountPercent: input.discountPercent,
          taxRateId: taxRate?.id ?? null,
          taxRatePercent: taxRate?.ratePercent ?? null,
        },
      });

      await recomputeQuoteTotals(tx, input.quoteId);
      return { quoteId: input.quoteId };
    });
  },
  audit: { category: "BUSINESS", action: "quote.item.update", entityType: "Quote", entityId: (input) => input.quoteId },
});

export const removeQuoteItemAction = defineAction({
  permission: "quote.write",
  schema: z.object({ quoteId: z.string().min(1), itemId: z.string().min(1) }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftQuoteForWrite(tx, user, input.quoteId);

      const item = await tx.quoteItem.findUnique({ where: { id: input.itemId } });
      if (!item || item.quoteId !== input.quoteId) throw new ValidationError("Ligne de devis introuvable.");

      await tx.quoteItem.delete({ where: { id: input.itemId } });
      await recomputeQuoteTotals(tx, input.quoteId);
      return { quoteId: input.quoteId };
    });
  },
  audit: { category: "BUSINESS", action: "quote.item.remove", entityType: "Quote", entityId: (input) => input.quoteId },
});

const installmentSchema = {
  label: z.string().trim().min(1).max(200),
  percent: z.number().min(0).max(100).nullable().optional(),
  amount: z.number().min(0).nullable().optional(),
  trigger: z.enum(["ON_ACCEPTANCE", "ON_MILESTONE", "ON_DELIVERY", "ON_DATE"]),
  milestoneKey: z.string().trim().max(100).nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
};

export const addQuoteInstallmentAction = defineAction({
  permission: "quote.write",
  schema: z
    .object({ quoteId: z.string().min(1), ...installmentSchema })
    .refine((data) => data.percent != null || data.amount != null, {
      message: "Un pourcentage ou un montant est requis.",
    }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftQuoteForWrite(tx, user, input.quoteId);

      const last = await tx.quoteInstallment.findFirst({ where: { quoteId: input.quoteId }, orderBy: { position: "desc" } });

      await tx.quoteInstallment.create({
        data: {
          quoteId: input.quoteId,
          position: (last?.position ?? -1) + 1,
          label: input.label,
          percent: input.percent ?? null,
          amount: input.amount != null ? toMinorUnits(input.amount) : null,
          trigger: input.trigger,
          milestoneKey: input.milestoneKey || null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        },
      });

      return { quoteId: input.quoteId };
    });
  },
  audit: { category: "BUSINESS", action: "quote.installment.add", entityType: "Quote", entityId: (input) => input.quoteId },
});

export const removeQuoteInstallmentAction = defineAction({
  permission: "quote.write",
  schema: z.object({ quoteId: z.string().min(1), installmentId: z.string().min(1) }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftQuoteForWrite(tx, user, input.quoteId);

      const installment = await tx.quoteInstallment.findUnique({ where: { id: input.installmentId } });
      if (!installment || installment.quoteId !== input.quoteId) throw new ValidationError("Échéance introuvable.");

      await tx.quoteInstallment.delete({ where: { id: input.installmentId } });
      return { quoteId: input.quoteId };
    });
  },
  audit: { category: "BUSINESS", action: "quote.installment.remove", entityType: "Quote", entityId: (input) => input.quoteId },
});

export const deleteQuoteAction = defineAction({
  permission: "quote.write",
  schema: z.object({ quoteId: z.string().min(1) }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const quote = await loadDraftQuoteForWrite(tx, user, input.quoteId);
      await tx.quote.delete({ where: { id: input.quoteId } });
      return { clientId: quote.clientId, opportunityId: quote.opportunityId };
    });
  },
  audit: { category: "BUSINESS", action: "quote.delete", entityType: "Quote", entityId: (input) => input.quoteId },
});
