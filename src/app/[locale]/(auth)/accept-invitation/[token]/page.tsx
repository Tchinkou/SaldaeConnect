import { createHash } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInvitationForm } from "./accept-invitation-form";

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("auth.acceptInvitation");

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });
  const isValid = Boolean(invitation) && !invitation!.acceptedAt && invitation!.expiresAt > new Date();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        {isValid ? (
          <p className="mt-1 text-sm text-foreground/70">{t("subtitle", { email: invitation!.email })}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        {isValid ? (
          <AcceptInvitationForm token={token} />
        ) : (
          <p role="alert" className="text-sm text-danger-600">
            {t("errorInvalid")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
