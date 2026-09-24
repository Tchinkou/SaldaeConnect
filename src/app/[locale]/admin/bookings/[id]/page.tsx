import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { assertReservationAssigneeInScope } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseBookingConfig } from "@/server/core/booking/config";
import { decryptSensitiveFields } from "@/server/core/crypto";
import { ReservationStatusControl } from "./reservation-status-control";
import type { ReservationStatus } from "@/generated/prisma/client";

const STATUS_TONE: Record<ReservationStatus, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  PENDING: "brand",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "reservation.read")) {
    return <Forbidden />;
  }

  const { id } = await params;
  const t = await getTranslations("admin.bookings.detail");
  const format = await getFormatter();

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      service: { include: { translations: { where: { locale: "fr" } } } },
      statusChanges: { orderBy: { createdAt: "desc" }, take: 50 },
      files: { where: { status: "ACTIVE" } },
    },
  });
  if (!reservation) notFound();

  try {
    assertReservationAssigneeInScope(currentUser, "reservation.read", reservation.assignedToId);
  } catch {
    return <Forbidden />;
  }

  const config = parseBookingConfig(reservation.service.bookingConfig);
  const contact = reservation.contact as { firstName?: string; lastName?: string; email?: string; phone?: string | null };
  const answers = decryptSensitiveFields((reservation.answers as Record<string, unknown>) ?? {}, ["documentNumber"]) as {
    documentNumber?: string;
    notes?: string;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <p className="text-xs font-medium text-brand-600">{reservation.service.translations[0]?.name}</p>
              <CardTitle className="text-xl">{reservation.number}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={STATUS_TONE[reservation.status]}>{t(`statusValue.${reservation.status}`)}</Badge>
              </div>
            </div>
            <ReservationStatusControl
              reservationId={reservation.id}
              currentStatus={reservation.status}
              isExternalAppointment={config?.mode === "EXTERNAL_APPOINTMENT"}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-foreground/50">{t("contact")}</p>
              <p className="text-foreground">
                {contact.firstName} {contact.lastName} · {contact.email} {contact.phone ? `· ${contact.phone}` : ""}
              </p>
            </div>

            {config?.mode === "AGENCY_SLOT" && reservation.startsAt ? (
              <div>
                <p className="text-xs font-medium text-foreground/50">{t("slot")}</p>
                <p className="text-foreground">{format.dateTime(reservation.startsAt, { dateStyle: "full", timeStyle: "short" })}</p>
              </div>
            ) : null}

            {config?.mode === "EXTERNAL_APPOINTMENT" ? (
              <>
                <div>
                  <p className="text-xs font-medium text-foreground/50">{t("preferredPeriod")}</p>
                  <p className="text-foreground">
                    {reservation.preferredFrom ? format.dateTime(reservation.preferredFrom, { dateStyle: "medium" }) : "—"} —{" "}
                    {reservation.preferredTo ? format.dateTime(reservation.preferredTo, { dateStyle: "medium" }) : "—"}
                  </p>
                </div>
                {reservation.externalAppointmentAt ? (
                  <div>
                    <p className="text-xs font-medium text-foreground/50">{t("externalAppointmentAt")}</p>
                    <p className="text-foreground">{format.dateTime(reservation.externalAppointmentAt, { dateStyle: "full", timeStyle: "short" })}</p>
                  </div>
                ) : null}
                {reservation.externalReference ? (
                  <div>
                    <p className="text-xs font-medium text-foreground/50">{t("externalReference")}</p>
                    <p className="text-foreground">{reservation.externalReference}</p>
                  </div>
                ) : null}
              </>
            ) : null}

            {answers.documentNumber ? (
              <div>
                <p className="text-xs font-medium text-foreground/50">{t("documentNumber")}</p>
                <p className="text-foreground" dir="ltr">
                  {answers.documentNumber}
                </p>
              </div>
            ) : null}

            {answers.notes ? (
              <div>
                <p className="text-xs font-medium text-foreground/50">{t("notes")}</p>
                <p className="whitespace-pre-wrap text-foreground">{answers.notes}</p>
              </div>
            ) : null}

            {reservation.cancelReason ? (
              <div>
                <p className="text-xs font-medium text-foreground/50">{t("cancelReason")}</p>
                <p className="text-foreground">{reservation.cancelReason}</p>
              </div>
            ) : null}

            {reservation.files.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-foreground/50">{t("attachments")}</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {reservation.files.map((file) => (
                    <li key={file.id}>
                      <a href={`/api/files/${file.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                        📎 {file.originalName}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("historyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {reservation.statusChanges.map((change) => (
                <li key={change.id} className="border-b border-border pb-2 last:border-0">
                  <p className="font-medium text-foreground">
                    {change.fromStatus ? `${t(`statusValue.${change.fromStatus}`)} → ` : ""}
                    {t(`statusValue.${change.toStatus}`)}
                  </p>
                  <p className="text-xs text-foreground/50">{format.dateTime(change.createdAt, { dateStyle: "medium", timeStyle: "short" })}</p>
                  {change.note ? <p className="mt-1 text-foreground/80">{change.note}</p> : null}
                </li>
              ))}
              {reservation.statusChanges.length === 0 ? <p className="text-sm text-foreground/50">{t("noHistory")}</p> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
