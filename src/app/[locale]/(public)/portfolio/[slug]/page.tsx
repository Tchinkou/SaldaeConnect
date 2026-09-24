import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getFormatter } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import type { AppLocale } from "@/i18n/routing";

async function getProject(locale: string, slug: string) {
  const translation = await prisma.portfolioProjectTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: {
      parent: {
        include: {
          translations: true,
          sector: { include: { translations: { where: { locale } } } },
          technologies: true,
        },
      },
    },
  });
  if (!translation || !translation.parent.isPublished) return null;
  return translation;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  const translation = await getProject(locale, slug);
  if (!translation) return {};

  const alternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.parent.translations) {
    alternates[other.locale as AppLocale] = `/portfolio/${other.slug}`;
  }

  return {
    title: translation.seoTitle ?? translation.title,
    description: translation.seoDescription ?? translation.summary ?? undefined,
    alternates: {
      canonical: absoluteUrl(`/${locale}/portfolio/${slug}`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  setRequestLocale(locale);
  const translation = await getProject(locale, slug);
  if (!translation) notFound();
  const format = await getFormatter();

  const localeAlternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.parent.translations) {
    localeAlternates[other.locale as AppLocale] = `/portfolio/${other.slug}`;
  }

  return (
    <>
      <Header localeAlternates={localeAlternates} localeFallback="/portfolio" />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{translation.title}</h1>
          {translation.parent.sector?.translations[0] ? (
            <p className="mt-2 text-sm text-ink-500">{translation.parent.sector.translations[0].name}</p>
          ) : null}
          {translation.parent.date ? (
            <p className="mt-1 text-xs text-foreground/50">{format.dateTime(translation.parent.date, { dateStyle: "long" })}</p>
          ) : null}
          {translation.summary ? <p className="mt-4 text-lg text-ink-500">{translation.summary}</p> : null}

          {[
            ["problem", translation.problem],
            ["solution", translation.solution],
            ["execution", translation.execution],
            ["result", translation.result],
          ].map(([key, text]) =>
            text ? (
              <p key={key} className="mt-4 text-foreground">
                {text}
              </p>
            ) : null,
          )}

          {translation.parent.technologies.length > 0 ? (
            <ul className="mt-8 flex flex-wrap gap-2">
              {translation.parent.technologies.map((tech) => (
                <li key={tech.id} className="rounded-full bg-surface-subtle px-3 py-1 text-xs text-foreground/70">
                  {tech.name}
                </li>
              ))}
            </ul>
          ) : null}

          {translation.parent.url ? (
            <p className="mt-6">
              <a href={translation.parent.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-600 hover:underline">
                {translation.parent.url}
              </a>
            </p>
          ) : null}
        </article>
      </main>
    </>
  );
}
