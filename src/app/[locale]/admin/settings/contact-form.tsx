"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { updateSettingAction, type ContactSettingValue } from "./actions";

export function ContactForm({ initial }: { initial: ContactSettingValue }) {
  const t = useTranslations("admin.settings");
  const [contact, setContact] = useState(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const result = await updateSettingAction({ key: "contact", value: contact });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="contact-email" label={t("contact.email")} required>
          <input
            id="contact-email"
            type="email"
            required
            value={contact.email}
            onChange={(event) => setContact({ ...contact, email: event.target.value })}
            className={inputClass}
          />
        </Field>
        <Field id="contact-phone" label={t("contact.phone")}>
          <input
            id="contact-phone"
            type="text"
            value={contact.phone ?? ""}
            onChange={(event) => setContact({ ...contact, phone: event.target.value || null })}
            className={inputClass}
          />
        </Field>
        <Field id="contact-address" label={t("contact.address")}>
          <input
            id="contact-address"
            type="text"
            value={contact.address ?? ""}
            onChange={(event) => setContact({ ...contact, address: event.target.value || null })}
            className={inputClass}
          />
        </Field>
        <Field id="contact-city" label={t("contact.city")}>
          <input
            id="contact-city"
            type="text"
            value={contact.city ?? ""}
            onChange={(event) => setContact({ ...contact, city: event.target.value || null })}
            className={inputClass}
          />
        </Field>
        <Field id="contact-country" label={t("contact.country")}>
          <input
            id="contact-country"
            type="text"
            maxLength={2}
            placeholder="DZ"
            value={contact.country ?? ""}
            onChange={(event) => setContact({ ...contact, country: event.target.value.toUpperCase() || null })}
            className={inputClass}
          />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-success-600">{t("saved")}</p> : null}

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}

const inputClass =
  "h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}
