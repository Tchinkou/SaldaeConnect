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
  const t = await getTranslations({ locale, namespace: "public.portfolio" });
  const alternates = Object.fromEntries(routing.locales.map((loc) => [loc, "/portfolio"]));

  return {
    title: t("seoTitle"),
    alternates: {
      canonical: absoluteUrl(`/${locale}/portfolio`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: AppLocale };
  setRequestLocale(locale);
  const t = await getTranslations("public.portfolio");

  const projects = await prisma.portfolioProject.findMany({
    where: { isPublished: true, translations: { some: { locale } } },
    orderBy: [{ isFeatured: "desc" }, { order: "asc" }],
    include: { translations: { where: { locale } } },
  });

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          {projects.length === 0 ? (
            <p className="text-center text-ink-500">{t("empty")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const translation = project.translations[0];
                if (!translation) return null;
                return (
                  <Link key={project.id} href={`/portfolio/${translation.slug}`}>
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardContent className="pt-6">
                        <CardTitle>{translation.title}</CardTitle>
                        {translation.summary ? (
                          <p className="mt-2 text-sm text-ink-500">{translation.summary}</p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
