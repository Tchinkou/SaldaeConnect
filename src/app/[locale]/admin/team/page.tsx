import { getTranslations, getFormatter } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { InvitePanel } from "./invite-panel";
import { ResendButton } from "./resend-button";

const STATUS_TONE = {
  ACTIVE: "success",
  INVITED: "info",
  SUSPENDED: "danger",
} as const;

export default async function TeamPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "team.write")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.team");
  const format = await getFormatter();

  const [staff, pendingInvitations, roles] = await Promise.all([
    prisma.user.findMany({
      where: { userType: "STAFF" },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ where: { key: { not: "client" } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">{t("title")}</CardTitle>
            <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
          </div>
          <InvitePanel roles={roles.map((role) => ({ id: role.id, name: role.name }))} />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs uppercase text-foreground/50">
                  <th className="px-2 py-2 text-start font-medium">{t("columns.name")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("columns.email")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("columns.role")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("columns.status")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("columns.lastLogin")}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2 font-medium text-foreground">{member.name}</td>
                    <td className="px-2 py-2 text-foreground/70">{member.email}</td>
                    <td className="px-2 py-2 text-foreground/70">
                      {member.roles.map((userRole) => userRole.role.name).join(", ")}
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={STATUS_TONE[member.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {t(`status.${member.status}`)}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-foreground/70">
                      {member.lastLoginAt ? format.dateTime(member.lastLoginAt, { dateStyle: "medium" }) : t("never")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pendingInvitations")}</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInvitations.length === 0 ? (
            <p className="text-sm text-foreground/70">{t("noPendingInvitations")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {pendingInvitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{invitation.email}</p>
                    <p className="text-xs text-foreground/60">
                      {invitation.role?.name} · {t("invitedOn", { date: format.dateTime(invitation.createdAt, { dateStyle: "medium" }) })}
                    </p>
                  </div>
                  <ResendButton invitationId={invitation.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
