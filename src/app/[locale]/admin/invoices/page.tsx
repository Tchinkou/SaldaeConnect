import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { invoiceWhereClause } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/server/core/money";
import type { InvoiceStatus } from "@/generated/prisma/client";

const STATUS_TONE: Record<InvoiceStatus, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  SENT: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "invoice.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.invoices");
  const locale = await getLocale();
  const params = await searchParams;

  const where: Record<string, unknown> = { ...invoiceWhereClause(currentUser, "invoice.read") };
  if (params.status) where.status = params.status;

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { client: true },
  });

  const canWrite = hasPermission(currentUser, "invoice.write");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
        </div>
        {canWrite ? (
          <Link href="/admin/invoices/new" className={buttonVariants({ size: "sm" })}>
            {t("new")}
          </Link>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-3 py-2 text-start">{t("number")}</th>
                  <th className="px-3 py-2 text-start">{t("client")}</th>
                  <th className="px-3 py-2 text-start">{t("type")}</th>
                  <th className="px-3 py-2 text-start">{t("status")}</th>
                  <th className="px-3 py-2 text-start">{t("total")}</th>
                  <th className="px-3 py-2 text-start">{t("balanceDue")}</th>
                  <th className="px-3 py-2 text-start">{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-surface-muted">
                    <td className="px-3 py-2">
                      <Link href={`/admin/invoices/${invoice.id}`} className="font-medium text-brand-600 hover:underline">
                        {invoice.number ?? t("draftLabel")}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground/70">{invoice.client.displayName}</td>
                    <td className="px-3 py-2 text-foreground/70">{t(`typeValue.${invoice.type}`)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_TONE[invoice.status]}>{t(`statusValue.${invoice.status}`)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-foreground/70" dir="ltr">
                      {formatMoney(invoice.total, invoice.currency, locale)}
                    </td>
                    <td className="px-3 py-2 text-foreground/70" dir="ltr">
                      {formatMoney(invoice.balanceDue, invoice.currency, locale)}
                    </td>
                    <td className="px-3 py-2 text-foreground/60">{invoice.createdAt.toLocaleDateString(locale)}</td>
                  </tr>
                ))}
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-foreground/50">
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
