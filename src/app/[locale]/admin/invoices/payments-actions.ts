"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { ValidationError } from "@/server/core/errors";
import { assertInvoiceOwnerInScope } from "@/server/core/authz/ownership";
import { recomputeInvoicePaymentStatus } from "@/server/core/invoices/payments";
import { recordActivity } from "@/server/core/crm/timeline";
import { createNotifications } from "@/server/core/notify-admins";
import { toMinorUnits } from "@/server/core/money";

const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  paidAt: z.iso.date(),
  methodId: z.string().min(1).nullable().optional(),
  reference: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

/**
 * Enregistrement manuel d'un paiement (§F.5/§F.7 : "paiements manuels" —
 * aucune passerelle de paiement dans ce périmètre). Autorisé uniquement sur
 * une facture ÉMISE, EN RETARD ou déjà PARTIELLEMENT PAYÉE (jamais DRAFT,
 * PAID ou CANCELLED). Le montant ne peut pas dépasser le solde restant dû —
 * un trop-perçu se traite hors système pour l'instant (aucune règle §F.5 ne
 * couvre le crédit client).
 */
export const recordPaymentAction = defineAction({
  permission: "payment.write",
  schema: recordPaymentSchema,
  audit: { category: "BUSINESS", action: "payment.record", entityType: "Invoice", entityId: (input) => input.invoiceId },
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId }, include: { client: true } });
      if (!invoice) throw new ValidationError("Facture introuvable.");
      assertInvoiceOwnerInScope(user, "payment.write", invoice.client.ownerId);
      if (invoice.status !== "SENT" && invoice.status !== "OVERDUE" && invoice.status !== "PARTIALLY_PAID") {
        throw new ValidationError("Un paiement ne peut être enregistré que sur une facture émise, en retard ou partiellement payée.");
      }

      const amountMinor = toMinorUnits(input.amount);
      if (amountMinor > invoice.balanceDue) {
        throw new ValidationError("Le montant dépasse le solde restant dû.");
      }

      if (input.methodId) {
        const method = await tx.paymentMethod.findUnique({ where: { id: input.methodId } });
        if (!method) throw new ValidationError("Moyen de paiement introuvable.");
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          amount: amountMinor,
          currency: invoice.currency,
          paidAt: new Date(input.paidAt),
          methodId: input.methodId || null,
          reference: input.reference || null,
          note: input.note || null,
          recordedById: user.user.id,
          status: "RECORDED",
        },
      });

      await recomputeInvoicePaymentStatus(tx, invoice.id);

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Paiement enregistré",
        actorId: user.user.id,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
      });

      const contact = await tx.clientContact.findFirst({
        where: { clientId: invoice.clientId, userId: { not: null } },
        orderBy: [{ isPrimary: "desc" }],
      });
      if (contact?.userId) {
        await createNotifications(
          [{ id: contact.userId }],
          "invoice.payment_recorded",
          { number: invoice.number ?? "" },
          `/portal/invoices/${invoice.id}`,
        );
      }

      return { invoiceId: invoice.id, paymentId: payment.id };
    });
  },
});

const reversePaymentSchema = z.object({
  paymentId: z.string().min(1),
  reversalReason: z.string().trim().min(1).max(1000),
});

/**
 * Annulation d'un paiement enregistré (erreur de saisie, chèque rejeté…).
 * Ne supprime jamais la ligne — passe son statut à REVERSED et recalcule le
 * solde/statut de la facture, qui peut donc redescendre de PAYÉE ou
 * PARTIELLEMENT PAYÉE vers ÉMISE.
 */
export const reversePaymentAction = defineAction({
  permission: "payment.write",
  schema: reversePaymentSchema,
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: input.paymentId }, include: { invoice: { include: { client: true } } } });
      if (!payment) throw new ValidationError("Paiement introuvable.");
      assertInvoiceOwnerInScope(user, "payment.write", payment.invoice.client.ownerId);
      if (payment.status === "REVERSED") throw new ValidationError("Ce paiement est déjà annulé.");

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REVERSED", reversedById: user.user.id, reversalReason: input.reversalReason },
      });

      await recomputeInvoicePaymentStatus(tx, payment.invoiceId);

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Paiement annulé",
        body: input.reversalReason,
        actorId: user.user.id,
        clientId: payment.clientId,
        invoiceId: payment.invoiceId,
      });

      return { invoiceId: payment.invoiceId };
    });
  },
  audit: {
    category: "BUSINESS",
    action: "payment.reverse",
    entityType: "Invoice",
    entityId: (_input, output) => output.invoiceId,
  },
});
