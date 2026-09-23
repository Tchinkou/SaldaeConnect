import { prisma } from "@/server/core/db/client";
import { getLocale } from "next-intl/server";

/** Masqué tant qu'aucun chiffre n'est saisi dans l'admin — pas de valeurs inventées (§K.2). */
export async function KeyFigures() {
  const locale = await getLocale();
  const figures = await prisma.keyFigure.findMany({
    where: { isActive: true, translations: { some: { locale } } },
    orderBy: { order: "asc" },
    include: { translations: { where: { locale } } },
  });

  if (figures.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.id} className="text-center">
            <p className="text-3xl font-bold text-brand-600">
              <bdi>
                {figure.value}
                {figure.suffix ?? ""}
              </bdi>
            </p>
            <p className="mt-1 text-sm text-ink-500">{figure.translations[0]?.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
