"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { upsertKeyFigureAction } from "@/app/[locale]/admin/content/key-figures/actions";

type TranslationState = { label: string };
type Translations = { fr: TranslationState; en: TranslationState; ar: TranslationState };

export function KeyFigureForm({
  id,
  initialValue,
  initialSuffix,
  initialOrder,
  initialIsActive,
  initialTranslations,
}: {
  id: string | null;
  initialValue: string;
  initialSuffix: string;
  initialOrder: number;
  initialIsActive: boolean;
  initialTranslations: Translations;
}) {
  const t = useTranslations("admin.content");
  const router = useRouter();

  const [value, setValue] = useState(initialValue);
  const [suffix, setSuffix] = useState(initialSuffix);
  const [order, setOrder] = useState(initialOrder);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [translations, setTranslations] = useState(initialTranslations);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLocale(locale: keyof Translations, label: string) {
    setTranslations((previous) => ({ ...previous, [locale]: { label } }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await upsertKeyFigureAction({
      id,
      value,
      suffix: suffix || null,
      order,
      isActive,
      translations,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/content/key-figures");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label={t("keyFigures.value")} value={value} onChange={setValue} dir="ltr" />
        <Field label={t("keyFigures.suffix")} value={suffix} onChange={setSuffix} dir="ltr" />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t("order")}</label>
          <input
            type="number"
            min={0}
            value={order}
            onChange={(event) => setOrder(Number(event.target.value))}
            dir="ltr"
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        {t("active")}
      </label>

      {(["fr", "en", "ar"] as const).map((locale) => (
        <fieldset key={locale} className="flex flex-col gap-3 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">{locale.toUpperCase()}</legend>
          <Field
            label={t("keyFigures.label")}
            value={translations[locale].label}
            onChange={(v) => updateLocale(locale, v)}
            dir={locale === "ar" ? "rtl" : "ltr"}
          />
        </fieldset>
      ))}

      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {t("save")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/content/key-figures")}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type="text"
        dir={dir}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
      />
    </div>
  );
}
