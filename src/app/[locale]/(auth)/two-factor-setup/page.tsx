import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/core/authz/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { TwoFactorSetupForm } from "@/app/[locale]/(auth)/two-factor-setup/two-factor-setup-form";

/**
 * §H.2 : 2FA obligatoire pour le staff/admin. Cette page vit hors de la
 * coquille /admin (pas de garde 2FA dans son propre arbre) pour que
 * `admin/layout.tsx` puisse y rediriger un utilisateur staff sans 2FA sans
 * provoquer de boucle de redirection.
 */
export default async function TwoFactorSetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return redirect({ href: "/login", locale: locale as "fr" | "en" | "ar" });
  }
  if (currentUser.user.userType !== "STAFF") {
    return redirect({ href: "/portal", locale: locale as "fr" | "en" | "ar" });
  }
  if (currentUser.user.twoFactorEnabled) {
    return redirect({ href: "/admin", locale: locale as "fr" | "en" | "ar" });
  }

  const t = await getTranslations("auth.twoFactorSetup");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        <TwoFactorSetupForm />
      </CardContent>
    </Card>
  );
}
