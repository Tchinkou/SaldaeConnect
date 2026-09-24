import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import type { AppLocale } from "@/i18n/routing";
import { PageBlocks, type PageBlock } from "@/components/marketing/page-blocks";

/** Pages libres (§30, §49) — les pages système (à propos, mentions légales…) restent sur leurs routes dédiées. */
async function getFreePage(locale: string, slug: string) {
  const translation = await prisma.pageTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: { parent: { include: { translations: true } } },
  });
  if (!translation || !translation.isPublished || translation.parent.isSystem) return null;
  return translation;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  const translation = await getFreePage(locale, slug);
  if (!translation) return {};

  const alternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.parent.translations) {
    if (other.isPublished) alternates[other.locale as AppLocale] = `/pages/${other.slug}`;
  }

  return {
    title: translation.seoTitle ?? translation.title,
    description: translation.seoDescription ?? undefined,
    alternates: {
      canonical: absoluteUrl(`/${locale}/pages/${slug}`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function FreePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  setRequestLocale(locale);
  const translation = await getFreePage(locale, slug);
  if (!translation) notFound();

  const localeAlternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.parent.translations) {
    if (other.isPublished) localeAlternates[other.locale as AppLocale] = `/pages/${other.slug}`;
  }

  return (
    <>
      <Header localeAlternates={localeAlternates} localeFallback="/" />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{translation.title}</h1>
          <PageBlocks blocks={(translation.blocks as PageBlock[] | null) ?? []} />
        </article>
      </main>
    </>
  );
}
