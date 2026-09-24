import { getFormatter, getTranslations } from "next-intl/server";
import { hasPermission } from "@/server/core/authz/session";
import { getCurrentUser } from "@/server/core/authz/session";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTransactionOrderAction } from "@/server/core/transactions/transaction-order-actions";
import { TransactionOrderStatusControl } from "./transaction-order-status-control";
import { TransactionPaymentsPanel } from "./transaction-payments-panel";
import type { TransactionOrderStatus } from "@/generated/prisma/client";
import { notFound } from "next/navigation";

const STATUS_TONE: Record<TransactionOrderStatus, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  REQUESTED: "warning",
  PRICE_CONFIRMED: "brand",
  AWAITING_PAYMENT: "info",
  PAID: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export default async function TransactionOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "transaction.read")) {
    return <Forbidden />;
  }

  const { id } = await params;
  const t = await getTranslations("admin.transactions.detail");
  const format = await getFormatter();

  const result = await getTransactionOrderAction({ orderId: id });
  if (!result.ok) notFound();
  const order = result.data;
  const identityData = order.identityData as { documentType?: string | null; documentNumber?: string | null } | null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{order.number}</h1>
          <p className="text-sm text-foreground/60">{order.client?.displayName}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={STATUS_TONE[order.status]}>{t(`statusValue.${order.status}`)}</Badge>
          {hasPermission(currentUser, "transaction.write") ? (
            <TransactionOrderStatusControl orderId={order.id} currentStatus={order.status} currentTotal={order.total} />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("items")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs font-medium text-foreground/50">
                  <tr>
                    <th className="px-4 py-3">{t("product")}</th>
                    <th className="px-4 py-3">{t("quantity")}</th>
                    <th className="px-4 py-3">{t("unitPrice")}</th>
                    <th className="px-4 py-3">{t("lineTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{item.product.translations[0]?.name ?? item.product.sku}</td>
                      <td className="px-4 py-3" dir="ltr">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        {item.unitPrice}
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        {item.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-medium text-foreground">
                      {t("total")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground" dir="ltr">
                      {order.total} {order.currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("payments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionPaymentsPanel
                orderId={order.id}
                canRecord={order.status === "AWAITING_PAYMENT" && hasPermission(currentUser, "transaction.write")}
                payments={order.payments.map((payment) => ({
                  id: payment.id,
                  amount: payment.amount,
                  currency: payment.currency,
                  reference: payment.reference,
                  status: payment.status,
                  paidAt: payment.paidAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("identity")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              {identityData?.documentType || identityData?.documentNumber ? (
                <>
                  <p>{identityData.documentType}</p>
                  <p dir="ltr">{identityData.documentNumber}</p>
                </>
              ) : (
                <p className="text-foreground/50">{t("noIdentity")}</p>
              )}
              {order.notes ? <p className="mt-2 whitespace-pre-wrap text-foreground/70">{order.notes}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {order.statusChanges.map((change) => (
                  <li key={change.id} className="flex flex-col">
                    <span className="font-medium text-foreground">{t(`statusValue.${change.toStatus}`)}</span>
                    <span className="text-xs text-foreground/50">{format.dateTime(change.createdAt, { dateStyle: "medium", timeStyle: "short" })}</span>
                    {change.note ? <span className="text-xs text-foreground/70">{change.note}</span> : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
