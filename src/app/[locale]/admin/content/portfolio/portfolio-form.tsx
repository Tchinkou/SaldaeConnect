"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { upsertPortfolioProjectAction } from "@/app/[locale]/admin/content/portfolio/actions";

type TranslationState = {
  title: string;
  slug: string;
  summary: string;
  problem: string;
  solution: string;
  execution: string;
  result: string;
};
type Translations = { fr: TranslationState; en: TranslationState; ar: TranslationState };

export function PortfolioForm({
  id,
  initialClientName,
  initialIsFeatured,
  initialIsPublished,
  initialOrder,
  initialTranslations,
}: {
  id: string | null;
  initialClientName: string;
  initialIsFeatured: boolean;
  initialIsPublished: boolean;
  initialOrder: number;
  initialTranslations: Translations;
}) {
  const t = useTranslations("admin.content");
  const router = useRouter();

  const [clientName, setClientName] = useState(initialClientName);
  const [isFeatured, setIsFeatured] = useState(initialIsFeatured);
  const [isPublished, setIsPublished] = useState(initialIsPublished);
  const [order, setOrder] = useState(initialOrder);
  const [translations, setTranslations] = useState(initialTranslations);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLocale(locale: keyof Translations, patch: Partial<TranslationState>) {
    setTranslations((previous) => ({ ...previous, [locale]: { ...previous[locale], ...patch } }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const toNullable = (t: TranslationState) => ({
      title: t.title,
      slug: t.slug,
      summary: t.summary || null,
      problem: t.problem || null,
      solution: t.solution || null,
      execution: t.execution || null,
      result: t.result || null,
    });

    const result = await upsertPortfolioProjectAction({
      id,
      clientName: clientName || null,
      isFeatured,
      isPublished,
      order,
      translations: {
        fr: toNullable(translations.fr),
        en: toNullable(translations.en),
        ar: toNullable(translations.ar),
      },
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/content/portfolio");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t("portfolio.clientName")}</label>
          <input
            type="text"
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t("order")}</label>
          <input
            type="number"
            min={0}
            dir="ltr"
            value={order}
            onChange={(event) => setOrder(Number(event.target.value))}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(event) => setIsFeatured(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          {t("portfolio.isFeatured")}
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(event) => setIsPublished(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          {t("isPublished")}
        </label>
      </div>

      {(["fr", "en", "ar"] as const).map((locale) => (
        <fieldset key={locale} className="flex flex-col gap-3 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">{locale.toUpperCase()}</legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t("portfolio.projectTitle")}</label>
              <input
                type="text"
                dir={locale === "ar" ? "rtl" : "ltr"}
                value={translations[locale].title}
                onChange={(event) => updateLocale(locale, { title: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t("portfolio.slug")}</label>
              <input
                type="text"
                dir="ltr"
                value={translations[locale].slug}
                onChange={(event) => updateLocale(locale, { slug: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
          </div>

          {(["summary", "problem", "solution", "execution", "result"] as const).map((field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t(`portfolio.${field}`)}</label>
              <textarea
                dir={locale === "ar" ? "rtl" : "ltr"}
                rows={2}
                value={translations[locale][field]}
                onChange={(event) => updateLocale(locale, { [field]: event.target.value })}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>
          ))}
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
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/content/portfolio")}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
