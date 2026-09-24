import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getFormatter } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import type { AppLocale } from "@/i18n/routing";
import { PageBlocks, type PageBlock } from "@/components/marketing/page-blocks";

async function getBlogPost(locale: string, slug: string) {
  const translation = await prisma.blogPostTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: {
      parent: {
        include: { translations: true, category: { include: { translations: { where: { locale } } } }, tags: true },
      },
    },
  });
  if (!translation || translation.parent.status !== "PUBLISHED") return null;
  return translation;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  const translation = await getBlogPost(locale, slug);
  if (!translation) return {};

  const alternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.parent.translations) {
    alternates[other.locale as AppLocale] = `/blog/${other.slug}`;
  }

  return {
    title: translation.seoTitle ?? translation.title,
    description: translation.seoDescription ?? translation.excerpt ?? undefined,
    alternates: {
      canonical: absoluteUrl(`/${locale}/blog/${slug}`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  setRequestLocale(locale);
  const translation = await getBlogPost(locale, slug);
  if (!translation) notFound();

  const format = await getFormatter();
  const localeAlternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.parent.translations) {
    localeAlternates[other.locale as AppLocale] = `/blog/${other.slug}`;
  }

  return (
    <>
      <Header localeAlternates={localeAlternates} localeFallback="/blog" />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          {translation.parent.category?.translations[0]?.name ? (
            <p className="text-sm font-medium text-brand-600">{translation.parent.category.translations[0].name}</p>
          ) : null}
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{translation.title}</h1>
          {translation.parent.publishedAt ? (
            <p className="mt-2 text-sm text-foreground/70">{format.dateTime(translation.parent.publishedAt, { dateStyle: "long" })}</p>
          ) : null}
          <PageBlocks blocks={(translation.content as PageBlock[] | null) ?? []} />
          {translation.parent.tags.length > 0 ? (
            <ul className="mt-8 flex flex-wrap gap-2">
              {translation.parent.tags.map((tag) => (
                <li key={tag.id} className="rounded-full bg-surface-subtle px-3 py-1 text-xs text-foreground/70">
                  {tag.name}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </main>
    </>
  );
}
