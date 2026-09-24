import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";

export default async function CataloguePage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.catalog");
  const locale = await getLocale();

  const categories = await prisma.serviceCategory.findMany({
    orderBy: { order: "asc" },
    include: {
      translations: { where: { locale } },
      services: {
        orderBy: { order: "asc" },
        include: { translations: { where: { locale } } },
      },
    },
  });

  const serviceCount = categories.reduce((total, category) => total + category.services.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
        <p className="mt-1 text-xs text-foreground/70">
          {t("categoriesCount", { count: categories.length, serviceCount })}
        </p>
      </div>

      {categories.map((category) => (
        <Card key={category.id}>
          <CardHeader>
            <CardTitle className="text-base">{category.translations[0]?.name ?? category.id}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {category.services.map((service) => {
                const translation = service.translations[0];
                return (
                  <li key={service.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{translation?.name ?? service.id}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge tone={service.isActive ? "success" : "neutral"}>
                          {t(`fulfillmentType.${service.fulfillmentType}`)}
                        </Badge>
                        {translation && !translation.isPublished ? (
                          <Badge tone="warning">{locale.toUpperCase()}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <Link
                      href={`/admin/catalogue/${service.id}`}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      {t("edit")}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
