"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { upsertPageAction } from "@/app/[locale]/admin/content/pages/actions";

type Block = { type: "heading" | "paragraph"; text: string };
type TranslationState = { title: string; slug: string; blocks: Block[]; seoTitle: string; seoDescription: string; isPublished: boolean };
type Translations = { fr: TranslationState; en: TranslationState; ar: TranslationState };

export function PageForm({
  id,
  isSystem,
  initialKey,
  initialTranslations,
}: {
  id: string | null;
  isSystem: boolean;
  initialKey: string;
  initialTranslations: Translations;
}) {
  const t = useTranslations("admin.content");
  const router = useRouter();

  const [key, setKey] = useState(initialKey);
  const [translations, setTranslations] = useState(initialTranslations);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLocale(locale: keyof Translations, patch: Partial<TranslationState>) {
    setTranslations((previous) => ({ ...previous, [locale]: { ...previous[locale], ...patch } }));
  }

  function addBlock(locale: keyof Translations, type: Block["type"]) {
    updateLocale(locale, { blocks: [...translations[locale].blocks, { type, text: "" }] });
  }

  function updateBlock(locale: keyof Translations, index: number, patch: Partial<Block>) {
    updateLocale(locale, {
      blocks: translations[locale].blocks.map((block, blockIndex) => (blockIndex === index ? { ...block, ...patch } : block)),
    });
  }

  function removeBlock(locale: keyof Translations, index: number) {
    updateLocale(locale, { blocks: translations[locale].blocks.filter((_, blockIndex) => blockIndex !== index) });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const toPayload = (translation: TranslationState) => ({
      title: translation.title,
      slug: translation.slug,
      blocks: translation.blocks,
      seoTitle: translation.seoTitle || null,
      seoDescription: translation.seoDescription || null,
      isPublished: translation.isPublished,
    });

    const result = await upsertPageAction({
      id,
      key: id ? null : key || null,
      translations: { fr: toPayload(translations.fr), en: toPayload(translations.en), ar: toPayload(translations.ar) },
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/content/pages");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {!id ? (
        <div className="flex flex-col gap-1.5 sm:w-64">
          <label className="text-sm font-medium text-foreground">{t("pages.key")}</label>
          <input
            type="text"
            dir="ltr"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={t("pages.keyPlaceholder")}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
          <p className="text-xs text-foreground/50">{t("pages.keyHint")}</p>
        </div>
      ) : isSystem ? (
        <p className="text-xs text-foreground/50" dir="ltr">
          {key}
        </p>
      ) : null}

      {(["fr", "en", "ar"] as const).map((locale) => (
        <fieldset key={locale} className="flex flex-col gap-3 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">{locale.toUpperCase()}</legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t("pages.pageTitle")}</label>
              <input
                type="text"
                dir={locale === "ar" ? "rtl" : "ltr"}
                value={translations[locale].title}
                onChange={(event) => updateLocale(locale, { title: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t("pages.slug")}</label>
              <input
                type="text"
                dir="ltr"
                value={translations[locale].slug}
                onChange={(event) => updateLocale(locale, { slug: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">{t("pages.content")}</label>
            {translations[locale].blocks.map((block, index) => (
              <div key={index} className="flex items-start gap-2">
                <select
                  value={block.type}
                  onChange={(event) => updateBlock(locale, index, { type: event.target.value as Block["type"] })}
                  className="h-10 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  <option value="heading">{t("pages.blockHeading")}</option>
                  <option value="paragraph">{t("pages.blockParagraph")}</option>
                </select>
                <textarea
                  dir={locale === "ar" ? "rtl" : "ltr"}
                  rows={block.type === "heading" ? 1 : 3}
                  value={block.text}
                  onChange={(event) => updateBlock(locale, index, { text: event.target.value })}
                  className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => removeBlock(locale, index)}>
                  {t("pages.removeBlock")}
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => addBlock(locale, "heading")}>
                {t("pages.addHeading")}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => addBlock(locale, "paragraph")}>
                {t("pages.addParagraph")}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t("pages.seoTitle")}</label>
              <input
                type="text"
                dir={locale === "ar" ? "rtl" : "ltr"}
                value={translations[locale].seoTitle}
                onChange={(event) => updateLocale(locale, { seoTitle: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t("pages.seoDescription")}</label>
              <input
                type="text"
                dir={locale === "ar" ? "rtl" : "ltr"}
                value={translations[locale].seoDescription}
                onChange={(event) => updateLocale(locale, { seoDescription: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
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

      <div className="flex gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {t("save")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/content/pages")}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
