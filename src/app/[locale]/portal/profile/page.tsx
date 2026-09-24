import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalProfileForm } from "@/app/[locale]/portal/profile/profile-form";
import { ChangePasswordForm } from "@/app/[locale]/portal/profile/change-password-form";

/** Profil client (§16) : coordonnées de contact + changement de mot de passe. */
export default async function PortalProfilePage() {
  const currentUser = await getCurrentUser();
  const t = await getTranslations("portal.profile");

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("form.heading")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalProfileForm
            initialFirstName={contact?.firstName ?? ""}
            initialLastName={contact?.lastName ?? ""}
            initialPhone={contact?.phone ?? ""}
            initialJobTitle={contact?.jobTitle ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("password.heading")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
