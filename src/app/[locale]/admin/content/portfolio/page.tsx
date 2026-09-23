import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";

export default async function PortfolioContentPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const t = await getTranslations("admin.content");
  const projects = await prisma.portfolioProject.findMany({
    orderBy: { order: "asc" },
    include: { translations: { where: { locale: "fr" } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("portfolio.title")}</h1>
          <p className="mt-1 text-sm text-foreground/70">{t("portfolio.subtitle")}</p>
        </div>
        <Link href="/admin/content/portfolio/new" className="text-sm font-medium text-brand-600 hover:underline">
          {t("new")}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("portfolio.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-foreground/70">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {projects.map((project) => (
                <li key={project.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {project.translations[0]?.title ?? project.id}
                    </p>
                    <Badge tone={project.isPublished ? "success" : "neutral"} className="mt-1">
                      {t(project.isPublished ? "active" : "inactive")}
                    </Badge>
                  </div>
                  <Link
                    href={`/admin/content/portfolio/${project.id}`}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    {t("edit")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
