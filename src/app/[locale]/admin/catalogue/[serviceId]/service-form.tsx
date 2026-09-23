"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updateServiceAction } from "../actions";

type TranslationState = { name: string; slug: string; shortDescription: string; isPublished: boolean };
type Translations = { fr: TranslationState; en: TranslationState; ar: TranslationState };

export function ServiceForm({
  serviceId,
  initialIsActive,
  initialTranslations,
}: {
  serviceId: string;
  initialIsActive: boolean;
  initialTranslations: Translations;
}) {
  const t = useTranslations("admin.catalog");
  const router = useRouter();

  const [isActive, setIsActive] = useState(initialIsActive);
  const [translations, setTranslations] = useState(initialTranslations);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateLocale(locale: keyof Translations, patch: Partial<TranslationState>) {
    setTranslations((previous) => ({ ...previous, [locale]: { ...previous[locale], ...patch } }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const result = await updateServiceAction({
      serviceId,
      isActive,
      translations: {
        fr: { ...translations.fr, shortDescription: translations.fr.shortDescription || null },
        en: { ...translations.en, shortDescription: translations.en.shortDescription || null },
        ar: { ...translations.ar, shortDescription: translations.ar.shortDescription || null },
      },
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        {t("isActive")}
      </label>

      {(["fr", "en", "ar"] as const).map((locale) => (
        <fieldset key={locale} className="flex flex-col gap-3 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">
            {t("translationsFor", { locale: locale.toUpperCase() })}
          </legend>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${locale}-name`} className="text-sm font-medium text-foreground">
              {t("name")}
            </label>
            <input
              id={`${locale}-name`}
              type="text"
              dir={locale === "ar" ? "rtl" : "ltr"}
              value={translations[locale].name}
              onChange={(event) => updateLocale(locale, { name: event.target.value })}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${locale}-slug`} className="text-sm font-medium text-foreground">
              {t("slug")}
            </label>
            <input
              id={`${locale}-slug`}
              type="text"
              value={translations[locale].slug}
              onChange={(event) => updateLocale(locale, { slug: event.target.value })}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm ltr:text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${locale}-description`} className="text-sm font-medium text-foreground">
              {t("shortDescription")}
            </label>
            <textarea
              id={`${locale}-description`}
              dir={locale === "ar" ? "rtl" : "ltr"}
              rows={2}
              value={translations[locale].shortDescription}
              onChange={(event) => updateLocale(locale, { shortDescription: event.target.value })}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={translations[locale].isPublished}
              onChange={(event) => updateLocale(locale, { isPublished: event.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            {t("isPublished")}
          </label>
        </fieldset>
      ))}

      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-success-600">{t("saved")}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {t("save")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/catalogue")}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
