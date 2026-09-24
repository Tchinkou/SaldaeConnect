import { getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent } from "@/components/ui/card";
import type { CurrentUser } from "@/server/core/authz/session";
import { ownerWhereClause } from "@/server/core/authz/ownership";

/**
 * Dashboard CRM (§E.5) : nouveaux prospects, qualifiés, opportunités
 * actives, tâches en retard, taux de conversion. Devis envoyés/acceptés et
 * chiffre d'affaires ne sont pas affichés : les modules Devis et
 * Facturation n'existent pas encore (Phase 5, Phase 7) et un « 0 » y
 * laisserait croire à une fonctionnalité manquante plutôt qu'absente.
 */
export async function CrmDashboardStats({ currentUser }: { currentUser: CurrentUser }) {
  const t = await getTranslations("admin.crm.dashboard");

  const opportunityWhere = { ...ownerWhereClause(currentUser, "opportunity.read"), deletedAt: null };
  const leadWhere = { ...ownerWhereClause(currentUser, "lead.read"), deletedAt: null };
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [newLeads, qualified, activeOpportunities, wonCount, lostCount, overdueTasks] = await Promise.all([
    prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.opportunity.count({ where: { ...opportunityWhere, stage: { key: "qualified" } } }),
    prisma.opportunity.count({ where: { ...opportunityWhere, stage: { kind: "OPEN" } } }),
    prisma.opportunity.count({ where: { ...opportunityWhere, stage: { kind: "WON" } } }),
    prisma.opportunity.count({ where: { ...opportunityWhere, stage: { kind: "LOST" } } }),
    prisma.task.count({
      where: { assigneeId: currentUser.user.id, dueAt: { lt: new Date() }, status: { notIn: ["DONE", "CANCELLED"] } },
    }),
  ]);

  const closedCount = wonCount + lostCount;
  const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : null;

  const stats = [
    { label: t("newLeads"), value: newLeads },
    { label: t("qualified"), value: qualified },
    { label: t("activeOpportunities"), value: activeOpportunities },
    { label: t("overdueTasks"), value: overdueTasks, warn: overdueTasks > 0 },
    { label: t("conversionRate"), value: conversionRate === null ? "—" : `${conversionRate}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/70">{stat.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${stat.warn ? "text-danger-600" : "text-foreground"}`}>{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
