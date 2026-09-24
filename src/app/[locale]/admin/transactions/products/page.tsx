import { getTranslations } from "next-intl/server";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { listProductsAction } from "@/server/core/transactions/product-actions";
import { ProductsManager } from "./products-manager";

/** Catalogue de produits transactionnels (§B.3, §D.6) — usage interne uniquement. */
export default async function ProductsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "transaction.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.products");
  const result = await listProductsAction({});
  const products = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-foreground/60">{t("subtitle")}</p>
      </div>

      <Card>
        <CardContent>
          <ProductsManager
            products={products.map((product) => ({
              id: product.id,
              kind: product.kind,
              sku: product.sku,
              unit: product.unit,
              trackStock: product.trackStock,
              isActive: product.isActive,
              currentPrice: product.currentPrice,
              currentCurrency: product.currentCurrency,
              minQuantity: product.minQuantity ? Number(product.minQuantity) : null,
              maxQuantity: product.maxQuantity ? Number(product.maxQuantity) : null,
              stockLevel: product.stockLevel,
              name: product.translations.find((translation) => translation.locale === "fr")?.name ?? product.sku,
              translations: {
                fr: {
                  name: product.translations.find((translation) => translation.locale === "fr")?.name ?? "",
                  description: product.translations.find((translation) => translation.locale === "fr")?.description ?? "",
                },
                en: {
                  name: product.translations.find((translation) => translation.locale === "en")?.name ?? "",
                  description: product.translations.find((translation) => translation.locale === "en")?.description ?? "",
                },
                ar: {
                  name: product.translations.find((translation) => translation.locale === "ar")?.name ?? "",
                  description: product.translations.find((translation) => translation.locale === "ar")?.description ?? "",
                },
              },
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
