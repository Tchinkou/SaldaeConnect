import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard");
  const currentUser = await getCurrentUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-foreground">{t("welcome", { name: currentUser?.user.name ?? "" })}</p>
        <p className="text-sm text-foreground/70">{t("phaseNotice")}</p>
      </CardContent>
    </Card>
  );
}
