import { getTranslations, getFormatter } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";

export default async function AuditPage() {
  const currentUser = await getCurrentUser();
  if (!hasPermission(currentUser, "audit.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.audit");
  const format = await getFormatter();

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-foreground/70">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-foreground/50">
                  <th className="px-2 py-2 text-start font-medium">{t("columns.date")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("columns.actor")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("columns.action")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("columns.entity")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-2 py-2 text-foreground/70">
                      {format.dateTime(entry.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-2 py-2 text-foreground">{entry.actorLabel ?? t("system")}</td>
                    <td className="px-2 py-2 font-mono text-xs text-foreground/80">{entry.action}</td>
                    <td className="px-2 py-2 text-foreground/70">
                      {entry.entityLabel ?? entry.entityType ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
