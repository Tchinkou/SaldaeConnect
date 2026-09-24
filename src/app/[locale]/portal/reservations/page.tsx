import { getFormatter, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReservationStatus } from "@/generated/prisma/client";

const STATUS_TONE: Record<ReservationStatus, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  PENDING: "brand",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

/** Réservations du client (§16, §D.5) — rattachées par correspondance d'email à la création, jamais créées ici. */
export default async function PortalReservationsPage() {
  const currentUser = await getCurrentUser();
  const t = await getTranslations("portal.reservations");
  const format = await getFormatter();

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  const reservations = contact
    ? await prisma.reservation.findMany({
        where: { clientId: contact.clientId },
        orderBy: { createdAt: "desc" },
        include: { service: { include: { translations: { where: { locale: "fr" } } } } },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-foreground/60">{t("subtitle")}</p>
      </div>

      {reservations.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reservations.map((reservation) => (
            <Card key={reservation.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="text-xs font-medium text-brand-600">{reservation.number}</p>
                  <p className="text-sm font-semibold text-foreground">{reservation.service.translations[0]?.name}</p>
                  <p className="text-xs text-foreground/70">
                    {reservation.startsAt
                      ? format.dateTime(reservation.startsAt, { dateStyle: "medium", timeStyle: "short" })
                      : reservation.preferredFrom
                        ? `${format.dateTime(reservation.preferredFrom, { dateStyle: "medium" })} — ${reservation.preferredTo ? format.dateTime(reservation.preferredTo, { dateStyle: "medium" }) : ""}`
                        : reservation.externalAppointmentAt
                          ? format.dateTime(reservation.externalAppointmentAt, { dateStyle: "medium", timeStyle: "short" })
                          : "—"}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[reservation.status]}>{t(`statusValue.${reservation.status}`)}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
