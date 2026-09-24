import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import { routing, type AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: AppLocale };
  const t = await getTranslations({ locale, namespace: "public.services" });
  const alternates = Object.fromEntries(routing.locales.map((loc) => [loc, "/services"]));

  return {
    title: t("seoTitle"),
    description: t("seoDescription"),
    alternates: {
      canonical: absoluteUrl(`/${locale}/services`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: AppLocale };
  setRequestLocale(locale);
  const t = await getTranslations("public.services");

  const categories = await prisma.serviceCategory.findMany({
    where: { isActive: true, translations: { some: { locale } } },
    orderBy: { order: "asc" },
    include: {
      translations: { where: { locale } },
      // TRANSACTION exclu : module interne uniquement tant que le cadre légal n'est pas validé (§D.6).
      services: {
        where: { isActive: true, fulfillmentType: { not: "TRANSACTION" }, translations: { some: { locale, isPublished: true } } },
        orderBy: { order: "asc" },
        include: { translations: { where: { locale } } },
      },
    },
  });

  const nonEmptyCategories = categories.filter((category) => category.services.length > 0);

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-ink-500">{t("subtitle")}</p>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          {nonEmptyCategories.length === 0 ? (
            <p className="text-center text-ink-500">{t("empty")}</p>
          ) : (
            <div className="space-y-12">
              {nonEmptyCategories.map((category) => (
                <div key={category.id}>
                  <h2 className="text-lg font-semibold text-foreground">
                    {category.translations[0]?.name}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {category.services.map((service) => {
                      const translation = service.translations[0];
                      if (!translation) return null;
                      return (
                        <Link key={service.id} href={`/services/${translation.slug}`}>
                          <Card className="h-full transition-shadow hover:shadow-md">
                            <CardContent className="pt-6">
                              <CardTitle>{translation.name}</CardTitle>
                              {translation.shortDescription ? (
                                <p className="mt-2 text-sm text-ink-500">
                                  {translation.shortDescription}
                                </p>
                              ) : null}
                            </CardContent>
                          </Card>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
