import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser } from "@/server/core/authz/session";
import { formatMoney } from "@/server/core/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { createNotifications } from "@/server/core/notify-admins";
import { resolveQuoteRecipients } from "@/server/core/quotes/notify";
import { QuoteDecisionPanel } from "@/app/[locale]/portal/quotes/[id]/quote-decision-panel";

const STATUS_TONE = {
  SENT: "info",
  VIEWED: "brand",
  ACCEPTED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
  EXPIRED: "danger",
  CANCELLED: "neutral",
} as const;

export default async function PortalQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  const { id } = await params;
  const locale = await getLocale();
  const t = await getTranslations("portal.quoteDetail");

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  if (!contact) notFound();

  let quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      items: { orderBy: { position: "asc" } },
      installments: { orderBy: { position: "asc" } },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  if (!quote || quote.clientId !== contact.clientId || quote.status === "DRAFT") notFound();

  // Première consultation (§F.2) : marquée au rendu, cette route n'étant
  // jamais servie au staff ni mise en cache (données par session client).
  if (quote.status === "SENT") {
    quote = await prisma.$transaction(async (tx) => {
      const updated = await tx.quote.update({
        where: { id: quote!.id },
        data: { status: "VIEWED", firstViewedAt: new Date() },
        include: {
          client: true,
          items: { orderBy: { position: "asc" } },
          installments: { orderBy: { position: "asc" } },
          versions: { orderBy: { version: "desc" }, take: 1 },
        },
      });

      const recipients = await resolveQuoteRecipients(tx, updated.client.ownerId);
      await createNotifications(
        recipients,
        "quote.viewed",
        { quoteId: updated.id, quoteNumber: updated.number, clientName: updated.client.displayName },
        `/admin/quotes/${updated.id}`,
      );

      return updated;
    });
  }

  const latestVersion = quote.versions[0] ?? null;
  const isExpired = quote.status !== "EXPIRED" && quote.validUntil && quote.validUntil < new Date();
  const canDecide = (quote.status === "SENT" || quote.status === "VIEWED") && !isExpired;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/portal/quotes" className="text-sm font-medium text-brand-600 hover:underline">
          {t("backToQuotes")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-brand-600">{quote.number}</p>
          <Badge tone={STATUS_TONE[quote.status as keyof typeof STATUS_TONE] ?? "neutral"}>
            {t(`statusValue.${quote.status}`)}
          </Badge>
        </div>
        <h1 className="text-xl font-semibold text-foreground">{quote.title}</h1>
      </div>

      {isExpired ? (
        <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{t("expiredNotice")}</p>
      ) : null}
      {quote.status === "ACCEPTED" ? (
        <p className="rounded-md border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700">{t("acceptedNotice")}</p>
      ) : null}
      {quote.status === "REJECTED" ? (
        <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-foreground/70">{t("rejectedNotice")}</p>
      ) : null}
      {quote.status === "CHANGES_REQUESTED" ? (
        <p className="rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
          {t("changesRequestedNotice")}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-3 py-6 text-sm">
              {quote.sentAt ? <InfoRow label={t("sentAt")} value={quote.sentAt.toLocaleDateString(locale)} /> : null}
              {quote.validUntil ? <InfoRow label={t("validUntil")} value={quote.validUntil.toLocaleDateString(locale)} /> : null}
              {quote.introduction ? (
                <div className="flex flex-col gap-1">
                  <span className="text-foreground/50">{t("introduction")}</span>
                  <p className="whitespace-pre-wrap text-foreground/80">{quote.introduction}</p>
                </div>
              ) : null}
              {latestVersion?.pdfFileId ? (
                <a
                  href={`/api/files/${latestVersion.pdfFileId}`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
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
                  {quote.items.map((item) => (
                    <tr key={item.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 text-foreground">{item.title}</td>
                      <td className="py-2 text-foreground/70">{Number(item.quantity)}</td>
                      <td className="py-2 text-foreground/70" dir="ltr">
                        {formatMoney(item.unitPrice, quote.currency, locale)}
                      </td>
                      <td className="py-2 text-end font-medium text-foreground" dir="ltr">
                        {formatMoney(item.lineTotal, quote.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {quote.installments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("installments")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {quote.installments.map((installment) => (
                  <div key={installment.id} className="flex items-center justify-between">
                    <span className="text-foreground">{installment.label}</span>
                    <span className="text-foreground/70" dir="ltr">
                      {installment.amount != null
                        ? formatMoney(installment.amount, quote.currency, locale)
                        : `${Number(installment.percent)}%`}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {canDecide ? <QuoteDecisionPanel quoteId={quote.id} defaultSignerName={currentUser!.user.name ?? ""} /> : null}
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
