import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { PortfolioForm } from "@/app/[locale]/admin/content/portfolio/portfolio-form";

const EMPTY_TRANSLATION = {
  title: "",
  slug: "",
  summary: "",
  problem: "",
  solution: "",
  execution: "",
  result: "",
};

export default async function PortfolioEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "cms.write")) return <Forbidden />;

  const { id } = await params;
  const t = await getTranslations("admin.content");
  const isNew = id === "new";

  if (isNew) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-foreground">{t("portfolio.new")}</h1>
        <PortfolioForm
          id={null}
          initialClientName=""
          initialIsFeatured={false}
          initialIsPublished={false}
          initialOrder={0}
          initialTranslations={{ fr: EMPTY_TRANSLATION, en: EMPTY_TRANSLATION, ar: EMPTY_TRANSLATION }}
        />
      </div>
    );
  }

  const project = await prisma.portfolioProject.findUnique({ where: { id }, include: { translations: true } });
  if (!project) notFound();

  const byLocale = (locale: string) => {
    const translation = project.translations.find((tr) => tr.locale === locale);
    return {
      title: translation?.title ?? "",
      slug: translation?.slug ?? "",
      summary: translation?.summary ?? "",
      problem: translation?.problem ?? "",
      solution: translation?.solution ?? "",
      execution: translation?.execution ?? "",
      result: translation?.result ?? "",
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">{t("portfolio.edit")}</h1>
      <PortfolioForm
        id={project.id}
        initialClientName={project.clientName ?? ""}
        initialIsFeatured={project.isFeatured}
        initialIsPublished={project.isPublished}
        initialOrder={project.order}
        initialTranslations={{ fr: byLocale("fr"), en: byLocale("en"), ar: byLocale("ar") }}
      />
    </div>
  );
}
