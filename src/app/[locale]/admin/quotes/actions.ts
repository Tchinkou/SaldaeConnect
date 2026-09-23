"use server";
import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { ValidationError } from "@/server/core/errors";
import type { CurrentUser } from "@/server/core/authz/session";
import { assertQuoteOwnerInScope } from "@/server/core/authz/ownership";
import { convertLeadToClient } from "@/server/core/crm/convert";
import { recomputeQuoteTotals, assertQuoteIsDraft } from "@/server/core/quotes/totals";
import { buildQuotePdfHtml } from "@/server/core/quotes/pdf-template";
import { recordActivity } from "@/server/core/crm/timeline";
import { advanceOpportunityStage } from "@/server/core/crm/stage";
import { toMinorUnits } from "@/server/core/money";
import { nextNumber } from "@/server/core/numbering";
import { getPdfRenderer } from "@/server/core/pdf";
import { storeGeneratedFile } from "@/server/core/storage";
import { env } from "@/server/core/env";
import { sendQuoteAvailableEmail } from "@/server/core/email/send-quote-available-email";

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

/**
 * Envoi d'un devis (§F.2) : recalcule les totaux, fige une `QuoteVersion`
 * (instantané + PDF + empreinte SHA-256), passe le devis en "Envoyé", fait
 * avancer l'opportunité, invite le client au portail s'il n'y a pas encore
 * accès. Découpé en trois étapes plutôt qu'une seule transaction Postgres
 * unique : le rendu PDF (Chromium, un sous-processus externe) ne doit pas
 * tenir une connexion/transaction Postgres ouverte pendant qu'il tourne.
 * Rien n'est jamais marqué "Envoyé" sans qu'une version et un PDF existent
 * réellement (§48) — un échec entre le rendu et la validation finale laisse
 * au pire un fichier PDF orphelin sur disque, jamais un devis dans un état
 * incohérent.
 */
const sendQuoteSchema = z.object({ quoteId: z.string().min(1) });

