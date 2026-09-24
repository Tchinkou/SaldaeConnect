"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { ValidationError } from "@/server/core/errors";
import { transactionOrderWhereClause, assertTransactionAssigneeInScope } from "@/server/core/authz/ownership";
import { nextNumber } from "@/server/core/numbering";
import { encryptSensitiveFields, decryptSensitiveFields } from "@/server/core/crypto";
import { recordActivity } from "@/server/core/crm/timeline";

const IDENTITY_SENSITIVE_KEYS = ["documentNumber"];

/**
 * Commandes de transaction (§D.6) : module strictement interne, créé par le
 * staff au comptoir ou en admin — jamais de formulaire public tant que le
 * cadre légal n'est pas validé (§K). Cycle : REQUESTED → PRICE_CONFIRMED →
 * AWAITING_PAYMENT → PAID → COMPLETED (remise + sortie de stock), ou
 * CANCELLED à toute étape avant la remise.
 */
const orderItemSchema = z.object({ productId: z.string().min(1), quantity: z.number().positive() });

const createOrderSchema = z.object({
  clientId: z.string().min(1),
  items: z.array(orderItemSchema).min(1),
  documentType: z.string().trim().max(60).nullable(),
  documentNumber: z.string().trim().max(120).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export const createTransactionOrderAction = defineAction({
  permission: "transaction.write",
  schema: createOrderSchema,
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({ where: { id: input.clientId } });
      if (!client) throw new ValidationError("Client introuvable.");

      const products = await tx.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) } } });
      if (products.length !== new Set(input.items.map((item) => item.productId)).size) {
        throw new ValidationError("Un ou plusieurs produits sont introuvables.");
      }
      const productById = new Map(products.map((product) => [product.id, product]));

      let total = 0n;
      let currency: string | null = null;
      const itemsData = input.items.map((item) => {
        const product = productById.get(item.productId)!;
        if (!product.isActive) throw new ValidationError(`Le produit ${product.sku} n'est plus actif.`);
        currency ??= product.currentCurrency;
        if (currency !== product.currentCurrency) {
          throw new ValidationError("Tous les produits d'une même commande doivent être dans la même devise.");
        }
        const unitPrice = product.currentPrice;
        const lineTotal = BigInt(Math.round(item.quantity * Number(unitPrice)));
        total += lineTotal;
        return { productId: product.id, quantity: item.quantity, unitPrice, total: lineTotal };
      });

      const number = await nextNumber(tx, "TRANSACTION");

      const identityData =
        input.documentType || input.documentNumber
          ? encryptSensitiveFields({ documentType: input.documentType, documentNumber: input.documentNumber }, IDENTITY_SENSITIVE_KEYS)
          : undefined;

      const order = await tx.transactionOrder.create({
        data: {
          number,
          clientId: client.id,
          contact: { firstName: client.displayName, email: client.email ?? undefined } as Prisma.InputJsonValue,
          status: "REQUESTED",
          total,
          currency: currency ?? "DZD",
          assignedToId: user.user.id,
          identityData: identityData as Prisma.InputJsonValue | undefined,
          notes: input.notes,
          items: { create: itemsData },
        },
      });

      await tx.transactionStatusChange.create({
        data: { orderId: order.id, fromStatus: null, toStatus: "REQUESTED", changedById: user.user.id },
      });

      await recordActivity(tx, {
        type: "SYSTEM",
        subject: "Commande de transaction créée",
        actorId: user.user.id,
        clientId: client.id,
      });

      return { id: order.id, number: order.number };
    });
  },
  audit: {
    category: "BUSINESS",
    action: "transaction_order.create",
    entityType: "TransactionOrder",
    entityId: (_input, output) => output.id,
    entityLabel: (_input, output) => output.number,
  },
});

const TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["PRICE_CONFIRMED", "CANCELLED"],
  PRICE_CONFIRMED: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const updateStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["REQUESTED", "PRICE_CONFIRMED", "AWAITING_PAYMENT", "PAID", "COMPLETED", "CANCELLED"]),
  note: z.string().trim().max(2000).nullable(),
  total: z.number().nonnegative().nullable().optional(),
});

export const updateTransactionOrderStatusAction = defineAction({
  permission: "transaction.write",
  schema: updateStatusSchema,
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const order = await tx.transactionOrder.findUnique({ where: { id: input.orderId }, include: { items: true } });
      if (!order) throw new ValidationError("Commande introuvable.");
      assertTransactionAssigneeInScope(user, "transaction.write", order.assignedToId);

      const allowed = TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(input.status)) {
        throw new ValidationError(`Transition de ${order.status} vers ${input.status} non autorisée.`);
      }

      const updated = await tx.transactionOrder.update({
        where: { id: order.id },
        data: {
          status: input.status,
          total: input.status === "PRICE_CONFIRMED" && input.total !== null && input.total !== undefined ? BigInt(Math.round(input.total)) : order.total,
          completedAt: input.status === "COMPLETED" ? new Date() : order.completedAt,
        },
      });

      await tx.transactionStatusChange.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: input.status, changedById: user.user.id, note: input.note },
      });

      if (input.status === "COMPLETED") {
        for (const item of order.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product?.trackStock) {
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: "OUT",
                quantity: item.quantity,
                transactionOrderId: order.id,
                reference: order.number,
                createdById: user.user.id,
              },
            });
          }
        }
      }

      return updated;
    });
  },
  audit: {
    category: "BUSINESS",
    action: "transaction_order.status.update",
    entityType: "TransactionOrder",
    entityId: (input) => input.orderId,
    changes: (input) => ({ status: input.status }),
  },
});

