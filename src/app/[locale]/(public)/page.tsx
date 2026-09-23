import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Hero } from "@/components/marketing/hero";
import { ServiceGrid } from "@/components/marketing/service-grid";
import { WhyUs } from "@/components/marketing/why-us";
import { KeyFigures } from "@/components/marketing/key-figures";
import { Testimonials } from "@/components/marketing/testimonials";
import { FinalCta } from "@/components/marketing/final-cta";
import { JsonLd } from "@/components/seo/json-ld";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import { routing, type AppLocale } from "@/i18n/routing";

interface SeoSetting {
  defaultTitle?: Partial<Record<AppLocale, string>>;
  defaultDescription?: Partial<Record<AppLocale, string>>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: AppLocale };
  const seoSetting = await prisma.setting.findUnique({ where: { key: "seo" } });
  const seo = (seoSetting?.value ?? {}) as SeoSetting;

  const alternates = Object.fromEntries(routing.locales.map((loc) => [loc, "/"]));

  return {
    title: seo.defaultTitle?.[locale],
    description: seo.defaultDescription?.[locale],
    alternates: {
      canonical: absoluteUrl(`/${locale}`),
      languages: buildLanguageAlternates(alternates),
    },
    openGraph: {
      title: seo.defaultTitle?.[locale],
      description: seo.defaultDescription?.[locale],
      url: absoluteUrl(`/${locale}`),
      locale,
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: AppLocale };
  setRequestLocale(locale);

  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      translations: { some: { locale, isPublished: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { order: "asc" }],
    take: 6,
    include: { translations: { where: { locale } } },
  });

  const serviceItems = services.map((service) => ({
    slug: service.translations[0]?.slug ?? service.id,
    name: service.translations[0]?.name ?? "",
    shortDescription: service.translations[0]?.shortDescription ?? null,
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "SaldaeConnect",
          url: absoluteUrl(`/${locale}`),
          areaServed: "DZ",
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "SaldaeConnect",
          url: absoluteUrl(`/${locale}`),
          inLanguage: locale,
        }}
      />
      <Header />
      <main className="flex-1">
        <Hero />
        <ServiceGrid services={serviceItems} />
        <WhyUs />
        <KeyFigures />
        <Testimonials />
        <FinalCta />
      </main>
    </>
  );
}
