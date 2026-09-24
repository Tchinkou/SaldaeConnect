import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { RedirectsForm } from "./redirects-form";

export default async function RedirectsPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const t = await getTranslations("admin.content");
  const redirects = await prisma.redirect.findMany({ orderBy: { fromPath: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("redirects.title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("redirects.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("redirects.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RedirectsForm redirects={redirects} />
        </CardContent>
      </Card>
    </div>
  );
}
