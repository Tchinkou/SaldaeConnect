import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";
import { ArrowIcon } from "@/components/icons/arrow-icon";
import { PageBlocks, type PageBlock } from "@/components/marketing/page-blocks";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import type { AppLocale } from "@/i18n/routing";
import { parseBookingConfig } from "@/server/core/booking/config";
import { BookingWidget } from "./booking-widget";

async function getService(locale: string, slug: string) {
  const translation = await prisma.serviceTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    include: {
      service: {
        include: {
          translations: true,
          faqs: {
            where: { isActive: true },
            orderBy: { order: "asc" },
            include: { translations: { where: { locale } } },
          },
        },
      },
    },
  });

  // TRANSACTION exclu : module interne uniquement tant que le cadre légal n'est pas validé (§D.6).
  if (!translation || !translation.isPublished || !translation.service.isActive || translation.service.fulfillmentType === "TRANSACTION") {
    return null;
  }
  return translation;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  const translation = await getService(locale, slug);
  if (!translation) return {};

  const alternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.service.translations) {
    if (other.isPublished) {
      alternates[other.locale as AppLocale] = `/services/${other.slug}`;
    }
  }

  return {
    title: translation.seoTitle ?? translation.name,
    description: translation.seoDescription ?? translation.shortDescription ?? undefined,
    robots: translation.noindex ? { index: false } : undefined,
    alternates: {
      canonical: absoluteUrl(`/${locale}/services/${slug}`),
      languages: buildLanguageAlternates(alternates),
    },
    openGraph: {
      title: translation.seoTitle ?? translation.name,
      description: translation.seoDescription ?? translation.shortDescription ?? undefined,
      url: absoluteUrl(`/${locale}/services/${slug}`),
      locale,
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = (await params) as { locale: AppLocale; slug: string };
  setRequestLocale(locale);
  const translation = await getService(locale, slug);
  if (!translation) notFound();

  const t = await getTranslations("public.serviceDetail");

  const localeAlternates: Partial<Record<AppLocale, string>> = {};
  for (const other of translation.service.translations) {
    if (other.isPublished) {
      localeAlternates[other.locale as AppLocale] = `/services/${other.slug}`;
    }
  }

  const contentBlocks = Array.isArray(translation.content)
    ? (translation.content as unknown as PageBlock[])
    : [];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: translation.name,
          description: translation.shortDescription ?? undefined,
          url: absoluteUrl(`/${locale}/services/${slug}`),
          areaServed: "DZ",
          provider: { "@type": "Organization", name: "SaldaeConnect" },
          inLanguage: locale,
        }}
      />
      <Header localeAlternates={localeAlternates} localeFallback="/services" />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Link
            href="/services"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <ArrowIcon direction="back" className="h-4 w-4" /> {t("backToServices")}
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
            {translation.name}
          </h1>
          {translation.shortDescription ? (
            <p className="mt-3 text-lg text-ink-500">{translation.shortDescription}</p>
          ) : null}

          {contentBlocks.length > 0 ? <PageBlocks blocks={contentBlocks} /> : null}

          {translation.service.faqs.length > 0 ? (
            <section className="mt-12">
              <h2 className="text-xl font-semibold text-foreground">{t("faqTitle")}</h2>
              <dl className="mt-4 space-y-4">
                {translation.service.faqs.map((faq) => {
                  const faqTranslation = faq.translations[0];
                  if (!faqTranslation) return null;
                  return (
                    <div key={faq.id}>
                      <dt className="font-medium text-foreground">{faqTranslation.question}</dt>
                      <dd className="mt-1 text-sm text-ink-500">{faqTranslation.answer}</dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ) : null}

          {translation.service.fulfillmentType === "BOOKING" ? (
            (() => {
              const bookingConfig = parseBookingConfig(translation.service.bookingConfig);
              return bookingConfig ? <BookingWidget serviceId={translation.service.id} config={bookingConfig} /> : null;
            })()
          ) : (
            <div className="mt-12">
              <Link
                href={{ pathname: "/quote", query: { service: slug } }}
                className={buttonVariants({ size: "lg" })}
              >
                {t("cta")}
              </Link>
            </div>
          )}
        </article>
      </main>
    </>
  );
}

export async function generateStaticParams() {
  const translations = await prisma.serviceTranslation.findMany({
    where: { isPublished: true },
    select: { locale: true, slug: true },
  });
  return translations.map(({ locale, slug }) => ({ locale, slug }));
}

export const dynamicParams = true;
