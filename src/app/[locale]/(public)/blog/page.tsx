import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { prisma } from "@/server/core/db/client";
import { absoluteUrl, buildLanguageAlternates } from "@/server/core/seo";
import { routing, type AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: AppLocale };
  const t = await getTranslations({ locale, namespace: "public.blog" });
  const alternates = Object.fromEntries(routing.locales.map((loc) => [loc, "/blog"]));

  return {
    title: t("seoTitle"),
    alternates: {
      canonical: absoluteUrl(`/${locale}/blog`),
      languages: buildLanguageAlternates(alternates),
    },
  };
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { locale } = (await params) as { locale: AppLocale };
  const { category } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("public.blog");
  const format = await getFormatter();

  const posts = await prisma.blogPost.findMany({
    where: {
      status: "PUBLISHED",
      translations: { some: { locale } },
      ...(category ? { category: { translations: { some: { locale, slug: category } } } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    include: { translations: { where: { locale } }, category: { include: { translations: { where: { locale } } } } },
  });

  const categories = await prisma.blogCategory.findMany({
    where: { posts: { some: { status: "PUBLISHED" } } },
    include: { translations: { where: { locale } } },
  });

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </section>

        {categories.length > 0 ? (
          <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/blog"
                className={`rounded-full px-3 py-1 text-sm ${!category ? "bg-brand-600 text-white" : "bg-surface-subtle text-foreground/70"}`}
              >
                {t("allCategories")}
              </Link>
              {categories.map((cat) => {
                const translation = cat.translations[0];
                if (!translation) return null;
                return (
                  <Link
                    key={cat.id}
                    href={`/blog?category=${translation.slug}`}
                    className={`rounded-full px-3 py-1 text-sm ${category === translation.slug ? "bg-brand-600 text-white" : "bg-surface-subtle text-foreground/70"}`}
                  >
                    {translation.name}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          {posts.length === 0 ? (
            <p className="text-center text-ink-500">{t("empty")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => {
                const translation = post.translations[0];
                if (!translation) return null;
                return (
                  <Link key={post.id} href={`/blog/${translation.slug}`}>
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardContent className="pt-6">
                        {post.category?.translations[0]?.name ? (
                          <p className="text-xs font-medium text-brand-600">{post.category.translations[0].name}</p>
                        ) : null}
                        <CardTitle className="mt-1">{translation.title}</CardTitle>
                        {translation.excerpt ? <p className="mt-2 text-sm text-ink-500">{translation.excerpt}</p> : null}
                        {post.publishedAt ? (
                          <p className="mt-3 text-xs text-foreground/70">{format.dateTime(post.publishedAt, { dateStyle: "medium" })}</p>
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
