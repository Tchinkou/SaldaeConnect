import { getFormatter, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { reservationWhereClause } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ReservationStatus } from "@/generated/prisma/client";

const STATUS_TONE: Record<ReservationStatus, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  PENDING: "brand",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "reservation.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.bookings");
  const format = await getFormatter();
  const params = await searchParams;

  const where: Record<string, unknown> = { ...reservationWhereClause(currentUser, "reservation.read") };
  if (params.status) where.status = params.status;

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { service: { include: { translations: { where: { locale: "fr" } } } } },
  });

  const statuses: ReservationStatus[] = ["REQUESTED", "CONFIRMED", "PENDING", "COMPLETED", "CANCELLED"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <Link href="/admin/bookings/availability" className="text-sm font-medium text-brand-600 hover:underline">
          {t("manageAvailability")}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/bookings"
          className={`rounded-full px-3 py-1 text-xs font-medium ${!params.status ? "bg-brand-600 text-white" : "bg-surface text-foreground/70 border border-border"}`}
        >
          {t("statusAll")}
        </Link>
        {statuses.map((status) => (
          <Link
            key={status}
            href={{ pathname: "/admin/bookings", query: { status } }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${params.status === status ? "bg-brand-600 text-white" : "bg-surface text-foreground/70 border border-border"}`}
          >
            {t(`statusValue.${status}`)}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs font-medium text-foreground/70">
              <tr>
                <th className="px-4 py-3">{t("number")}</th>
                <th className="px-4 py-3">{t("service")}</th>
                <th className="px-4 py-3">{t("contact")}</th>
                <th className="px-4 py-3">{t("when")}</th>
                <th className="px-4 py-3">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => {
                const contact = reservation.contact as { firstName?: string; lastName?: string; email?: string };
                return (
                  <tr key={reservation.id} className="border-b border-border last:border-0 hover:bg-background">
                    <td className="px-4 py-3">
                      <Link href={`/admin/bookings/${reservation.id}`} className="font-medium text-brand-600 hover:underline">
                        {reservation.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{reservation.service.translations[0]?.name ?? reservation.service.id}</td>
                    <td className="px-4 py-3">
                      {contact.firstName} {contact.lastName}
                      <div className="text-xs text-foreground/70">{contact.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {reservation.startsAt
                        ? format.dateTime(reservation.startsAt, { dateStyle: "medium", timeStyle: "short" })
                        : reservation.preferredFrom
                          ? `${format.dateTime(reservation.preferredFrom, { dateStyle: "medium" })} — ${reservation.preferredTo ? format.dateTime(reservation.preferredTo, { dateStyle: "medium" }) : ""}`
                          : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[reservation.status]}>{t(`statusValue.${reservation.status}`)}</Badge>
                    </td>
                  </tr>
                );
              })}
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-foreground/70">
                    {t("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
