import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { assertInvoiceOwnerInScope } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/server/core/money";
import { ForbiddenError } from "@/server/core/errors";
import { InvoiceHeaderForm } from "@/app/[locale]/admin/invoices/[id]/invoice-header-form";
import { InvoiceItemsEditor } from "@/app/[locale]/admin/invoices/[id]/invoice-items-editor";
import { DeleteInvoiceButton } from "@/app/[locale]/admin/invoices/[id]/delete-invoice-button";
import { IssueInvoiceButton } from "@/app/[locale]/admin/invoices/[id]/issue-invoice-button";
import { CancelInvoiceButton } from "@/app/[locale]/admin/invoices/[id]/cancel-invoice-button";
import { CreateCreditNoteButton } from "@/app/[locale]/admin/invoices/[id]/create-credit-note-button";

const STATUS_TONE = {
  DRAFT: "neutral",
  SENT: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
} as const;

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "invoice.read")) {
    return <Forbidden />;
  }

  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("admin.invoices.detail");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      quote: true,
      originalInvoice: true,
      creditNotes: { orderBy: { createdAt: "asc" } },
      items: { orderBy: { position: "asc" } },
    },
  });

  if (!invoice) notFound();

  try {
    assertInvoiceOwnerInScope(currentUser, "invoice.read", invoice.client.ownerId);
  } catch (error) {
    if (error instanceof ForbiddenError) return <Forbidden />;
    throw error;
  }

  const canWrite = hasPermission(currentUser, "invoice.write") && invoice.status === "DRAFT";
  const canIssue = hasPermission(currentUser, "invoice.issue") && invoice.status === "DRAFT" && invoice.items.length > 0;
  const canCancel =
    hasPermission(currentUser, "invoice.issue") && (invoice.status === "SENT" || invoice.status === "OVERDUE");
  const canCreateCreditNote =
    hasPermission(currentUser, "invoice.write") && invoice.type !== "CREDIT_NOTE" && invoice.status !== "DRAFT";

  const [taxRates, services] = await Promise.all([
    prisma.taxRate.findMany({ where: { isActive: true }, orderBy: { ratePercent: "asc" } }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: { translations: { where: { locale } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-brand-600">{invoice.number ?? t("draftLabel")}</p>
          <h1 className="text-xl font-semibold text-foreground">{t(`typeValue.${invoice.type}`)}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={STATUS_TONE[invoice.status]}>{t(`statusValue.${invoice.status}`)}</Badge>
            <Link href={`/admin/clients/${invoice.client.id}`} className="text-sm text-foreground/70 hover:underline">
              {invoice.client.displayName}
            </Link>
            {invoice.project ? (
              <Link href={`/admin/projects/${invoice.project.id}`} className="text-sm text-foreground/70 hover:underline">
                {invoice.project.number}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {invoice.pdfFileId ? (
            <a href={`/api/files/${invoice.pdfFileId}`} className="text-sm font-medium text-brand-600 hover:underline">
              {t("downloadPdf")}
            </a>
          ) : null}
          {canIssue ? <IssueInvoiceButton invoiceId={invoice.id} /> : null}
          {canCreateCreditNote ? <CreateCreditNoteButton invoiceId={invoice.id} /> : null}
          {canCancel ? <CancelInvoiceButton invoiceId={invoice.id} /> : null}
          {canWrite ? <DeleteInvoiceButton invoiceId={invoice.id} clientId={invoice.client.id} /> : null}
          <Link href="/admin/invoices" className="text-sm font-medium text-brand-600 hover:underline">
            {t("backToInvoices")}
          </Link>
        </div>
      </div>

      {!canWrite && invoice.status !== "DRAFT" ? (
        <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground/70">{t("lockedNotice")}</p>
      ) : null}

      {invoice.status === "CANCELLED" && invoice.cancelReason ? (
        <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {t("cancelledNotice", { reason: invoice.cancelReason })}
        </p>
      ) : null}

      {invoice.originalInvoice ? (
        <p className="text-sm text-foreground/70">
          {t("creditNoteOf")}{" "}
          <Link href={`/admin/invoices/${invoice.originalInvoice.id}`} className="font-medium text-brand-600 hover:underline">
            {invoice.originalInvoice.number ?? t("draftLabel")}
          </Link>
        </p>
      ) : null}

      {invoice.creditNotes.length > 0 ? (
        <div className="text-sm text-foreground/70">
          {t("creditNotesList")}{" "}
          {invoice.creditNotes.map((cn, index) => (
            <span key={cn.id}>
              {index > 0 ? ", " : ""}
              <Link href={`/admin/invoices/${cn.id}`} className="font-medium text-brand-600 hover:underline">
                {cn.number ?? t("draftLabel")}
              </Link>
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("header")}</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceHeaderForm
                invoiceId={invoice.id}
                canWrite={canWrite}
                dueDate={invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null}
                terms={invoice.terms}
                notes={invoice.notes}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("items")}</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceItemsEditor
                invoiceId={invoice.id}
                currency={invoice.currency}
                canWrite={canWrite}
                items={invoice.items.map((item) => ({
                  id: item.id,
                  serviceId: item.serviceId,
                  title: item.title,
                  description: item.description,
                  quantity: Number(item.quantity),
                  unit: item.unit,
                  unitPrice: Number(item.unitPrice) / 100,
                  discountPercent: Number(item.discountPercent),
                  taxRateId: item.taxRateId,
                  taxRatePercent: item.taxRatePercent != null ? Number(item.taxRatePercent) : null,
                  lineTotal: Number(item.lineTotal) / 100,
                }))}
                taxRates={taxRates.map((rate) => ({ id: rate.id, name: rate.name, ratePercent: Number(rate.ratePercent) }))}
                services={services.map((service) => ({
                  id: service.id,
                  name: service.translations[0]?.name ?? service.id,
                  indicativePrice: service.indicativePrice != null ? Number(service.indicativePrice) / 100 : null,
                  indicativeCurrency: service.indicativeCurrency,
                }))}
              />
            </CardContent>
          </Card>
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
              {invoice.status !== "DRAFT" ? (
                <>
                  <TotalRow label={t("amountPaid")} value={formatMoney(invoice.amountPaid, invoice.currency, locale)} />
                  <TotalRow label={t("balanceDue")} value={formatMoney(invoice.balanceDue, invoice.currency, locale)} />
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
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
