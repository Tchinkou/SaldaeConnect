import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPortalNotificationPreferencesAction } from "@/app/[locale]/portal/settings/actions";
import { NotificationPreferences } from "@/app/[locale]/portal/settings/notification-preferences";

/** Paramètres client (§16) : préférences de notification par canal. */
export default async function PortalSettingsPage() {
  const t = await getTranslations("portal.settings");
  const result = await listPortalNotificationPreferencesAction({});
  const rows = result.ok ? result.data : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("notifications.heading")}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !result.ok ? (
            <p className="text-sm text-danger-600">{result.error}</p>
          ) : (
            <NotificationPreferences rows={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
