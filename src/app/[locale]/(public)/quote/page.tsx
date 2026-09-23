import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import { routing, type AppLocale } from "@/i18n/routing";
import { QuoteWizard, type QuoteWizardService } from "@/app/[locale]/(public)/quote/quote-wizard";
import type { QuestionField } from "@/components/forms/dynamic-question";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: AppLocale };
  const t = await getTranslations({ locale, namespace: "public.quote" });
  const alternates = Object.fromEntries(routing.locales.map((loc) => [loc, "/quote"]));

  return {
    title: t("seoTitle"),
    robots: { index: false }, // formulaire transactionnel, pas de valeur SEO à indexer
    alternates: {
      canonical: absoluteUrl(`/${locale}/quote`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { locale } = (await params) as { locale: AppLocale };
  const { service: initialServiceSlug } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("public.quote");

  const services = await prisma.service.findMany({
    where: { isActive: true, translations: { some: { locale, isPublished: true } } },
    orderBy: { order: "asc" },
    include: {
      translations: { where: { locale } },
      requestForm: true,
    },
  });

  const wizardServices: QuoteWizardService[] = services.map((service) => {
    const schema = service.requestForm?.schema as { fields?: QuestionField[] } | null;
    return {
      id: service.id,
      slug: service.translations[0]?.slug ?? service.id,
      name: service.translations[0]?.name ?? "",
      questionFields: schema?.fields ?? [],
    };
  });

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
            <p className="mx-auto mt-3 max-w-xl text-balance text-ink-500">{t("subtitle")}</p>
          </div>

          <div className="mt-10">
            <QuoteWizard services={wizardServices} locale={locale} initialServiceSlug={initialServiceSlug} />
          </div>
        </section>
      </main>
    </>
  );
}
