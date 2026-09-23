import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";

const SECTIONS = ["keyFigures", "testimonials", "portfolio"] as const;

export default async function ContentHubPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const t = await getTranslations("admin.content");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("hubTitle")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("hubSubtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link key={section} href={`/admin/content/${toKebab(section)}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <CardTitle>{t(`${section}.title`)}</CardTitle>
                <p className="mt-2 text-sm text-foreground/70">{t(`${section}.subtitle`)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function toKebab(section: string) {
  return section.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
