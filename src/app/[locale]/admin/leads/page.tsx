import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { ownerWhereClause } from "@/server/core/authz/ownership";
import { resolveOwnerNames } from "@/server/core/crm/owners";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { LeadFilters } from "@/app/[locale]/admin/leads/lead-filters";

const STATUS_TONE = { OPEN: "brand", CONVERTED: "success", DISQUALIFIED: "neutral" } as const;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "lead.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.crm.leads");
  const locale = await getLocale();
  const params = await searchParams;

  const where: Record<string, unknown> = { ...ownerWhereClause(currentUser, "lead.read"), deletedAt: null };
  if (params.status) where.status = params.status;
  if (params.sourceId) where.sourceId = params.sourceId;
  if (params.ownerId) where.ownerId = params.ownerId;
  if (params.q) {
    where.OR = [
      { firstName: { contains: params.q, mode: "insensitive" } },
      { lastName: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
      { companyName: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [leads, staff, sources] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { source: { include: { translations: { where: { locale } } } } },
    }),
    prisma.user.findMany({ where: { userType: "STAFF", status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.leadSource.findMany({ where: { isActive: true }, include: { translations: { where: { locale } } } }),
  ]);

  const ownerNameById = await resolveOwnerNames(leads.map((l) => l.ownerId));
  const canWrite = hasPermission(currentUser, "lead.write");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
        </div>
        {canWrite ? (
          <Link href="/admin/leads/new" className={buttonVariants({ size: "sm" })}>
            {t("new")}
          </Link>
        ) : null}
      </div>

      <LeadFilters
        staff={staff}
        sources={sources.map((s) => ({ id: s.id, name: s.translations[0]?.name ?? s.key }))}
        currentParams={params}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-3 py-2 text-start">{t("name")}</th>
                  <th className="px-3 py-2 text-start">{t("source")}</th>
                  <th className="px-3 py-2 text-start">{t("status")}</th>
                  <th className="px-3 py-2 text-start">{t("owner")}</th>
                  <th className="px-3 py-2 text-start">{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-surface-muted">
                    <td className="px-3 py-2">
                      <Link href={`/admin/leads/${lead.id}`} className="font-medium text-brand-600 hover:underline">
                        {lead.firstName} {lead.lastName}
                      </Link>
                      {lead.companyName ? <p className="text-xs text-foreground/50">{lead.companyName}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-foreground/70">{lead.source?.translations[0]?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_TONE[lead.status]}>{t(`statusValue.${lead.status}`)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-foreground/70">{lead.ownerId ? (ownerNameById.get(lead.ownerId) ?? "—") : t("unassigned")}</td>
                    <td className="px-3 py-2 text-foreground/60">{lead.createdAt.toLocaleDateString(locale)}</td>
                  </tr>
                ))}
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-foreground/50">
                      {t("empty")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
