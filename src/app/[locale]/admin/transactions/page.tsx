import { getFormatter, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { transactionOrderWhereClause } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { TransactionOrderStatus } from "@/generated/prisma/client";

const STATUS_TONE: Record<TransactionOrderStatus, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  REQUESTED: "warning",
  PRICE_CONFIRMED: "brand",
  AWAITING_PAYMENT: "info",
  PAID: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export default async function TransactionOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "transaction.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.transactions");
  const format = await getFormatter();
  const params = await searchParams;

  const where: Record<string, unknown> = { ...transactionOrderWhereClause(currentUser, "transaction.read") };
  if (params.status) where.status = params.status;

  const orders = await prisma.transactionOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { client: { select: { displayName: true } } },
  });

  const statuses: TransactionOrderStatus[] = ["REQUESTED", "PRICE_CONFIRMED", "AWAITING_PAYMENT", "PAID", "COMPLETED", "CANCELLED"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/transactions/products" className="text-sm font-medium text-brand-600 hover:underline">
            {t("manageProducts")}
          </Link>
          {hasPermission(currentUser, "transaction.write") ? (
            <Link
              href="/admin/transactions/new"
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("newOrder")}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/transactions"
          className={`rounded-full px-3 py-1 text-xs font-medium ${!params.status ? "bg-brand-600 text-white" : "bg-surface text-foreground/70 border border-border"}`}
        >
          {t("statusAll")}
        </Link>
        {statuses.map((status) => (
          <Link
            key={status}
            href={{ pathname: "/admin/transactions", query: { status } }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${params.status === status ? "bg-brand-600 text-white" : "bg-surface text-foreground/70 border border-border"}`}
          >
            {t(`statusValue.${status}`)}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs font-medium text-foreground/70">
              <tr>
                <th className="px-4 py-3">{t("number")}</th>
                <th className="px-4 py-3">{t("client")}</th>
                <th className="px-4 py-3">{t("total")}</th>
                <th className="px-4 py-3">{t("createdAt")}</th>
                <th className="px-4 py-3">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3">
                    <Link href={`/admin/transactions/${order.id}`} className="font-medium text-brand-600 hover:underline">
                      {order.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{order.client?.displayName ?? "—"}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {order.total.toString()} {order.currency}
                  </td>
                  <td className="px-4 py-3">{format.dateTime(order.createdAt, { dateStyle: "medium" })}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[order.status]}>{t(`statusValue.${order.status}`)}</Badge>
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-foreground/70">
                    {t("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
