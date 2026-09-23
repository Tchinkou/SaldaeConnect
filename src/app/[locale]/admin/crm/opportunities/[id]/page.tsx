import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { assertOwnerInScope } from "@/server/core/authz/ownership";
import { resolveOwnerNames } from "@/server/core/crm/owners";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { Timeline } from "@/components/crm/timeline";
import { AddActivityForm } from "@/components/crm/add-activity-form";
import { TaskList } from "@/components/crm/task-list";
import { AddTaskForm } from "@/components/crm/add-task-form";
import { OwnerReassignSelect } from "@/components/crm/owner-reassign-select";
import { addOpportunityActivityAction, reassignOpportunityOwnerAction } from "@/app/[locale]/admin/crm/opportunities/[id]/actions";
import { CreateQuoteButton } from "@/app/[locale]/admin/crm/opportunities/[id]/create-quote-button";
import { formatMoney } from "@/server/core/money";
import { ForbiddenError } from "@/server/core/errors";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "opportunity.read")) {
    return <Forbidden />;
  }

  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("admin.crm.opportunity");

  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      lead: true,
      client: true,
      service: { include: { translations: { where: { locale } } } },
      stage: { include: { translations: { where: { locale } } } },
      source: { include: { translations: { where: { locale } } } },
      lostReason: { include: { translations: { where: { locale } } } },
      activities: { orderBy: { occurredAt: "desc" } },
      tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
      stageChanges: {
        orderBy: { createdAt: "desc" },
        include: {
          fromStage: { include: { translations: { where: { locale } } } },
          toStage: { include: { translations: { where: { locale } } } },
        },
      },
      quotes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!opportunity) notFound();

  try {
    assertOwnerInScope(currentUser, "opportunity.read", opportunity.ownerId);
  } catch (error) {
    if (error instanceof ForbiddenError) return <Forbidden />;
    throw error;
  }

  const staff = await prisma.user.findMany({
    where: { userType: "STAFF", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const nameById = await resolveOwnerNames([
    opportunity.ownerId,
    ...opportunity.activities.map((a) => a.actorId),
    ...opportunity.tasks.map((task) => task.assigneeId),
    ...opportunity.stageChanges.map((change) => change.changedById),
  ]);

  const canWrite = hasPermission(currentUser, "opportunity.write");
  const canWriteQuote = hasPermission(currentUser, "quote.write");
  const answers = (opportunity.answers as Record<string, string | boolean> | null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-brand-600">{opportunity.number}</p>
          <h1 className="text-xl font-semibold text-foreground">{opportunity.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={opportunity.stage.kind === "WON" ? "success" : opportunity.stage.kind === "LOST" ? "danger" : "brand"}>
              {opportunity.stage.translations[0]?.name ?? opportunity.stage.key}
            </Badge>
            {opportunity.lostReason ? <Badge tone="danger">{opportunity.lostReason.translations[0]?.label}</Badge> : null}
          </div>
        </div>
        <Link href="/admin/crm" className="text-sm font-medium text-brand-600 hover:underline">
          {t("backToBoard")}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("details")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Field label={t("service")} value={opportunity.service.translations[0]?.name ?? opportunity.service.id} />
              <Field
                label={t("budget")}
                value={
                  opportunity.budgetMin || opportunity.budgetMax
                    ? `${opportunity.budgetMin ?? "?"}–${opportunity.budgetMax ?? "?"} ${opportunity.budgetCurrency ?? ""}`
                    : t("notSpecified")
                }
              />
              <Field
                label={t("deadline")}
                value={opportunity.desiredDeadline ? opportunity.desiredDeadline.toLocaleDateString(locale) : t("notSpecified")}
              />
              <Field label={t("source")} value={opportunity.source?.translations[0]?.name ?? t("notSpecified")} />
              {opportunity.message ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">{t("message")}</p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground/80">{opportunity.message}</p>
                </div>
              ) : null}
              {answers && Object.keys(answers).length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">{t("answers")}</p>
                  <dl className="mt-1 grid grid-cols-2 gap-2">
                    {Object.entries(answers).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs text-foreground/50">{key}</dt>
                        <dd className="text-foreground/80">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("quotes")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {opportunity.quotes.length === 0 ? (
                <p className="text-sm text-foreground/50">{t("noQuotes")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {opportunity.quotes.map((quote) => (
                    <li key={quote.id} className="flex items-center justify-between py-2">
                      <Link href={`/admin/quotes/${quote.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                        {quote.number ?? t("draftQuote")} — {quote.title}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground/70" dir="ltr">
                          {formatMoney(quote.total, quote.currency, locale)}
                        </span>
                        <Badge tone={quote.status === "ACCEPTED" ? "success" : quote.status === "REJECTED" ? "danger" : "brand"}>
                          {t(`quoteStatusValue.${quote.status}`)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canWriteQuote ? <CreateQuoteButton opportunityId={opportunity.id} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {canWrite ? (
                <AddActivityForm action={addOpportunityActivityAction} extraInput={{ opportunityId: opportunity.id }} />
              ) : null}
              <Timeline
                activities={opportunity.activities.map((activity) => ({
                  id: activity.id,
                  type: activity.type,
                  subject: activity.subject,
                  body: activity.body,
                  occurredAt: activity.occurredAt.toISOString(),
                  actorName: activity.actorId ? (nameById.get(activity.actorId) ?? null) : null,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("stageHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              {opportunity.stageChanges.length === 0 ? (
                <p className="text-sm text-foreground/50">{t("noStageChanges")}</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {opportunity.stageChanges.map((change) => (
                    <li key={change.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <span>
                        {change.fromStage?.translations[0]?.name ?? t("initialStage")} →{" "}
                        {change.toStage.translations[0]?.name ?? change.toStage.key}
                      </span>
                      <span className="text-xs text-foreground/50">
                        {change.changedById ? nameById.get(change.changedById) : t("automatic")} ·{" "}
                        {change.createdAt.toLocaleDateString(locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("contact")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {opportunity.client ? (
                <Link href={`/admin/clients/${opportunity.client.id}`} className="font-medium text-brand-600 hover:underline">
                  {opportunity.client.displayName}
                </Link>
              ) : opportunity.lead ? (
                <Link href={`/admin/leads/${opportunity.lead.id}`} className="font-medium text-brand-600 hover:underline">
                  {opportunity.lead.firstName} {opportunity.lead.lastName}
                </Link>
              ) : (
                <span className="text-foreground/50">{t("notSpecified")}</span>
              )}
              {(opportunity.client?.email ?? opportunity.lead?.email) ? (
                <span className="text-foreground/70" dir="ltr">
                  {opportunity.client?.email ?? opportunity.lead?.email}
                </span>
              ) : null}
              {(opportunity.client?.phone ?? opportunity.lead?.phone) ? (
                <span className="text-foreground/70" dir="ltr">
                  {opportunity.client?.phone ?? opportunity.lead?.phone}
                </span>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("owner")}</CardTitle>
            </CardHeader>
            <CardContent>
              {canWrite ? (
                <OwnerReassignSelect
                  id={opportunity.id}
                  currentOwnerId={opportunity.ownerId}
                  staff={staff}
                  action={reassignOpportunityOwnerAction}
                />
              ) : (
                <p className="text-sm text-foreground/70">
                  {opportunity.ownerId ? nameById.get(opportunity.ownerId) : t("unassigned")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tasks")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {canWrite ? <AddTaskForm opportunityId={opportunity.id} staff={staff} /> : null}
              <TaskList
                tasks={opportunity.tasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  status: task.status,
                  priority: task.priority,
                  dueAt: task.dueAt ? task.dueAt.toISOString() : null,
                  assigneeName: task.assigneeId ? (nameById.get(task.assigneeId) ?? null) : null,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-foreground/50">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
