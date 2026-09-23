"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { ValidationError } from "@/server/core/errors";
import type { CurrentUser } from "@/server/core/authz/session";
import { assertInvoiceOwnerInScope } from "@/server/core/authz/ownership";
import { recomputeInvoiceTotals, assertInvoiceIsDraft } from "@/server/core/invoices/totals";
import { recordActivity } from "@/server/core/crm/timeline";
import { toMinorUnits } from "@/server/core/money";

/** Charge une facture en écriture : vérifie le périmètre (via le client rattaché) et qu'elle est encore en brouillon. */
async function loadDraftInvoiceForWrite(tx: Prisma.TransactionClient, user: CurrentUser, invoiceId: string) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { client: true } });
  if (!invoice) throw new ValidationError("Facture introuvable.");
  assertInvoiceOwnerInScope(user, "invoice.write", invoice.client.ownerId);
  assertInvoiceIsDraft(invoice.status);
  return invoice;
}

const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  type: z.enum(["STANDARD", "DEPOSIT"]),
  projectId: z.string().min(1).nullable().optional(),
  quoteId: z.string().min(1).nullable().optional(),
});

/**
 * Crée une facture brouillon (§F.5) : saisie libre par un admin, ou depuis
 * un projet/devis (préremplissage du lien uniquement, pas des lignes — la
 * génération automatique depuis une échéance de devis est une action
 * séparée, `createInvoiceFromInstallmentAction`).
 */
export const createInvoiceAction = defineAction({
  permission: "invoice.write",
  schema: createInvoiceSchema,
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: input.clientId } });
      if (!client) throw new ValidationError("Client introuvable.");
      assertInvoiceOwnerInScope(user, "invoice.write", client.ownerId);

      if (input.projectId) {
        const project = await tx.project.findUnique({ where: { id: input.projectId } });
        if (!project || project.clientId !== client.id) throw new ValidationError("Projet introuvable pour ce client.");
      }
      if (input.quoteId) {
        const quote = await tx.quote.findUnique({ where: { id: input.quoteId } });
        if (!quote || quote.clientId !== client.id) throw new ValidationError("Devis introuvable pour ce client.");
      }

      const setting = await tx.setting.findUnique({ where: { key: "invoicing" } });
      const currency = (setting?.value as { defaultCurrency?: string } | null | undefined)?.defaultCurrency ?? "DZD";

      const invoice = await tx.invoice.create({
        data: {
          clientId: client.id,
          type: input.type,
          projectId: input.projectId || null,
          quoteId: input.quoteId || null,
          currency,
          status: "DRAFT",
        },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Facture créée (brouillon)",
        actorId: user.user.id,
        clientId: client.id,
      });

      return { invoiceId: invoice.id };
    });
  },
  audit: {
    category: "BUSINESS",
    action: "invoice.create",
    entityType: "Invoice",
    entityId: (_input, output) => output.invoiceId,
  },
});

const updateInvoiceHeaderSchema = z.object({
  invoiceId: z.string().min(1),
  dueDate: z.iso.date().nullable().optional(),
  terms: z.string().trim().max(5000).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

export const updateInvoiceHeaderAction = defineAction({
  permission: "invoice.write",
  schema: updateInvoiceHeaderSchema,
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftInvoiceForWrite(tx, user, input.invoiceId);
      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: {
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          terms: input.terms || null,
          notes: input.notes || null,
        },
      });
      return { invoiceId: input.invoiceId };
    });
  },
  audit: { category: "BUSINESS", action: "invoice.update", entityType: "Invoice", entityId: (input) => input.invoiceId },
});

const invoiceItemFields = {
  serviceId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  quantity: z.number().positive(),
  unit: z.string().trim().max(50).nullable().optional(),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100),
  taxRateId: z.string().min(1).nullable().optional(),
};

export const addInvoiceItemAction = defineAction({
  permission: "invoice.write",
  schema: z.object({ invoiceId: z.string().min(1), ...invoiceItemFields }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftInvoiceForWrite(tx, user, input.invoiceId);

      const taxRate = input.taxRateId ? await tx.taxRate.findUnique({ where: { id: input.taxRateId } }) : null;
      if (input.taxRateId && !taxRate) throw new ValidationError("Taux de taxe introuvable.");

      const last = await tx.invoiceItem.findFirst({ where: { invoiceId: input.invoiceId }, orderBy: { position: "desc" } });

      await tx.invoiceItem.create({
        data: {
          invoiceId: input.invoiceId,
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

      await recomputeInvoiceTotals(tx, input.invoiceId);
      return { invoiceId: input.invoiceId };
    });
  },
  audit: { category: "BUSINESS", action: "invoice.item.add", entityType: "Invoice", entityId: (input) => input.invoiceId },
});

export const updateInvoiceItemAction = defineAction({
  permission: "invoice.write",
  schema: z.object({ invoiceId: z.string().min(1), itemId: z.string().min(1), ...invoiceItemFields }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftInvoiceForWrite(tx, user, input.invoiceId);

      const item = await tx.invoiceItem.findUnique({ where: { id: input.itemId } });
      if (!item || item.invoiceId !== input.invoiceId) throw new ValidationError("Ligne de facture introuvable.");

      const taxRate = input.taxRateId ? await tx.taxRate.findUnique({ where: { id: input.taxRateId } }) : null;
      if (input.taxRateId && !taxRate) throw new ValidationError("Taux de taxe introuvable.");

      await tx.invoiceItem.update({
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

      await recomputeInvoiceTotals(tx, input.invoiceId);
      return { invoiceId: input.invoiceId };
    });
  },
  audit: { category: "BUSINESS", action: "invoice.item.update", entityType: "Invoice", entityId: (input) => input.invoiceId },
});

export const removeInvoiceItemAction = defineAction({
  permission: "invoice.write",
  schema: z.object({ invoiceId: z.string().min(1), itemId: z.string().min(1) }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      await loadDraftInvoiceForWrite(tx, user, input.invoiceId);

      const item = await tx.invoiceItem.findUnique({ where: { id: input.itemId } });
      if (!item || item.invoiceId !== input.invoiceId) throw new ValidationError("Ligne de facture introuvable.");

      await tx.invoiceItem.delete({ where: { id: input.itemId } });
      await recomputeInvoiceTotals(tx, input.invoiceId);
      return { invoiceId: input.invoiceId };
    });
  },
  audit: { category: "BUSINESS", action: "invoice.item.remove", entityType: "Invoice", entityId: (input) => input.invoiceId },
});

export const deleteInvoiceAction = defineAction({
  permission: "invoice.write",
  schema: z.object({ invoiceId: z.string().min(1) }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const invoice = await loadDraftInvoiceForWrite(tx, user, input.invoiceId);
      await tx.invoice.delete({ where: { id: input.invoiceId } });
      return { clientId: invoice.clientId };
    });
  },
  audit: { category: "BUSINESS", action: "invoice.delete", entityType: "Invoice", entityId: (input) => input.invoiceId },
});
