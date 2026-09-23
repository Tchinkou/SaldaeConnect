import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { ownerWhereClause } from "@/server/core/authz/ownership";
import { resolveOwnerNames } from "@/server/core/crm/owners";
import { Forbidden } from "@/components/admin/forbidden";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { CrmBoard, type BoardOpportunity, type BoardStage } from "@/app/[locale]/admin/crm/crm-board";
import { CrmFilters } from "@/app/[locale]/admin/crm/crm-filters";
import { CrmListView } from "@/app/[locale]/admin/crm/crm-list-view";
import { CrmDashboardStats } from "@/app/[locale]/admin/crm/crm-dashboard-stats";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "opportunity.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.crm");
  const locale = await getLocale();
  const params = await searchParams;

  const where: Record<string, unknown> = {
    ...ownerWhereClause(currentUser, "opportunity.read"),
    deletedAt: null,
  };
  if (params.ownerId) where.ownerId = params.ownerId;
  if (params.serviceId) where.serviceId = params.serviceId;
  if (params.sourceId) where.sourceId = params.sourceId;
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59`) } : {}),
    };
  }
  if (params.minAmount) {
    where.estimatedValue = { ...(where.estimatedValue as object), gte: BigInt(params.minAmount) };
  }
  if (params.maxAmount) {
    where.estimatedValue = { ...(where.estimatedValue as object), lte: BigInt(params.maxAmount) };
  }

  const [stages, opportunities, staff, services, sources, lostReasons] = await Promise.all([
    prisma.pipelineStage.findMany({
      orderBy: { order: "asc" },
      include: { translations: { where: { locale } } },
    }),
    prisma.opportunity.findMany({
      where,
      orderBy: [{ stageId: "asc" }, { position: "asc" }],
      include: {
        lead: { select: { firstName: true, lastName: true, companyName: true } },
        client: { select: { displayName: true } },
        service: { include: { translations: { where: { locale } } } },
      },
    }),
    prisma.user.findMany({
      where: { userType: "STAFF", status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: { translations: { where: { locale } } },
    }),
    prisma.leadSource.findMany({
      where: { isActive: true },
      include: { translations: { where: { locale } } },
    }),
    prisma.lostReason.findMany({
      include: { translations: { where: { locale } } },
    }),
  ]);

  const boardStages: BoardStage[] = stages.map((stage) => ({
    id: stage.id,
    key: stage.key,
    kind: stage.kind,
    color: stage.color,
    name: stage.translations[0]?.name ?? stage.key,
  }));

  const ownerNameById = await resolveOwnerNames(opportunities.map((o) => o.ownerId));

  const boardOpportunities: BoardOpportunity[] = opportunities.map((opportunity) => ({
    id: opportunity.id,
    number: opportunity.number,
    title: opportunity.title,
    stageId: opportunity.stageId,
    position: opportunity.position,
    contactName: opportunity.client?.displayName ?? (opportunity.lead ? `${opportunity.lead.firstName} ${opportunity.lead.lastName}` : "—"),
    companyName: opportunity.lead?.companyName ?? null,
    serviceName: opportunity.service.translations[0]?.name ?? opportunity.service.id,
    ownerName: opportunity.ownerId ? (ownerNameById.get(opportunity.ownerId) ?? null) : null,
    budgetMin: opportunity.budgetMin ? opportunity.budgetMin.toString() : null,
    budgetMax: opportunity.budgetMax ? opportunity.budgetMax.toString() : null,
    budgetCurrency: opportunity.budgetCurrency,
    createdAt: opportunity.createdAt.toISOString(),
  }));

  const view = params.view === "list" ? "list" : "board";
  const canWrite = hasPermission(currentUser, "opportunity.write");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={{ pathname: "/admin/crm", query: { ...params, view: "board" } }}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              view === "board" ? "bg-brand-100 text-brand-700" : "text-foreground/70 hover:bg-surface-muted",
            )}
          >
            {t("boardView")}
          </Link>
          <Link
            href={{ pathname: "/admin/crm", query: { ...params, view: "list" } }}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              view === "list" ? "bg-brand-100 text-brand-700" : "text-foreground/70 hover:bg-surface-muted",
            )}
          >
            {t("listView")}
          </Link>
        </div>
      </div>

      <CrmDashboardStats currentUser={currentUser} />

      <CrmFilters
        staff={staff}
        services={services.map((s) => ({ id: s.id, name: s.translations[0]?.name ?? s.id }))}
        sources={sources.map((s) => ({ id: s.id, name: s.translations[0]?.name ?? s.key }))}
        currentParams={params}
      />

      {view === "board" ? (
        <CrmBoard
          stages={boardStages}
          opportunities={boardOpportunities}
          lostReasons={lostReasons.map((r) => ({ id: r.id, label: r.translations[0]?.label ?? r.id }))}
          canWrite={canWrite}
        />
      ) : (
        <CrmListView stages={boardStages} opportunities={boardOpportunities} />
      )}
    </div>
  );
}
