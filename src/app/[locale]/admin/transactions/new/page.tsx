import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { NewTransactionOrderForm } from "./new-transaction-order-form";

export default async function NewTransactionOrderPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "transaction.write")) {
    return <Forbidden />;
  }

  const [clients, products] = await Promise.all([
    prisma.client.findMany({ where: { deletedAt: null }, orderBy: { displayName: "asc" }, take: 200, select: { id: true, displayName: true, code: true } }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sku: "asc" },
      include: { translations: { where: { locale: "fr" } } },
    }),
  ]);

  return (
    <NewTransactionOrderForm
      clients={clients}
      products={products.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.translations[0]?.name ?? product.sku,
        currentPrice: product.currentPrice.toString(),
        currentCurrency: product.currentCurrency,
      }))}
    />
  );
}
