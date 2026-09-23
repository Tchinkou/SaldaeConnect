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
import { addClientActivityAction, reassignClientOwnerAction } from "@/app/[locale]/admin/clients/[id]/actions";
import { ClientStatusSelect } from "@/app/[locale]/admin/clients/[id]/client-status-select";
import { ForbiddenError } from "@/server/core/errors";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "client.read")) {
    return <Forbidden />;
  }

  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("admin.crm.clientDetail");

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      contacts: true,
      activities: { orderBy: { occurredAt: "desc" } },
      tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
      opportunities: {
        orderBy: { createdAt: "desc" },
        include: { stage: { include: { translations: { where: { locale } } } }, service: { include: { translations: { where: { locale } } } } },
      },
    },
  });

  if (!client) notFound();

  try {
    assertOwnerInScope(currentUser, "client.read", client.ownerId);
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
    client.ownerId,
    ...client.activities.map((a) => a.actorId),
    ...client.tasks.map((task) => task.assigneeId),
  ]);

  const canWrite = hasPermission(currentUser, "client.write");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-foreground/50" dir="ltr">{client.code}</p>
          <h1 className="text-xl font-semibold text-foreground">{client.displayName}</h1>
          <div className="mt-1">{canWrite ? <ClientStatusSelect id={client.id} status={client.status} /> : <Badge>{t(`statusValue.${client.status}`)}</Badge>}</div>
        </div>
        <Link href="/admin/clients" className="text-sm font-medium text-brand-600 hover:underline">
          {t("backToClients")}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("identity")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {client.email ? <Field label={t("email")} value={client.email} dir="ltr" /> : null}
              {client.phone ? <Field label={t("phone")} value={client.phone} dir="ltr" /> : null}
              {client.city || client.country ? <Field label={t("location")} value={[client.city, client.country].filter(Boolean).join(", ")} /> : null}
              <Field label={t("createdAt")} value={client.createdAt.toLocaleDateString(locale)} />
            </CardContent>
          </Card>

          {client.contacts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("contacts")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y divide-border">
                  {client.contacts.map((contact) => (
                    <li key={contact.id} className="flex items-center justify-between py-2 text-sm">
                      <span>
                        {contact.firstName} {contact.lastName}
                        {contact.jobTitle ? ` — ${contact.jobTitle}` : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        {contact.isPrimary ? <Badge tone="brand">{t("primaryContact")}</Badge> : null}
                        {contact.email ? <span className="text-foreground/60" dir="ltr">{contact.email}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("opportunities")}</CardTitle>
            </CardHeader>
            <CardContent>
              {client.opportunities.length === 0 ? (
                <p className="text-sm text-foreground/50">{t("noOpportunities")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {client.opportunities.map((opportunity) => (
                    <li key={opportunity.id} className="flex items-center justify-between py-2">
                      <Link href={`/admin/crm/opportunities/${opportunity.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                        {opportunity.number} — {opportunity.service.translations[0]?.name ?? opportunity.service.id}
                      </Link>
                      <Badge tone={opportunity.stage.kind === "WON" ? "success" : opportunity.stage.kind === "LOST" ? "danger" : "brand"}>
                        {opportunity.stage.translations[0]?.name ?? opportunity.stage.key}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("comingSoon")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/60">{t("comingSoonBody")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {canWrite ? <AddActivityForm action={addClientActivityAction} extraInput={{ clientId: client.id }} /> : null}
              <Timeline
                activities={client.activities.map((activity) => ({
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
              <CardTitle className="text-base">{t("owner")}</CardTitle>
            </CardHeader>
            <CardContent>
              {canWrite ? (
                <OwnerReassignSelect id={client.id} currentOwnerId={client.ownerId} staff={staff} action={reassignClientOwnerAction} />
              ) : (
                <p className="text-sm text-foreground/70">{client.ownerId ? nameById.get(client.ownerId) : t("unassigned")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tasks")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {canWrite ? <AddTaskForm clientId={client.id} staff={staff} /> : null}
              <TaskList
                tasks={client.tasks.map((task) => ({
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

function Field({ label, value, dir }: { label: string; value: string; dir?: "ltr" }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-foreground/50">{label}</span>
      <span className="font-medium text-foreground" dir={dir}>
        {value}
      </span>
    </div>
  );
}