export const sendQuoteAction = defineAction({
  permission: "quote.send",
  schema: sendQuoteSchema,
  audit: { category: "BUSINESS", action: "quote.send", entityType: "Quote", entityId: (input) => input.quoteId },
  handler: async (input, { user }) => {
    const prepared = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({
        where: { id: input.quoteId },
        include: {
          client: true,
          items: { orderBy: { position: "asc" } },
          installments: { orderBy: { position: "asc" } },
        },
      });
      if (!quote) throw new ValidationError("Devis introuvable.");
      assertQuoteOwnerInScope(user, "quote.send", quote.client.ownerId);
      assertQuoteIsDraft(quote.status);
      if (quote.items.length === 0) {
        throw new ValidationError("Le devis doit contenir au moins une ligne avant d'être envoyé.");
      }

      await recomputeQuoteTotals(tx, quote.id);

      let number = quote.number;
      if (!number) {
        number = await nextNumber(tx, "QUOTE");
        await tx.quote.update({ where: { id: quote.id }, data: { number } });
      }

      const contact = quote.contactId
        ? await tx.clientContact.findUnique({ where: { id: quote.contactId } })
        : await tx.clientContact.findFirst({
            where: { clientId: quote.clientId, email: { not: null } },
            orderBy: [{ isPrimary: "desc" }],
          });
      if (!contact || !contact.email) {
        throw new ValidationError("Aucun contact avec adresse email pour ce client — ajoutez-en un avant l'envoi.");
      }
      const contactEmail = contact.email;

      const [brandSetting, legalSetting] = await Promise.all([
        tx.setting.findUnique({ where: { key: "brand" } }),
        tx.setting.findUnique({ where: { key: "legal" } }),
      ]);

      return {
        quote: { ...quote, number },
        contactId: contact.id,
        contactUserId: contact.userId,
        contactEmail,
        brandName: (brandSetting?.value as { name?: string } | null)?.name ?? "SaldaeConnect",
        legalName: (legalSetting?.value as { legalName?: string | null } | null)?.legalName ?? null,
      };
    });

    const { quote, contactUserId, contactEmail, brandName, legalName } = prepared;

    const html = buildQuotePdfHtml({
      number: quote.number,
      title: quote.title,
      locale: quote.locale,
      currency: quote.currency,
      sentAt: new Date(),
      validUntil: quote.validUntil,
      introduction: quote.introduction,
      terms: quote.terms,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
      items: quote.items.map((item) => ({
        title: item.title,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      installments: quote.installments.map((installment) => ({
        label: installment.label,
        percent: installment.percent != null ? Number(installment.percent) : null,
        amount: installment.amount,
      })),
      brandName,
      legalName,
      clientDisplayName: quote.client.displayName,
      clientAddress: [quote.client.address, quote.client.city, quote.client.country].filter(Boolean).join(", ") || null,
    });

    const pdfBytes = await getPdfRenderer().render(html);
    const stored = await storeGeneratedFile(pdfBytes);

    const outcome = await prisma.$transaction(async (tx) => {
      const current = await tx.quote.findUniqueOrThrow({ where: { id: quote.id } });
      assertQuoteIsDraft(current.status);

      const file = await tx.file.create({
        data: {
          storageKey: stored.storageKey,
          originalName: `Devis-${quote.number}.pdf`,
          safeName: `devis-${quote.number}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          uploadedById: user.user.id,
          visibility: "CLIENT",
          category: "QUOTE_PDF",
          status: "ACTIVE",
          clientId: quote.clientId,
        },
      });

      const version = quote.currentVersion + 1;
      await tx.quoteVersion.create({
        data: {
          quoteId: quote.id,
          version,
          snapshot: {
            number: quote.number,
            title: quote.title,
            introduction: quote.introduction,
            terms: quote.terms,
            currency: quote.currency,
            subtotal: quote.subtotal.toString(),
            discountTotal: quote.discountTotal.toString(),
            taxTotal: quote.taxTotal.toString(),
            total: quote.total.toString(),
            items: quote.items.map((item) => ({
              title: item.title,
              description: item.description,
              quantity: item.quantity.toString(),
              unit: item.unit,
              unitPrice: item.unitPrice.toString(),
              discountPercent: item.discountPercent.toString(),
              taxRatePercent: item.taxRatePercent?.toString() ?? null,
              lineTotal: item.lineTotal.toString(),
            })),
            installments: quote.installments.map((installment) => ({
              label: installment.label,
              percent: installment.percent?.toString() ?? null,
              amount: installment.amount?.toString() ?? null,
              trigger: installment.trigger,
            })),
          },
          pdfFileId: file.id,
          contentHash: stored.sha256,
          sentById: user.user.id,
        },
      });

      await tx.quote.update({
        where: { id: quote.id },
        data: { status: "SENT", sentAt: new Date(), currentVersion: version },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Devis envoyé au client",
        actorId: user.user.id,
        clientId: quote.clientId,
        opportunityId: quote.opportunityId ?? undefined,
        quoteId: quote.id,
      });

      if (quote.opportunityId) {
        await advanceOpportunityStage(tx, quote.opportunityId, "quote_sent", user.user.id);
      }

      let acceptUrl: string | null = null;
      if (!contactUserId) {
        await tx.invitation.deleteMany({ where: { email: contactEmail, clientId: quote.clientId, acceptedAt: null } });
        const rawToken = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        await tx.invitation.create({
          data: {
            email: contactEmail,
            clientId: quote.clientId,
            tokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            invitedById: user.user.id,
          },
        });
        acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/${quote.locale}/accept-invitation/${rawToken}`;
      }

      return { acceptUrl };
    });

    try {
      const ctaUrl = outcome.acceptUrl ?? `${env.NEXT_PUBLIC_APP_URL}/${quote.locale}/login`;
      await sendQuoteAvailableEmail({ to: contactEmail, quoteNumber: quote.number, ctaUrl, locale: quote.locale });
    } catch (error) {
      console.error("Échec de l'envoi de l'email de disponibilité d'un devis", error);
    }

    return { quoteId: quote.id };
  },
});
