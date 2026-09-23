import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { assertProjectManagerInScope } from "@/server/core/authz/ownership";
import { resolveOwnerNames } from "@/server/core/crm/owners";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/server/core/money";
import { ForbiddenError } from "@/server/core/errors";
import { computeProjectProgress } from "@/server/core/projects/progress";
import { Timeline } from "@/components/crm/timeline";
import { TaskList } from "@/components/crm/task-list";
import { AddTaskForm } from "@/components/crm/add-task-form";
import { ProjectStatusControl } from "@/app/[locale]/admin/projects/[id]/project-status-control";
import { ProjectMembers } from "@/app/[locale]/admin/projects/[id]/project-members";
import { ProjectMilestones } from "@/app/[locale]/admin/projects/[id]/project-milestones";
import { ProjectProgressMode } from "@/app/[locale]/admin/projects/[id]/project-progress-mode";
import { ProjectFiles } from "@/app/[locale]/admin/projects/[id]/project-files";
import { ProjectMessages } from "@/app/[locale]/admin/projects/[id]/project-messages";

const INVOICE_STATUS_TONE = {
  DRAFT: "neutral",
  SENT: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
} as const;

const STATUS_TONE = {
  PLANNING: "neutral",
  IN_PROGRESS: "info",
  WAITING_CLIENT: "warning",
  REVIEW: "brand",
  COMPLETED: "success",
  ARCHIVED: "neutral",
} as const;

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "project.read")) {
    return <Forbidden />;
  }

  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("admin.projects.detail");

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      opportunity: true,
      quote: true,
      members: true,
      milestones: { orderBy: { position: "asc" } },
      tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
      statusChanges: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { occurredAt: "desc" }, take: 30 },
      files: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) notFound();

  try {
    assertProjectManagerInScope(currentUser, "project.read", project.managerId ?? project.client.ownerId);
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
    project.managerId,
    ...project.members.map((m) => m.userId),
    ...project.tasks.map((task) => task.assigneeId),
    ...project.statusChanges.map((change) => change.changedById),
    ...project.files.map((file) => file.uploadedById),
  ]);

  const canWrite = hasPermission(currentUser, "project.write");
  const canReadFiles = hasPermission(currentUser, "file.read");
  const canWriteFiles = hasPermission(currentUser, "file.write");
  const canReadMessages = hasPermission(currentUser, "message.read");
  const progress = computeProjectProgress(project.progressMode, {
    progressManual: project.progressManual,
    tasks: project.tasks,
    milestones: project.milestones,
  });
  const canReadInvoices = hasPermission(currentUser, "invoice.read");

  // Résumé financier (§F.5/§F.7) : Devisé = total du devis accepté (à
  // défaut le budget saisi manuellement) ; Facturé = somme des factures
  // émises, un avoir (CREDIT_NOTE) venant en déduction ; Encaissé = somme
  // des montants réellement payés ; Reste à facturer = Devisé − Facturé.
  // Les brouillons et factures annulées ne comptent ni en Facturé ni en
  // Encaissé — un brouillon n'est pas encore engageant, une annulation
  // n'a jamais eu lieu comptablement.
  const issuedInvoices = project.invoices.filter((invoice) => invoice.status !== "DRAFT" && invoice.status !== "CANCELLED");
  const quoted = project.quote?.total ?? project.budget ?? 0n;
  const billed = issuedInvoices.reduce(
    (sum, invoice) => sum + (invoice.type === "CREDIT_NOTE" ? -invoice.total : invoice.total),
    0n,
  );
  const collected = issuedInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0n);
  const remainingToBill = quoted - billed;
  const financialCurrency = project.currency ?? project.quote?.currency ?? "DZD";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-brand-600">{project.number}</p>
          <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={STATUS_TONE[project.status]}>{t(`statusValue.${project.status}`)}</Badge>
            <Link href={`/admin/clients/${project.client.id}`} className="text-sm text-foreground/70 hover:underline">
              {project.client.displayName}
            </Link>
            {project.opportunity ? (
              <Link href={`/admin/crm/opportunities/${project.opportunity.id}`} className="text-sm text-foreground/70 hover:underline">
                {project.opportunity.number}
              </Link>
            ) : null}
            {project.quote ? (
              <Link href={`/admin/quotes/${project.quote.id}`} className="text-sm text-foreground/70 hover:underline">
                {project.quote.number}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canWrite ? <ProjectStatusControl projectId={project.id} currentStatus={project.status} /> : null}
          <Link href="/admin/projects" className="text-sm font-medium text-brand-600 hover:underline">
            {t("backToProjects")}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("progressTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectProgressMode
                projectId={project.id}
                currentMode={project.progressMode}
                currentManual={project.progressManual}
                currentProgress={progress}
                canWrite={canWrite}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("milestones")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectMilestones
                projectId={project.id}
                canWrite={canWrite}
                milestones={project.milestones.map((m) => ({
                  id: m.id,
                  title: m.title,
                  description: m.description,
                  dueDate: m.dueDate ? m.dueDate.toISOString() : null,
                  status: m.status,
                  weight: m.weight,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tasks")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {canWrite ? <AddTaskForm projectId={project.id} staff={staff} /> : null}
              <TaskList
                tasks={project.tasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  status: task.status,
                  priority: task.priority,
                  dueAt: task.dueAt ? task.dueAt.toISOString() : null,
                  assigneeName: task.assigneeId ? (nameById.get(task.assigneeId) ?? null) : null,
                  isProjectTask: true,
                }))}
              />
            </CardContent>
          </Card>

          {canReadFiles ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("file.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectFiles
                  projectId={project.id}
                  canWrite={canWriteFiles}
                  files={project.files.map((file) => ({
                    id: file.id,
                    originalName: file.originalName,
                    mimeType: file.mimeType,
                    sizeBytes: file.sizeBytes.toString(),
                    category: file.category,
                    visibility: file.visibility,
                    createdAt: file.createdAt.toISOString(),
                    uploaderName: file.uploadedById ? (nameById.get(file.uploadedById) ?? null) : null,
                  }))}
                />
              </CardContent>
            </Card>
          ) : null}

          {canReadMessages ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("message.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectMessages projectId={project.id} />
              </CardContent>
            </Card>
          ) : null}

          {canReadInvoices ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("invoice.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                {project.invoices.length === 0 ? (
                  <p className="text-sm text-foreground/50">{t("invoice.empty")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {project.invoices.map((invoice) => (
                      <Link
                        key={invoice.id}
                        href={`/admin/invoices/${invoice.id}`}
                        className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-surface-muted"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{invoice.number ?? t("invoice.draftLabel")}</span>
                          <span className="text-xs text-foreground/50">{t(`invoice.typeValue.${invoice.type}`)}</span>
                        </div>
                        <div className="flex items-center gap-2" dir="ltr">
                          <span className="text-foreground/70">{formatMoney(invoice.total, invoice.currency, locale)}</span>
                          <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{t(`invoice.statusValue.${invoice.status}`)}</Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline
                activities={project.activities.map((activity) => ({
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
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("details")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Field label={t("budget")} value={project.budget != null ? formatMoney(project.budget, project.currency ?? "DZD", locale) : "—"} />
              <Field label={t("startDate")} value={project.startDate ? project.startDate.toLocaleDateString(locale) : t("notSpecified")} />
              <Field label={t("dueDate")} value={project.dueDate ? project.dueDate.toLocaleDateString(locale) : t("notSpecified")} />
              <Field label={t("manager")} value={project.managerId ? (nameById.get(project.managerId) ?? t("unassigned")) : t("unassigned")} />
              {project.description ? <p className="mt-2 whitespace-pre-wrap text-foreground/80">{project.description}</p> : null}
            </CardContent>
          </Card>

          {canReadInvoices ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("financial.title")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm" dir="ltr">
                <Field label={t("financial.quoted")} value={formatMoney(quoted, financialCurrency, locale)} />
                <Field label={t("financial.billed")} value={formatMoney(billed, financialCurrency, locale)} />
                <Field label={t("financial.collected")} value={formatMoney(collected, financialCurrency, locale)} />
                <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                  <span>{t("financial.remainingToBill")}</span>
                  <span>{formatMoney(remainingToBill, financialCurrency, locale)}</span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("membersTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectMembers
                projectId={project.id}
                canWrite={canWrite}
                staff={staff}
                members={project.members.map((m) => ({
                  userId: m.userId,
                  role: m.role,
                  name: nameById.get(m.userId) ?? "—",
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("statusHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              {project.statusChanges.length === 0 ? (
                <p className="text-sm text-foreground/50">{t("noStatusChanges")}</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {project.statusChanges.map((change) => (
                    <li key={change.id} className="border-b border-border pb-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <span>
                          {change.fromStatus ? t(`statusValue.${change.fromStatus}`) : t("initialStatus")} →{" "}
                          {t(`statusValue.${change.toStatus}`)}
                        </span>
                        <span className="text-xs text-foreground/50">
                          {change.changedById ? nameById.get(change.changedById) : t("automatic")} ·{" "}
                          {change.createdAt.toLocaleDateString(locale)}
                        </span>
                      </div>
                      {change.note ? <p className="mt-1 text-xs text-foreground/60">{change.note}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
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
