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
import { OwnerReassignSelect } from "@/components/crm/owner-reassign-select";
import { addLeadActivityAction, reassignLeadOwnerAction } from "@/app/[locale]/admin/leads/[id]/actions";
import { LeadActions } from "@/app/[locale]/admin/leads/[id]/lead-actions";
import { ForbiddenError } from "@/server/core/errors";

const STATUS_TONE = { OPEN: "brand", CONVERTED: "success", DISQUALIFIED: "neutral" } as const;

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "lead.read")) {
    return <Forbidden />;
  }

  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("admin.crm.lead");

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      source: { include: { translations: { where: { locale } } } },
      activities: { orderBy: { occurredAt: "desc" } },
      opportunities: {
        orderBy: { createdAt: "desc" },
        include: { stage: { include: { translations: { where: { locale } } } }, service: { include: { translations: { where: { locale } } } } },
      },
    },
  });

  if (!lead) notFound();

  try {
    assertOwnerInScope(currentUser, "lead.read", lead.ownerId);
  } catch (error) {
    if (error instanceof ForbiddenError) return <Forbidden />;
    throw error;
  }

  const staff = await prisma.user.findMany({
    where: { userType: "STAFF", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const nameById = await resolveOwnerNames([lead.ownerId, ...lead.activities.map((a) => a.actorId)]);
  const canWrite = hasPermission(currentUser, "lead.write");
  const canConvert = hasPermission(currentUser, "client.write") && lead.status !== "CONVERTED";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {lead.firstName} {lead.lastName}
          </h1>
          {lead.companyName ? <p className="text-sm text-foreground/60">{lead.companyName}</p> : null}
          <div className="mt-1">
            <Badge tone={STATUS_TONE[lead.status]}>{t(`statusValue.${lead.status}`)}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LeadActions leadId={lead.id} canConvert={canConvert} />
          <Link href="/admin/leads" className="text-sm font-medium text-brand-600 hover:underline">
            {t("backToLeads")}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("identity")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {lead.email ? <Field label={t("email")} value={lead.email} dir="ltr" /> : null}
              {lead.phone ? <Field label={t("phone")} value={lead.phone} dir="ltr" /> : null}
              {lead.city || lead.country ? <Field label={t("location")} value={[lead.city, lead.country].filter(Boolean).join(", ")} /> : null}
              <Field label={t("source")} value={lead.source?.translations[0]?.name ?? "—"} />
              <Field label={t("createdAt")} value={lead.createdAt.toLocaleDateString(locale)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("opportunities")}</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.opportunities.length === 0 ? (
                <p className="text-sm text-foreground/50">{t("noOpportunities")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {lead.opportunities.map((opportunity) => (
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
              <CardTitle className="text-base">{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {canWrite ? <AddActivityForm action={addLeadActivityAction} extraInput={{ leadId: lead.id }} /> : null}
              <Timeline
                activities={lead.activities.map((activity) => ({
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
                <OwnerReassignSelect id={lead.id} currentOwnerId={lead.ownerId} staff={staff} action={reassignLeadOwnerAction} />
              ) : (
                <p className="text-sm text-foreground/70">{lead.ownerId ? nameById.get(lead.ownerId) : t("unassigned")}</p>
              )}
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
