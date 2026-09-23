import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { ServiceForm } from "./service-form";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) {
    return <Forbidden />;
  }

  const { serviceId } = await params;
  const t = await getTranslations("admin.catalog");

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { translations: true },
  });

  if (!service) {
    notFound();
  }

  const byLocale = Object.fromEntries(service.translations.map((translation) => [translation.locale, translation]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {t("editService", { name: byLocale.fr?.name ?? service.id })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ServiceForm
          serviceId={service.id}
          initialIsActive={service.isActive}
          initialTranslations={{
            fr: {
              name: byLocale.fr?.name ?? "",
              slug: byLocale.fr?.slug ?? "",
              shortDescription: byLocale.fr?.shortDescription ?? "",
              isPublished: byLocale.fr?.isPublished ?? false,
            },
            en: {
              name: byLocale.en?.name ?? "",
              slug: byLocale.en?.slug ?? "",
              shortDescription: byLocale.en?.shortDescription ?? "",
              isPublished: byLocale.en?.isPublished ?? false,
            },
            ar: {
              name: byLocale.ar?.name ?? "",
              slug: byLocale.ar?.slug ?? "",
              shortDescription: byLocale.ar?.shortDescription ?? "",
              isPublished: byLocale.ar?.isPublished ?? false,
            },
          }}
        />
      </CardContent>
    </Card>
  );
}