export const listTransactionOrdersAction = defineAction({
  permission: "transaction.read",
  schema: z.object({ status: z.enum(["REQUESTED", "PRICE_CONFIRMED", "AWAITING_PAYMENT", "PAID", "COMPLETED", "CANCELLED"]).optional() }),
  handler: async (input, { user }) => {
    const where: Record<string, unknown> = { ...transactionOrderWhereClause(user, "transaction.read") };
    if (input.status) where.status = input.status;
    return prisma.transactionOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { client: { select: { displayName: true } } },
    });
  },
});

export const getTransactionOrderAction = defineAction({
  permission: "transaction.read",
  schema: z.object({ orderId: z.string().min(1) }),
  handler: async (input, { user }) => {
    const order = await prisma.transactionOrder.findUnique({
      where: { id: input.orderId },
      include: {
        client: { select: { displayName: true, email: true, phone: true } },
        items: { include: { product: { include: { translations: { where: { locale: "fr" } } } } } },
        payments: { orderBy: { paidAt: "desc" } },
        statusChanges: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!order) throw new ValidationError("Commande introuvable.");
    assertTransactionAssigneeInScope(user, "transaction.read", order.assignedToId);

    const identityData = order.identityData ? decryptSensitiveFields(order.identityData as Record<string, unknown>, IDENTITY_SENSITIVE_KEYS) : null;

    return {
      ...order,
      total: order.total.toString(),
      items: order.items.map((item) => ({ ...item, unitPrice: item.unitPrice.toString(), total: item.total.toString(), quantity: Number(item.quantity) })),
      payments: order.payments.map((payment) => ({ ...payment, amount: payment.amount.toString() })),
      identityData,
    };
  },
});

const recordPaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive(),
  methodId: z.string().min(1).nullable(),
  reference: z.string().trim().max(200).nullable(),
});

export const recordTransactionPaymentAction = defineAction({
  permission: "transaction.write",
  schema: recordPaymentSchema,
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const order = await tx.transactionOrder.findUnique({ where: { id: input.orderId }, include: { payments: true } });
      if (!order) throw new ValidationError("Commande introuvable.");
      if (order.status !== "AWAITING_PAYMENT") {
        throw new ValidationError("Un paiement ne peut être enregistré qu'en attente de paiement.");
      }

      const amountMinor = BigInt(Math.round(input.amount));
      const paidSoFar = order.payments.filter((payment) => payment.status === "RECORDED").reduce((sum, payment) => sum + payment.amount, 0n);
      if (paidSoFar + amountMinor > order.total) {
        throw new ValidationError("Le montant dépasse le solde restant dû.");
      }

      const payment = await tx.transactionPayment.create({
        data: {
          orderId: order.id,
          amount: amountMinor,
          currency: order.currency,
          methodId: input.methodId,
          reference: input.reference,
          recordedById: user.user.id,
          status: "RECORDED",
        },
      });

      if (paidSoFar + amountMinor >= order.total) {
        await tx.transactionOrder.update({ where: { id: order.id }, data: { status: "PAID" } });
        await tx.transactionStatusChange.create({
          data: { orderId: order.id, fromStatus: "AWAITING_PAYMENT", toStatus: "PAID", changedById: user.user.id },
        });
      }

      return { orderId: order.id, paymentId: payment.id };
    });
  },
  audit: {
    category: "BUSINESS",
    action: "transaction_payment.record",
    entityType: "TransactionOrder",
    entityId: (input) => input.orderId,
  },
});

export const reverseTransactionPaymentAction = defineAction({
  permission: "transaction.write",
  schema: z.object({ paymentId: z.string().min(1), reversalReason: z.string().trim().min(1).max(1000) }),
  handler: async (input, { user }) => {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.transactionPayment.findUnique({ where: { id: input.paymentId }, include: { order: { include: { payments: true } } } });
      if (!payment) throw new ValidationError("Paiement introuvable.");
      if (payment.status === "REVERSED") throw new ValidationError("Ce paiement est déjà annulé.");
      if (payment.order.status === "COMPLETED") throw new ValidationError("Impossible d'annuler un paiement d'une commande terminée.");

      await tx.transactionPayment.update({ where: { id: payment.id }, data: { status: "REVERSED" } });

      const remainingPaid = payment.order.payments
        .filter((other) => other.id !== payment.id && other.status === "RECORDED")
        .reduce((sum, other) => sum + other.amount, 0n);
      if (payment.order.status === "PAID" && remainingPaid < payment.order.total) {
        await tx.transactionOrder.update({ where: { id: payment.order.id }, data: { status: "AWAITING_PAYMENT" } });
        await tx.transactionStatusChange.create({
          data: { orderId: payment.order.id, fromStatus: "PAID", toStatus: "AWAITING_PAYMENT", changedById: user.user.id, note: input.reversalReason },
        });
      }

      return { orderId: payment.orderId };
    });
  },
  audit: {
    category: "BUSINESS",
    action: "transaction_payment.reverse",
    entityType: "TransactionOrder",
    entityId: (_input, output) => output.orderId,
  },
});
