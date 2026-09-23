import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import type { AppLocale } from "@/i18n/routing";
import { PageBlocks, type PageBlock } from "@/components/marketing/page-blocks";

async function getAboutTranslation(locale: string) {
  return prisma.pageTranslation.findFirst({
    where: { locale, isPublished: true, parent: { key: "about" } },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: AppLocale };
  const translation = await getAboutTranslation(locale);
  if (!translation) return {};

  const publishedLocales = await prisma.pageTranslation.findMany({
    where: { isPublished: true, parent: { key: "about" } },
    select: { locale: true },
  });
  const alternates = Object.fromEntries(publishedLocales.map(({ locale: loc }) => [loc, "/about"]));

  return {
    title: translation.seoTitle ?? translation.title,
    description: translation.seoDescription ?? undefined,
    alternates: {
      canonical: absoluteUrl(`/${locale}/about`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: AppLocale };
  setRequestLocale(locale);
  const translation = await getAboutTranslation(locale);
  if (!translation) notFound();

  return (
    <>
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{translation.title}</h1>
          <PageBlocks blocks={(translation.blocks as PageBlock[] | null) ?? []} />
        </article>
      </main>
    </>
  );
}
