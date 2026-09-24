import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";

export default async function PagesListPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const t = await getTranslations("admin.content");
  const pages = await prisma.page.findMany({
    orderBy: { key: "asc" },
    include: { translations: { where: { locale: "fr" } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("pages.title")}</h1>
          <p className="mt-1 text-sm text-foreground/70">{t("pages.subtitle")}</p>
        </div>
        <Link href="/admin/content/pages/new" className="text-sm font-medium text-brand-600 hover:underline">
          {t("new")}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pages.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="text-sm text-foreground/70">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {pages.map((page) => (
                <li key={page.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link href={`/admin/content/pages/${page.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      {page.translations[0]?.title ?? page.key}
                    </Link>
                    <p className="mt-1 text-xs text-foreground/50" dir="ltr">
                      {page.key}
                    </p>
                    <div className="mt-1 flex gap-2">
                      {page.isSystem ? <Badge tone="info">{t("pages.system")}</Badge> : <Badge tone="neutral">{t("pages.free")}</Badge>}
                      <Badge tone={page.translations[0]?.isPublished ? "success" : "neutral"}>
                        {t(page.translations[0]?.isPublished ? "isPublished" : "pages.draft")}
                      </Badge>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
