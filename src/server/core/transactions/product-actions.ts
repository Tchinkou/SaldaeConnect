"use server";
import "server-only";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { ValidationError } from "@/server/core/errors";

/**
 * Produits transactionnels (§B.3, §D.6) : module interne uniquement tant
 * que le cadre légal n'est pas validé — `isPubliclyVisible` reste toujours
 * faux ici, aucun écran public ne l'expose (§K).
 */
const upsertProductSchema = z.object({
  id: z.string().min(1).optional(),
  kind: z.enum(["CURRENCY", "PREPAID_CARD", "PAYSERA", "OTHER"]),
  sku: z.string().trim().min(1).max(60),
  unit: z.string().trim().max(30).nullable(),
  trackStock: z.boolean(),
  isActive: z.boolean(),
  currentPrice: z.number().int().nonnegative(),
  currentCurrency: z.string().trim().length(3),
  minQuantity: z.number().nonnegative().nullable(),
  maxQuantity: z.number().nonnegative().nullable(),
  translations: z.object({
    fr: z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().max(1000).nullable() }),
    en: z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().max(1000).nullable() }),
    ar: z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().max(1000).nullable() }),
  }),
});

export const upsertProductAction = defineAction({
  permission: "transaction.write",
  schema: upsertProductSchema,
  handler: async (input, { user }) => {
    if (input.minQuantity !== null && input.maxQuantity !== null && input.minQuantity > input.maxQuantity) {
      throw new ValidationError("La quantité minimale ne peut pas dépasser la quantité maximale.");
    }

    return prisma.$transaction(async (tx) => {
      const existing = input.id ? await tx.product.findUnique({ where: { id: input.id } }) : null;
      const priceChanged = !existing || existing.currentPrice !== BigInt(input.currentPrice) || existing.currentCurrency !== input.currentCurrency;

      const data = {
        kind: input.kind,
        sku: input.sku,
        unit: input.unit,
        trackStock: input.trackStock,
        isActive: input.isActive,
        // Jamais vrai : ce module reste interne tant que le cadre légal n'est pas validé (§D.6).
        isPubliclyVisible: false,
        currentPrice: BigInt(input.currentPrice),
        currentCurrency: input.currentCurrency,
        minQuantity: input.minQuantity,
        maxQuantity: input.maxQuantity,
      };

      const product = existing
        ? await tx.product.update({ where: { id: existing.id }, data })
        : await tx.product.create({ data });

      for (const locale of ["fr", "en", "ar"] as const) {
        await tx.productTranslation.upsert({
          where: { parentId_locale: { parentId: product.id, locale } },
          create: { parentId: product.id, locale, name: input.translations[locale].name, description: input.translations[locale].description },
          update: { name: input.translations[locale].name, description: input.translations[locale].description },
        });
      }

      if (priceChanged) {
        await tx.productPriceChange.create({
          data: { productId: product.id, price: BigInt(input.currentPrice), currency: input.currentCurrency, setById: user.user.id },
        });
      }

      return { id: product.id };
    });
  },
  audit: {
    category: "BUSINESS",
    action: "product.upsert",
    entityType: "Product",
    entityId: (_input, output) => output.id,
    entityLabel: (input) => input.sku,
  },
});

export const listProductsAction = defineAction({
  permission: "transaction.read",
  schema: z.object({}),
  handler: async () => {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { translations: true, stockMovements: { select: { type: true, quantity: true } } },
    });
    return products.map((product) => ({
      ...product,
      currentPrice: product.currentPrice.toString(),
      stockLevel: product.trackStock
        ? product.stockMovements
            .reduce((sum, movement) => sum + (movement.type === "OUT" ? -Number(movement.quantity) : Number(movement.quantity)), 0)
            .toString()
        : null,
    }));
  },
});

const recordStockMovementSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.number(),
  reference: z.string().trim().max(200).nullable(),
  note: z.string().trim().max(500).nullable(),
});

export const recordStockMovementAction = defineAction({
  permission: "transaction.write",
  schema: recordStockMovementSchema,
  handler: async (input, { user }) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: input.productId } });
    if (!product.trackStock) {
      throw new ValidationError("Ce produit ne suit pas de stock.");
    }
    return prisma.stockMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantity: input.quantity,
        reference: input.reference,
        note: input.note,
        createdById: user.user.id,
      },
    });
  },
  audit: {
    category: "BUSINESS",
    action: "product.stock_movement",
    entityType: "Product",
    entityId: (input) => input.productId,
    changes: (input) => ({ type: input.type, quantity: input.quantity }),
  },
});
