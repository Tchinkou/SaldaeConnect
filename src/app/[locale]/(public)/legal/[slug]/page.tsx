import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import type { AppLocale } from "@/i18n/routing";
import { PageBlocks, type PageBlock } from "@/components/marketing/page-blocks";

async function getLegalPage(locale: string, slug: string) {
  const translation = await prisma.pageTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: { parent: { include: { translations: true } } },
  });
  if (!translation || !translation.isPublished) return null;
  return translation;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  const translation = await getLegalPage(locale, slug);
  if (!translation) return {};

  const alternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.parent.translations) {
    if (other.isPublished) alternates[other.locale as AppLocale] = `/legal/${other.slug}`;
  }

  return {
    title: translation.seoTitle ?? translation.title,
    description: translation.seoDescription ?? undefined,
    // Textes en attente de validation juridique : pas d'indexation tant qu'ils ne sont pas confirmés (§K.2).
    robots: translation.needsLegalReview ? { index: false } : undefined,
    alternates: {
      canonical: absoluteUrl(`/${locale}/legal/${slug}`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  setRequestLocale(locale);
  const translation = await getLegalPage(locale, slug);
  if (!translation) notFound();

  const t = await getTranslations("public.legal");

  const localeAlternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.parent.translations) {
    if (other.isPublished) localeAlternates[other.locale as AppLocale] = `/legal/${other.slug}`;
  }

  return (
    <>
      <Header localeAlternates={localeAlternates} localeFallback="/" />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{translation.title}</h1>

          {translation.needsLegalReview ? (
            <Card className="mt-6 border-warning-100 bg-warning-100/40">
              <CardContent className="pt-4 text-sm text-warning-600">{t("provisionalNotice")}</CardContent>
            </Card>
          ) : null}

          <PageBlocks blocks={(translation.blocks as PageBlock[] | null) ?? []} />
        </article>
      </main>
    </>
  );
}
