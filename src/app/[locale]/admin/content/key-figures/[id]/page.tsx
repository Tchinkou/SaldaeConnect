import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { KeyFigureForm } from "@/app/[locale]/admin/content/key-figures/key-figure-form";

export default async function KeyFigureEditPage({
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
        <h1 className="text-xl font-semibold text-foreground">{t("keyFigures.new")}</h1>
        <KeyFigureForm
          id={null}
          initialValue=""
          initialSuffix=""
          initialOrder={0}
          initialIsActive={true}
          initialTranslations={{ fr: { label: "" }, en: { label: "" }, ar: { label: "" } }}
        />
      </div>
    );
  }

  const figure = await prisma.keyFigure.findUnique({ where: { id }, include: { translations: true } });
  if (!figure) notFound();

  const byLocale = (locale: string) => figure.translations.find((tr) => tr.locale === locale)?.label ?? "";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">{t("keyFigures.edit")}</h1>
      <KeyFigureForm
        id={figure.id}
        initialValue={figure.value}
        initialSuffix={figure.suffix ?? ""}
        initialOrder={figure.order}
        initialIsActive={figure.isActive}
        initialTranslations={{
          fr: { label: byLocale("fr") },
          en: { label: byLocale("en") },
          ar: { label: byLocale("ar") },
        }}
      />
    </div>
  );
}
