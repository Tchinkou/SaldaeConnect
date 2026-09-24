import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { BlogPostForm } from "@/app/[locale]/admin/content/blog/blog-post-form";

const EMPTY_TRANSLATION = { title: "", slug: "", excerpt: "", content: [], seoTitle: "", seoDescription: "" };

export default async function BlogPostEditPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const { id } = await params;
  const t = await getTranslations("admin.content");
  const isNew = id === "new";

  if (isNew) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-foreground">{t("blog.new")}</h1>
        <BlogPostForm
          id={null}
          initialCategoryName=""
          initialTagNames={[]}
          initialStatus="DRAFT"
          initialPublishedAt=""
          initialTranslations={{ fr: EMPTY_TRANSLATION, en: EMPTY_TRANSLATION, ar: EMPTY_TRANSLATION }}
        />
      </div>
    );
  }

  const post = await prisma.blogPost.findUnique({
    where: { id },
    include: { translations: true, category: { include: { translations: { where: { locale: "fr" } } } }, tags: true },
  });
  if (!post) notFound();

  function forLocale(locale: string) {
    const translation = post!.translations.find((entry) => entry.locale === locale);
    return {
      title: translation?.title ?? "",
      slug: translation?.slug ?? "",
      excerpt: translation?.excerpt ?? "",
      content: (translation?.content as { type: "heading" | "paragraph"; text: string }[] | null) ?? [],
      seoTitle: translation?.seoTitle ?? "",
      seoDescription: translation?.seoDescription ?? "",
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">{t("blog.edit")}</h1>
      <BlogPostForm
        id={post.id}
        initialCategoryName={post.category?.translations[0]?.name ?? ""}
        initialTagNames={post.tags.map((tag) => tag.name)}
        initialStatus={post.status}
        initialPublishedAt={post.publishedAt ? post.publishedAt.toISOString().slice(0, 16) : ""}
        initialTranslations={{ fr: forLocale("fr"), en: forLocale("en"), ar: forLocale("ar") }}
      />
    </div>
  );
}
