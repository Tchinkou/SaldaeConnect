"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale, useFormatter } from "next-intl";
import { Button } from "@/components/ui/button";
import type { BookingConfig } from "@/server/core/booking/config";
import { createReservationAction, listPublicAvailableSlotsAction } from "@/server/core/booking/reservation-public-actions";

type Slot = { start: string; end: string; remaining: number };

export function BookingWidget({ serviceId, config }: { serviceId: string; config: BookingConfig }) {
  const t = useTranslations("public.booking");
  const locale = useLocale();
  const format = useFormatter();

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [preferredFrom, setPreferredFrom] = useState("");
  const [preferredTo, setPreferredTo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [website, setWebsite] = useState("");
  const [renderedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedNumber, setConfirmedNumber] = useState<string | null>(null);

  useEffect(() => {
    if (config.mode !== "AGENCY_SLOT") return;
    const from = new Date();
    const to = new Date(from.getTime() + config.maxAdvanceDays * 24 * 60 * 60 * 1000);
    listPublicAvailableSlotsAction({
      serviceId,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    }).then((result) => {
      if (result.ok) setSlots(result.data);
    });
  }, [serviceId, config.mode, config.maxAdvanceDays]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await createReservationAction({
      locale: locale as "fr" | "en" | "ar",
      serviceId,
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      documentNumber: documentNumber || undefined,
      notes: notes || undefined,
      startsAt: config.mode === "AGENCY_SLOT" && selectedSlot ? selectedSlot : undefined,
      preferredFrom: config.mode === "EXTERNAL_APPOINTMENT" ? preferredFrom || undefined : undefined,
      preferredTo: config.mode === "EXTERNAL_APPOINTMENT" ? preferredTo || undefined : undefined,
      files: [],
      privacyAccepted: privacyAccepted as true,
      website,
      renderedAt,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmedNumber(result.data.number);
  }

  if (confirmedNumber) {
    return (
      <div className="mt-12 rounded-lg border border-success-200 bg-success-50 p-6">
        <p className="font-medium text-success-700">{t("confirmed", { number: confirmedNumber })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-12 flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-foreground">{t("title")}</h2>

      {config.fee ? <p className="text-sm text-ink-500">{t("fee", { amount: format.number(config.fee / 100, { style: "currency", currency: "DZD" }) })}</p> : null}

      {config.requiredDocuments.length > 0 ? (
        <div className="rounded-md bg-background p-3 text-sm text-ink-500">
          <p className="font-medium text-foreground">{t("requiredDocuments")}</p>
          <ul className="mt-1 list-inside list-disc">
            {config.requiredDocuments.map((doc) => (
              <li key={doc}>{doc}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {config.mode === "AGENCY_SLOT" ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t("chooseSlot")}</label>
          {slots === null ? (
            <p className="text-sm text-foreground/50">{t("loadingSlots")}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-foreground/50">{t("noSlots")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.slice(0, 30).map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => setSelectedSlot(slot.start)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${selectedSlot === slot.start ? "border-brand-600 bg-brand-100 text-brand-700" : "border-border bg-surface text-foreground"}`}
                >
                  {format.dateTime(new Date(slot.start), { dateStyle: "short", timeStyle: "short" })}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="preferred-from" className="text-sm font-medium text-foreground">
              {t("preferredFrom")}
            </label>
            <input id="preferred-from" type="date" dir="ltr" value={preferredFrom} onChange={(e) => setPreferredFrom(e.target.value)} required className="h-10 rounded-md border border-border bg-surface px-3 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="preferred-to" className="text-sm font-medium text-foreground">
              {t("preferredTo")}
            </label>
            <input id="preferred-to" type="date" dir="ltr" value={preferredTo} onChange={(e) => setPreferredTo(e.target.value)} required className="h-10 rounded-md border border-border bg-surface px-3 text-sm" />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="booking-first-name" className="text-sm font-medium text-foreground">
            {t("firstName")}
          </label>
          <input id="booking-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-10 rounded-md border border-border bg-surface px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="booking-last-name" className="text-sm font-medium text-foreground">
            {t("lastName")}
          </label>
          <input id="booking-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="h-10 rounded-md border border-border bg-surface px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="booking-email" className="text-sm font-medium text-foreground">
            {t("email")}
          </label>
          <input id="booking-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10 rounded-md border border-border bg-surface px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="booking-phone" className="text-sm font-medium text-foreground">
            {t("phone")}
          </label>
          <input id="booking-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="booking-document-number" className="text-sm font-medium text-foreground">
          {t("documentNumber")}
        </label>
        <input id="booking-document-number" dir="ltr" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="booking-notes" className="text-sm font-medium text-foreground">
          {t("notes")}
        </label>
        <textarea id="booking-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
      </div>

      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px]"
        aria-hidden="true"
      />

      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
        {t("privacyAccepted")}
      </label>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <div>
        <Button type="submit" isLoading={submitting} disabled={config.mode === "AGENCY_SLOT" && !selectedSlot}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
