"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { submitContactMessageAction } from "@/app/[locale]/(public)/contact/actions";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const t = useTranslations("public.contact.form");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());

  if (status === "success") {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-success-600">{t("success")}</CardContent>
      </Card>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setStatus("submitting");
        setError(null);

        const formData = new FormData(event.currentTarget);
        const result = await submitContactMessageAction({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          message: String(formData.get("message") ?? ""),
          locale: locale as "fr" | "en" | "ar",
          website: String(formData.get("website") ?? ""),
          renderedAt,
        });

        if (result.ok) {
          setStatus("success");
        } else {
          setStatus("error");
          setError(
            result.error.includes("Trop de")
              ? t("errorTooManyRequests")
              : t("errorGeneric"),
          );
        }
      }}
    >
      {/* Piège à robots : champ invisible pour un humain, souvent rempli par un bot (§H.2). */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="sr-only"
        aria-hidden="true"
      />

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          {t("name")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          required
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-foreground">
          {t("message")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <Button type="submit" isLoading={status === "submitting"}>
        {t("submit")}
      </Button>
    </form>
  );
}
