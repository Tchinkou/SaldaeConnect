"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { upsertBlogPostAction } from "@/app/[locale]/admin/content/blog/actions";

type Block = { type: "heading" | "paragraph"; text: string };
type TranslationState = { title: string; slug: string; excerpt: string; content: Block[]; seoTitle: string; seoDescription: string };
type Translations = { fr: TranslationState; en: TranslationState; ar: TranslationState };
type Status = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export function BlogPostForm({
  id,
  initialCategoryName,
  initialTagNames,
  initialStatus,
  initialPublishedAt,
  initialTranslations,
}: {
  id: string | null;
  initialCategoryName: string;
  initialTagNames: string[];
  initialStatus: Status;
  initialPublishedAt: string;
  initialTranslations: Translations;
}) {
  const t = useTranslations("admin.content");
  const router = useRouter();

  const [categoryName, setCategoryName] = useState(initialCategoryName);
  const [tagsText, setTagsText] = useState(initialTagNames.join(", "));
  const [status, setStatus] = useState<Status>(initialStatus);
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [translations, setTranslations] = useState(initialTranslations);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLocale(locale: keyof Translations, patch: Partial<TranslationState>) {
    setTranslations((previous) => ({ ...previous, [locale]: { ...previous[locale], ...patch } }));
  }

  function addBlock(locale: keyof Translations, type: Block["type"]) {
    updateLocale(locale, { content: [...translations[locale].content, { type, text: "" }] });
  }
  function updateBlock(locale: keyof Translations, index: number, patch: Partial<Block>) {
    updateLocale(locale, {
      content: translations[locale].content.map((block, blockIndex) => (blockIndex === index ? { ...block, ...patch } : block)),
    });
  }
  function removeBlock(locale: keyof Translations, index: number) {
    updateLocale(locale, { content: translations[locale].content.filter((_, blockIndex) => blockIndex !== index) });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const toPayload = (translation: TranslationState) => ({
      title: translation.title,
      slug: translation.slug,
      excerpt: translation.excerpt || null,
      content: translation.content,
      seoTitle: translation.seoTitle || null,
      seoDescription: translation.seoDescription || null,
    });

    const result = await upsertBlogPostAction({
      id,
      categoryName: categoryName.trim() || null,
      tagNames: tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      status,
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
      translations: { fr: toPayload(translations.fr), en: toPayload(translations.en), ar: toPayload(translations.ar) },
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/content/blog");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="blog-category" className="text-sm font-medium text-foreground">{t("blog.category")}</label>
          <input
            id="blog-category"
            type="text"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="blog-tags" className="text-sm font-medium text-foreground">{t("blog.tags")}</label>
          <input
            id="blog-tags"
            type="text"
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder={t("blog.tagsPlaceholder")}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="blog-status" className="text-sm font-medium text-foreground">{t("blog.status")}</label>
          <select
            id="blog-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as Status)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          >
            <option value="DRAFT">{t("blog.statusValue.DRAFT")}</option>
            <option value="SCHEDULED">{t("blog.statusValue.SCHEDULED")}</option>
            <option value="PUBLISHED">{t("blog.statusValue.PUBLISHED")}</option>
            <option value="ARCHIVED">{t("blog.statusValue.ARCHIVED")}</option>
          </select>
        </div>
      </div>

      {status === "SCHEDULED" ? (
        <div className="flex flex-col gap-1.5 sm:w-64">
          <label htmlFor="blog-published-at" className="text-sm font-medium text-foreground">{t("blog.publishedAt")}</label>
          <input
            id="blog-published-at"
            type="datetime-local"
            dir="ltr"
            value={publishedAt}
            onChange={(event) => setPublishedAt(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
      ) : null}

      {(["fr", "en", "ar"] as const).map((locale) => (
        <fieldset key={locale} className="flex flex-col gap-3 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">{locale.toUpperCase()}</legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`blog-title-${locale}`} className="text-sm font-medium text-foreground">{t("blog.postTitle")}</label>
              <input
                id={`blog-title-${locale}`}
                type="text"
                dir={locale === "ar" ? "rtl" : "ltr"}
                value={translations[locale].title}
                onChange={(event) => updateLocale(locale, { title: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`blog-slug-${locale}`} className="text-sm font-medium text-foreground">{t("blog.slug")}</label>
              <input
                id={`blog-slug-${locale}`}
                type="text"
                dir="ltr"
                value={translations[locale].slug}
                onChange={(event) => updateLocale(locale, { slug: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`blog-excerpt-${locale}`} className="text-sm font-medium text-foreground">{t("blog.excerpt")}</label>
            <textarea
              id={`blog-excerpt-${locale}`}
              dir={locale === "ar" ? "rtl" : "ltr"}
              rows={2}
              value={translations[locale].excerpt}
              onChange={(event) => updateLocale(locale, { excerpt: event.target.value })}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={`blog-content-${locale}`} className="text-sm font-medium text-foreground">{t("pages.content")}</label>
            {translations[locale].content.map((block, index) => (
              <div key={index} className="flex items-start gap-2">
                <select
                  id={index === 0 ? `blog-content-${locale}` : undefined}
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
              <label htmlFor={`blog-seo-title-${locale}`} className="text-sm font-medium text-foreground">{t("pages.seoTitle")}</label>
              <input
                id={`blog-seo-title-${locale}`}
                type="text"
                dir={locale === "ar" ? "rtl" : "ltr"}
                value={translations[locale].seoTitle}
                onChange={(event) => updateLocale(locale, { seoTitle: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`blog-seo-description-${locale}`} className="text-sm font-medium text-foreground">{t("pages.seoDescription")}</label>
              <input
                id={`blog-seo-description-${locale}`}
                type="text"
                dir={locale === "ar" ? "rtl" : "ltr"}
                value={translations[locale].seoDescription}
                onChange={(event) => updateLocale(locale, { seoDescription: event.target.value })}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
          </div>
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
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/content/blog")}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
