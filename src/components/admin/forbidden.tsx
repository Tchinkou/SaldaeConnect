import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Rendue par une page admin quand l'utilisateur est bien membre de l'équipe
 * (passe la garde de `admin/layout.tsx`) mais n'a pas la permission requise
 * pour cette section — le menu la masque déjà, mais §H.2 impose que chaque
 * page revérifie côté serveur plutôt que de faire confiance au menu.
 */
export async function Forbidden() {
  const t = await getTranslations("admin.forbidden");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground/70">{t("body")}</p>
      </CardContent>
    </Card>
  );
}
