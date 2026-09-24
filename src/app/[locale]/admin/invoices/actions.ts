"use server";
import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { ValidationError } from "@/server/core/errors";
import type { CurrentUser } from "@/server/core/authz/session";
import { assertInvoiceOwnerInScope } from "@/server/core/authz/ownership";
import { recomputeInvoiceTotals, assertInvoiceIsDraft } from "@/server/core/invoices/totals";
import { buildInvoicePdfHtml } from "@/server/core/invoices/pdf-template";
import { recordActivity } from "@/server/core/crm/timeline";
import { createNotifications } from "@/server/core/notify-admins";
import { nextNumber } from "@/server/core/numbering";
import { getPdfRenderer } from "@/server/core/pdf";
import { storeGeneratedFile } from "@/server/core/storage";
import { env } from "@/server/core/env";
import { sendInvoiceAvailableEmail } from "@/server/core/email/send-invoice-available-email";
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

/**
 * Émission d'une facture (§F.5) : attribution du numéro dans la transaction
 * (séquence verrouillée, sans trou), figement de l'instantané (identités
 * légales agence/client, lignes, taux, mentions), génération du PDF,
 * empreinte SHA-256, email au client. Après émission, la facture n'est plus
 * jamais modifiable — une erreur se corrige par un avoir (action séparée).
 * Découpé en 3 étapes comme `sendQuoteAction` : le rendu PDF (Chromium) ne
 * doit pas tenir une transaction Postgres ouverte pendant qu'il tourne.
 */
const issueInvoiceSchema = z.object({ invoiceId: z.string().min(1) });

export const issueInvoiceAction = defineAction({
  permission: "invoice.issue",
  schema: issueInvoiceSchema,
  audit: { category: "BUSINESS", action: "invoice.issue", entityType: "Invoice", entityId: (input) => input.invoiceId },
  handler: async (input, { user }) => {
    const prepared = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        include: { client: true, items: { orderBy: { position: "asc" } } },
      });
      if (!invoice) throw new ValidationError("Facture introuvable.");
      assertInvoiceOwnerInScope(user, "invoice.issue", invoice.client.ownerId);
      assertInvoiceIsDraft(invoice.status);
      if (invoice.items.length === 0) {
        throw new ValidationError("La facture doit contenir au moins une ligne avant d'être émise.");
      }

      await recomputeInvoiceTotals(tx, invoice.id);

      const number = await nextNumber(tx, invoice.type === "CREDIT_NOTE" ? "CREDIT_NOTE" : "INVOICE");

      const originalInvoice = invoice.originalInvoiceId
        ? await tx.invoice.findUnique({ where: { id: invoice.originalInvoiceId }, select: { number: true } })
        : null;

      const contact = await tx.clientContact.findFirst({
        where: { clientId: invoice.clientId, email: { not: null } },
        orderBy: [{ isPrimary: "desc" }],
      });
      if (!contact || !contact.email) {
        throw new ValidationError("Aucun contact avec adresse email pour ce client — ajoutez-en un avant l'émission.");
      }
      const contactEmail = contact.email;

      const [brandSetting, legalSetting] = await Promise.all([
        tx.setting.findUnique({ where: { key: "brand" } }),
        tx.setting.findUnique({ where: { key: "legal" } }),
      ]);
      const brandName = (brandSetting?.value as { name?: string } | null)?.name ?? "SaldaeConnect";
      const legalName = (legalSetting?.value as { legalName?: string | null } | null)?.legalName ?? null;

      return {
        invoice: { ...invoice, number },
        contactId: contact.id,
        contactUserId: contact.userId,
        contactEmail,
        brandName,
        legalName,
        clientLocale: invoice.client.preferredLocale || "fr",
        originalInvoiceNumber: originalInvoice?.number ?? null,
      };
    });

    const { invoice, contactUserId, contactEmail, brandName, legalName, clientLocale, originalInvoiceNumber } = prepared;
    const issueDate = new Date();

    const html = buildInvoicePdfHtml({
      number: invoice.number,
      type: invoice.type,
      locale: clientLocale,
      currency: invoice.currency,
      issueDate,
      dueDate: invoice.dueDate,
      terms: invoice.terms,
      notes: invoice.notes,
      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      taxTotal: invoice.taxTotal,
      total: invoice.total,
      items: invoice.items.map((item) => ({
        title: item.title,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      brandName,
      legalName,
      clientDisplayName: invoice.client.displayName,
      clientAddress: [invoice.client.address, invoice.client.city, invoice.client.country].filter(Boolean).join(", ") || null,
      originalInvoiceNumber,
    });

    const pdfBytes = await getPdfRenderer().render(html);
    const stored = await storeGeneratedFile(pdfBytes);

    const outcome = await prisma.$transaction(async (tx) => {
      const current = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      assertInvoiceIsDraft(current.status);

      const file = await tx.file.create({
        data: {
          storageKey: stored.storageKey,
          originalName: `Facture-${invoice.number}.pdf`,
          safeName: `facture-${invoice.number}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          uploadedById: user.user.id,
          visibility: "CLIENT",
          category: "INVOICE_PDF",
          status: "ACTIVE",
          clientId: invoice.clientId,
        },
      });

      const billingSnapshot = {
        agency: { brandName, legalName },
        client: {
          displayName: invoice.client.displayName,
          legalName: invoice.client.legalName,
          address: invoice.client.address,
          city: invoice.client.city,
          country: invoice.client.country,
          legalIdentifiers: invoice.client.legalIdentifiers,
        },
        items: invoice.items.map((item) => ({
          title: item.title,
          description: item.description,
          quantity: item.quantity.toString(),
          unit: item.unit,
          unitPrice: item.unitPrice.toString(),
          discountPercent: item.discountPercent.toString(),
          taxRatePercent: item.taxRatePercent?.toString() ?? null,
          lineTotal: item.lineTotal.toString(),
        })),
        terms: invoice.terms,
        notes: invoice.notes,
      };

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          number: invoice.number,
          status: "SENT",
          issueDate,
          billingSnapshot,
          pdfFileId: file.id,
          contentHash: stored.sha256,
          issuedById: user.user.id,
        },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Facture émise",
        actorId: user.user.id,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
      });

      let acceptUrl: string | null = null;
      if (!contactUserId) {
        await tx.invitation.deleteMany({ where: { email: contactEmail, clientId: invoice.clientId, acceptedAt: null } });
        const rawToken = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        await tx.invitation.create({
          data: {
            email: contactEmail,
            clientId: invoice.clientId,
            tokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            invitedById: user.user.id,
          },
        });
        acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/${clientLocale}/accept-invitation/${rawToken}`;
      } else {
        await createNotifications(
          [{ id: contactUserId }],
          "invoice.issued",
          { number: invoice.number },
          `/portal/invoices/${invoice.id}`,
        );
      }

      return { acceptUrl };
    });

    try {
      const ctaUrl = outcome.acceptUrl ?? `${env.NEXT_PUBLIC_APP_URL}/${clientLocale}/login`;
      await sendInvoiceAvailableEmail({ to: contactEmail, invoiceNumber: invoice.number, ctaUrl, locale: clientLocale });
    } catch (error) {
      console.error("Échec de l'envoi de l'email de disponibilité d'une facture", error);
    }

    return { invoiceId: invoice.id };
  },
});

/**
 * Annulation d'une facture émise (§F.5) : uniquement depuis ÉMISE ou EN
 * RETARD (jamais une facture déjà brouillon — pas besoin — ni déjà payée,
 * partiellement ou non : un encaissement réel n'est jamais effacé par une
 * annulation, seul un avoir peut corriger un montant après paiement). Motif
 * obligatoire, rien n'est supprimé — §F.5 : "Les règles exactes (annulation,
 * avoir, mentions) sont à valider avec le comptable", donc volontairement
 * minimal : statut + motif, pas d'écriture comptable automatique.
 */
const cancelInvoiceSchema = z.object({ invoiceId: z.string().min(1), cancelReason: z.string().trim().min(1).max(1000) });

export const cancelInvoiceAction = defineAction({
  permission: "invoice.issue",
  schema: cancelInvoiceSchema,
  audit: { category: "BUSINESS", action: "invoice.cancel", entityType: "Invoice", entityId: (input) => input.invoiceId },
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId }, include: { client: true } });
      if (!invoice) throw new ValidationError("Facture introuvable.");
      assertInvoiceOwnerInScope(user, "invoice.issue", invoice.client.ownerId);
      if (invoice.status !== "SENT" && invoice.status !== "OVERDUE") {
        throw new ValidationError("Seule une facture émise ou en retard peut être annulée.");
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: input.cancelReason },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Facture annulée",
        body: input.cancelReason,
        actorId: user.user.id,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
      });

      return { invoiceId: invoice.id };
    });
  },
});

