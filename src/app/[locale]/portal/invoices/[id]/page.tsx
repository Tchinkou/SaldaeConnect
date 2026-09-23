import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser } from "@/server/core/authz/session";
import { formatMoney } from "@/server/core/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

const STATUS_TONE = {
  SENT: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
} as const;

export default async function PortalInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("portal.invoiceDetail");

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  if (!contact) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      originalInvoice: true,
      payments: { where: { status: "RECORDED" }, orderBy: { paidAt: "desc" } },
    },
  });

  if (!invoice || invoice.clientId !== contact.clientId || invoice.status === "DRAFT") notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/portal/invoices" className="text-sm font-medium text-brand-600 hover:underline">
          {t("backToInvoices")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-brand-600">{invoice.number}</p>
          <Badge tone={STATUS_TONE[invoice.status as keyof typeof STATUS_TONE] ?? "neutral"}>
            {t(`statusValue.${invoice.status}`)}
          </Badge>
        </div>
        <h1 className="text-xl font-semibold text-foreground">{t(`typeValue.${invoice.type}`)}</h1>
      </div>

      {invoice.status === "CANCELLED" ? (
        <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground/70">{t("cancelledNotice")}</p>
      ) : null}
      {invoice.status === "OVERDUE" ? (
        <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{t("overdueNotice")}</p>
      ) : null}

      {invoice.originalInvoice ? (
        <p className="text-sm text-foreground/70">
          {t("creditNoteOf")} <span className="font-medium text-foreground">{invoice.originalInvoice.number}</span>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-3 py-6 text-sm">
              {invoice.issueDate ? <InfoRow label={t("issueDate")} value={invoice.issueDate.toLocaleDateString(locale)} /> : null}
              {invoice.dueDate ? <InfoRow label={t("dueDate")} value={invoice.dueDate.toLocaleDateString(locale)} /> : null}
              {invoice.pdfFileId ? (
                <a href={`/api/files/${invoice.pdfFileId}`} className="text-sm font-medium text-brand-600 hover:underline">
                  {t("downloadPdf")}
                </a>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("items")}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-foreground/50">
                    <th className="pb-2 font-medium">{t("itemTitle")}</th>
                    <th className="pb-2 font-medium">{t("itemQuantity")}</th>
                    <th className="pb-2 font-medium">{t("itemUnitPrice")}</th>
                    <th className="pb-2 text-end font-medium">{t("itemTotal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 text-foreground">{item.title}</td>
                      <td className="py-2 text-foreground/70">{Number(item.quantity)}</td>
                      <td className="py-2 text-foreground/70" dir="ltr">
                        {formatMoney(item.unitPrice, invoice.currency, locale)}
                      </td>
                      <td className="py-2 text-end font-medium text-foreground" dir="ltr">
                        {formatMoney(item.lineTotal, invoice.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {invoice.payments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("payments")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between">
                    <span className="text-foreground/70">{payment.paidAt.toLocaleDateString(locale)}</span>
                    <span className="font-medium text-foreground" dir="ltr">
                      {formatMoney(payment.amount, invoice.currency, locale)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("totals")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm" dir="ltr">
              <TotalRow label={t("subtotal")} value={formatMoney(invoice.subtotal, invoice.currency, locale)} />
              <TotalRow label={t("discountTotal")} value={`-${formatMoney(invoice.discountTotal, invoice.currency, locale)}`} />
              <TotalRow label={t("taxTotal")} value={formatMoney(invoice.taxTotal, invoice.currency, locale)} />
              <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
                <span>{t("total")}</span>
                <span>{formatMoney(invoice.total, invoice.currency, locale)}</span>
              </div>
              <TotalRow label={t("amountPaid")} value={formatMoney(invoice.amountPaid, invoice.currency, locale)} />
              <TotalRow label={t("balanceDue")} value={formatMoney(invoice.balanceDue, invoice.currency, locale)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-foreground/50">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-foreground/60">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
