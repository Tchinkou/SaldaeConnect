import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { ownerWhereClause } from "@/server/core/authz/ownership";
import { resolveOwnerNames } from "@/server/core/crm/owners";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { ClientFilters } from "@/app/[locale]/admin/clients/client-filters";

const STATUS_TONE = { PROSPECT: "brand", ACTIVE: "success", INACTIVE: "neutral" } as const;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "client.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.crm.clients");
  const locale = await getLocale();
  const params = await searchParams;

  const where: Record<string, unknown> = { ...ownerWhereClause(currentUser, "client.read"), deletedAt: null };
  if (params.status) where.status = params.status;
  if (params.q) {
    where.OR = [
      { displayName: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
      { code: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const clients = await prisma.client.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });

  const ownerNameById = await resolveOwnerNames(clients.map((c) => c.ownerId));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </div>

      <ClientFilters currentParams={params} />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-3 py-2 text-start">{t("code")}</th>
                  <th className="px-3 py-2 text-start">{t("name")}</th>
                  <th className="px-3 py-2 text-start">{t("status")}</th>
                  <th className="px-3 py-2 text-start">{t("owner")}</th>
                  <th className="px-3 py-2 text-start">{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-surface-muted">
                    <td className="px-3 py-2 text-xs text-foreground/60" dir="ltr">
                      {client.code}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/clients/${client.id}`} className="font-medium text-brand-600 hover:underline">
                        {client.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_TONE[client.status]}>{t(`statusValue.${client.status}`)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-foreground/70">
                      {client.ownerId ? (ownerNameById.get(client.ownerId) ?? "—") : t("unassigned")}
                    </td>
                    <td className="px-3 py-2 text-foreground/60">{client.createdAt.toLocaleDateString(locale)}</td>
                  </tr>
                ))}
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-foreground/70">
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