/**
 * Crée un avoir brouillon (§F.5) lié à une facture émise, pré-rempli avec
 * les lignes de l'originale — l'admin les ajuste (supprime les lignes non
 * concernées, corrige les quantités) avant émission pour ne créditer que le
 * montant réellement dû. L'avoir suit ensuite le même cycle qu'une facture
 * normale (brouillon → émission via `issueInvoiceAction`, qui lui attribue
 * déjà un numéro de la séquence CREDIT_NOTE séparée).
 */
const createCreditNoteSchema = z.object({ invoiceId: z.string().min(1) });

export const createCreditNoteAction = defineAction({
  permission: "invoice.write",
  schema: createCreditNoteSchema,
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const original = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        include: { client: true, items: { orderBy: { position: "asc" } } },
      });
      if (!original) throw new ValidationError("Facture introuvable.");
      assertInvoiceOwnerInScope(user, "invoice.write", original.client.ownerId);
      if (original.type === "CREDIT_NOTE") throw new ValidationError("Un avoir ne peut pas lui-même être avoir.");
      if (original.status === "DRAFT") throw new ValidationError("Cette facture n'a pas encore été émise — modifiez-la directement.");

      const creditNote = await tx.invoice.create({
        data: {
          clientId: original.clientId,
          type: "CREDIT_NOTE",
          projectId: original.projectId,
          originalInvoiceId: original.id,
          currency: original.currency,
          status: "DRAFT",
          items: {
            create: original.items.map((item) => ({
              position: item.position,
              serviceId: item.serviceId,
              title: item.title,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              taxRateId: item.taxRateId,
              taxRatePercent: item.taxRatePercent,
              lineTotal: item.lineTotal,
            })),
          },
        },
      });

      await recomputeInvoiceTotals(tx, creditNote.id);

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Avoir créé (brouillon)",
        actorId: user.user.id,
        clientId: original.clientId,
        invoiceId: creditNote.id,
      });

      return { invoiceId: creditNote.id };
    });
  },
  audit: {
    category: "BUSINESS",
    action: "invoice.creditNote.create",
    entityType: "Invoice",
    entityId: (_input, output) => output.invoiceId,
  },
});
