import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityManager } from "./availability-manager";

export default async function AvailabilityPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "reservation.write")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.availability");

  const services = await prisma.service.findMany({
    where: { fulfillmentType: "BOOKING" },
    include: { translations: { where: { locale: "fr" } } },
    orderBy: { order: "asc" },
  });

  const exceptions = await prisma.availabilityException.findMany({ orderBy: { date: "desc" }, take: 100 });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityManager
            services={services.map((service) => ({ id: service.id, name: service.translations[0]?.name ?? service.id }))}
            initialExceptions={exceptions.map((exception) => ({
              id: exception.id,
              date: exception.date.toISOString().slice(0, 10),
              startTime: exception.startTime,
              endTime: exception.endTime,
              type: exception.type,
              reason: exception.reason,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
