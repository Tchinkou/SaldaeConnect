"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updateReservationStatusAction } from "@/server/core/booking/reservation-admin-actions";

const STATUSES = ["REQUESTED", "CONFIRMED", "PENDING", "COMPLETED", "CANCELLED"] as const;
type StatusValue = (typeof STATUSES)[number];

export function ReservationStatusControl({
  reservationId,
  currentStatus,
  isExternalAppointment,
}: {
  reservationId: string;
  currentStatus: StatusValue;
  isExternalAppointment: boolean;
}) {
  const t = useTranslations("admin.bookings.detail");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<StatusValue>(currentStatus);
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [externalAppointmentAt, setExternalAppointmentAt] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-brand-600 hover:underline">
        {t("changeStatus")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value as StatusValue)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
      >
        {STATUSES.map((option) => (
          <option key={option} value={option}>
            {t(`statusValue.${option}`)}
          </option>
        ))}
      </select>

      {status === "CANCELLED" ? (
        <input
          type="text"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          placeholder={t("cancelReasonPlaceholder")}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        />
      ) : null}

      {isExternalAppointment && status === "CONFIRMED" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground/70">{t("externalAppointmentAt")}</label>
            <input
              type="datetime-local"
              dir="ltr"
              value={externalAppointmentAt}
              onChange={(event) => setExternalAppointmentAt(event.target.value)}
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
            />
          </div>
          <input
            type="text"
            value={externalReference}
            onChange={(event) => setExternalReference(event.target.value)}
            placeholder={t("externalReferencePlaceholder")}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          />
        </>
      ) : null}

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("statusNotePlaceholder")}
        rows={2}
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      />
      {error ? <p className="text-xs text-danger-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          isLoading={submitting}
          onClick={async () => {
            setSubmitting(true);
            setError(null);
            const result = await updateReservationStatusAction({
              reservationId,
              status,
              note: note || null,
              cancelReason: status === "CANCELLED" ? cancelReason || null : undefined,
              externalAppointmentAt: externalAppointmentAt ? new Date(externalAppointmentAt).toISOString() : undefined,
              externalReference: externalReference || undefined,
            });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setEditing(false);
            setNote("");
            router.refresh();
          }}
        >
          {t("confirmStatus")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={submitting}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
