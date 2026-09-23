import { getLocale } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { NewLeadForm } from "@/app/[locale]/admin/leads/new/new-lead-form";

export default async function NewLeadPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "lead.write")) {
    return <Forbidden />;
  }

  const locale = await getLocale();
  const [sources, services] = await Promise.all([
    prisma.leadSource.findMany({ where: { isActive: true }, include: { translations: { where: { locale } } } }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: { translations: { where: { locale } } },
    }),
  ]);

  return (
    <NewLeadForm
      sources={sources.map((s) => ({ id: s.id, name: s.translations[0]?.name ?? s.key }))}
      services={services.map((s) => ({ id: s.id, name: s.translations[0]?.name ?? s.id }))}
    />
  );
}
