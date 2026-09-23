import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { assertQuoteOwnerInScope } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/server/core/money";
import { ForbiddenError } from "@/server/core/errors";
import { QuoteHeaderForm } from "@/app/[locale]/admin/quotes/[id]/quote-header-form";
import { QuoteItemsEditor } from "@/app/[locale]/admin/quotes/[id]/quote-items-editor";
import { QuoteInstallmentsEditor } from "@/app/[locale]/admin/quotes/[id]/quote-installments-editor";
import { DeleteQuoteButton } from "@/app/[locale]/admin/quotes/[id]/delete-quote-button";

const STATUS_TONE = {
  DRAFT: "neutral",
  SENT: "info",
  VIEWED: "brand",
  ACCEPTED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
  EXPIRED: "danger",
  CANCELLED: "neutral",
} as const;

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "quote.read")) {
    return <Forbidden />;
  }

  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("admin.quotes.detail");

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      opportunity: true,
      items: { orderBy: { position: "asc" } },
      installments: { orderBy: { position: "asc" } },
    },
  });

  if (!quote) notFound();

  try {
    assertQuoteOwnerInScope(currentUser, "quote.read", quote.client.ownerId);
  } catch (error) {
    if (error instanceof ForbiddenError) return <Forbidden />;
    throw error;
  }

  const canWrite = hasPermission(currentUser, "quote.write") && quote.status === "DRAFT";

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
          <p className="text-xs font-medium text-brand-600">{quote.number ?? t("draftLabel")}</p>
          <h1 className="text-xl font-semibold text-foreground">{quote.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={STATUS_TONE[quote.status]}>{t(`statusValue.${quote.status}`)}</Badge>
            <Link href={`/admin/clients/${quote.client.id}`} className="text-sm text-foreground/70 hover:underline">
              {quote.client.displayName}
            </Link>
            {quote.opportunity ? (
              <Link href={`/admin/crm/opportunities/${quote.opportunity.id}`} className="text-sm text-foreground/70 hover:underline">
                {quote.opportunity.number}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canWrite ? <DeleteQuoteButton quoteId={quote.id} clientId={quote.client.id} /> : null}
          <Link href="/admin/quotes" className="text-sm font-medium text-brand-600 hover:underline">
            {t("backToQuotes")}
          </Link>
        </div>
      </div>

      {!canWrite && quote.status !== "DRAFT" ? (
        <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground/70">{t("lockedNotice")}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("header")}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteHeaderForm
                quoteId={quote.id}
                canWrite={canWrite}
                title={quote.title}
                validUntil={quote.validUntil ? quote.validUntil.toISOString().slice(0, 10) : null}
                introduction={quote.introduction}
                terms={quote.terms}
                internalNotes={quote.internalNotes}
                globalDiscountType={quote.globalDiscountType as "PERCENT" | "AMOUNT" | null}
                globalDiscountValue={
                  quote.globalDiscountValue == null
                    ? null
                    : quote.globalDiscountType === "PERCENT"
                      ? Number(quote.globalDiscountValue)
                      : Number(quote.globalDiscountValue) / 100
                }
                depositPercent={quote.depositPercent}
                depositAmount={quote.depositAmount != null ? Number(quote.depositAmount) / 100 : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("items")}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteItemsEditor
                quoteId={quote.id}
                currency={quote.currency}
                canWrite={canWrite}
                items={quote.items.map((item) => ({
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("installments")}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteInstallmentsEditor
                quoteId={quote.id}
                currency={quote.currency}
                canWrite={canWrite}
                installments={quote.installments.map((installment) => ({
                  id: installment.id,
                  label: installment.label,
                  percent: installment.percent != null ? Number(installment.percent) : null,
                  amount: installment.amount != null ? Number(installment.amount) / 100 : null,
                  trigger: installment.trigger,
                  milestoneKey: installment.milestoneKey,
                  dueDate: installment.dueDate ? installment.dueDate.toISOString().slice(0, 10) : null,
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
              <TotalRow label={t("subtotal")} value={formatMoney(quote.subtotal, quote.currency, locale)} />
              <TotalRow label={t("discountTotal")} value={`-${formatMoney(quote.discountTotal, quote.currency, locale)}`} />
              <TotalRow label={t("taxTotal")} value={formatMoney(quote.taxTotal, quote.currency, locale)} />
              <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
                <span>{t("total")}</span>
                <span>{formatMoney(quote.total, quote.currency, locale)}</span>
              </div>
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
