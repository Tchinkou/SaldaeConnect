import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { PageForm } from "@/app/[locale]/admin/content/pages/page-form";

const EMPTY_TRANSLATION = { title: "", slug: "", blocks: [], seoTitle: "", seoDescription: "", isPublished: false };

export default async function PageEditPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const { id } = await params;
  const t = await getTranslations("admin.content");
  const isNew = id === "new";

  if (isNew) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-foreground">{t("pages.new")}</h1>
        <PageForm
          id={null}
          isSystem={false}
          initialKey=""
          initialTranslations={{ fr: EMPTY_TRANSLATION, en: EMPTY_TRANSLATION, ar: EMPTY_TRANSLATION }}
        />
      </div>
    );
  }

  const page = await prisma.page.findUnique({ where: { id }, include: { translations: true } });
  if (!page) notFound();

  function forLocale(locale: string) {
    const translation = page!.translations.find((entry) => entry.locale === locale);
    return {
      title: translation?.title ?? "",
      slug: translation?.slug ?? "",
      blocks: (translation?.blocks as { type: "heading" | "paragraph"; text: string }[] | null) ?? [],
      seoTitle: translation?.seoTitle ?? "",
      seoDescription: translation?.seoDescription ?? "",
      isPublished: translation?.isPublished ?? false,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">{t("pages.edit")}</h1>
      <PageForm
        id={page.id}
        isSystem={page.isSystem}
        initialKey={page.key}
        initialTranslations={{ fr: forLocale("fr"), en: forLocale("en"), ar: forLocale("ar") }}
      />
    </div>
  );
}
