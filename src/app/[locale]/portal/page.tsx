import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

/** Tableau de bord minimal du portail (§J) — sera enrichi en phase 8 (projets, factures, messages…). */
export default async function PortalDashboardPage() {
  const t = await getTranslations("portal.dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("quotesCard")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-foreground/70">{t("quotesCardDescription")}</p>
          <Link href="/portal/quotes" className="text-sm font-medium text-brand-600 hover:underline">
            {t("quotesCardLink")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
