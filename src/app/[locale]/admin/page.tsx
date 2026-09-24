import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/admin/bar-chart";
import { prisma } from "@/server/core/db/client";
import { formatMoney } from "@/server/core/money";
import type { AppLocale } from "@/i18n/routing";

const ACTIVE_PROJECT_STATUSES = ["PLANNING", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW"] as const;

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: AppLocale };
  const t = await getTranslations("admin.dashboard");
  const currentUser = await getCurrentUser();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    newLeads,
    openOpportunities,
    pendingQuotes,
    overdueInvoices,
    activeProjects,
    upcomingReservations,
    stages,
    recentPayments,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.opportunity.count({ where: { deletedAt: null, stage: { kind: "OPEN" } } }),
    prisma.quote.count({ where: { status: { in: ["SENT", "VIEWED"] } } }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.project.count({ where: { status: { in: [...ACTIVE_PROJECT_STATUSES] } } }),
    prisma.reservation.count({ where: { status: "CONFIRMED", startsAt: { gte: now, lte: sevenDaysAhead } } }),
    prisma.pipelineStage.findMany({
      where: { kind: "OPEN" },
      orderBy: { order: "asc" },
      include: { translations: { where: { locale } }, _count: { select: { opportunities: { where: { deletedAt: null } } } } },
    }),
    prisma.payment.findMany({
      where: { status: "RECORDED", paidAt: { gte: sixMonthsAgo } },
      select: { amount: true, currency: true, paidAt: true },
    }),
  ]);

  const currencyTotals = new Map<string, bigint>();
  for (const payment of recentPayments) {
    currencyTotals.set(payment.currency, (currencyTotals.get(payment.currency) ?? 0n) + payment.amount);
  }
  const mainCurrency = [...currencyTotals.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1))[0]?.[0] ?? "DZD";

  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString(locale, { month: "short" }),
    });
  }
  const monthlyTotals = new Map(months.map((month) => [month.key, 0]));
  for (const payment of recentPayments) {
    if (payment.currency !== mainCurrency) continue;
    const key = `${payment.paidAt.getFullYear()}-${payment.paidAt.getMonth()}`;
    if (monthlyTotals.has(key)) monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + Number(payment.amount) / 100);
  }
  const chartPoints = months.map((month) => ({ label: month.label, value: monthlyTotals.get(month.key) ?? 0 }));
  const totalRevenue = chartPoints.reduce((sum, point) => sum + point.value, 0);

  const kpis = [
    { label: t("newLeads"), value: newLeads },
    { label: t("openOpportunities"), value: openOpportunities },
    { label: t("pendingQuotes"), value: pendingQuotes },
    { label: t("overdueInvoices"), value: overdueInvoices },
    { label: t("activeProjects"), value: activeProjects },
    { label: t("upcomingReservations"), value: upcomingReservations },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-foreground">{t("welcome", { name: currentUser?.user.name ?? "" })}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <p className="text-2xl font-semibold text-foreground" dir="ltr">
                {kpi.value}
              </p>
              <p className="mt-1 text-xs text-foreground/60">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("revenueChartTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-lg font-semibold text-foreground" dir="ltr">
              {formatMoney(BigInt(Math.round(totalRevenue * 100)), mainCurrency, locale)}
            </p>
            <BarChart points={chartPoints} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("pipelineTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stages.length === 0 ? (
              <p className="text-sm text-foreground/70">{t("empty")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stages.map((stage) => (
                  <li key={stage.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{stage.translations[0]?.name ?? stage.key}</span>
                    <span className="font-medium text-foreground" dir="ltr">
                      {stage._count.opportunities}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
