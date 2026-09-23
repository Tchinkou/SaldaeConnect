import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { quoteWhereClause } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/server/core/money";
import { QuoteFilters } from "@/app/[locale]/admin/quotes/quote-filters";
import type { QuoteStatus } from "@/generated/prisma/client";

const STATUS_TONE: Record<QuoteStatus, "neutral" | "brand" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  SENT: "info",
  VIEWED: "brand",
  ACCEPTED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
  EXPIRED: "danger",
  CANCELLED: "neutral",
};

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "quote.read")) {
    return <Forbidden />;
  }

  const t = await getTranslations("admin.quotes");
  const locale = await getLocale();
  const params = await searchParams;

  const where: Record<string, unknown> = { ...quoteWhereClause(currentUser, "quote.read") };
  if (params.status) where.status = params.status;
  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { number: { contains: params.q, mode: "insensitive" } },
      { client: { displayName: { contains: params.q, mode: "insensitive" } } },
    ];
  }

  const quotes = await prisma.quote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { client: true },
  });

  const canWrite = hasPermission(currentUser, "quote.write");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
        </div>
        {canWrite ? (
          <Link href="/admin/quotes/new" className={buttonVariants({ size: "sm" })}>
            {t("new")}
          </Link>
        ) : null}
      </div>

      <QuoteFilters currentParams={params} />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-foreground/60">
                <tr>
                  <th className="px-3 py-2 text-start">{t("number")}</th>
                  <th className="px-3 py-2 text-start">{t("client")}</th>
                  <th className="px-3 py-2 text-start">{t("status")}</th>
                  <th className="px-3 py-2 text-start">{t("total")}</th>
                  <th className="px-3 py-2 text-start">{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-surface-muted">
                    <td className="px-3 py-2">
                      <Link href={`/admin/quotes/${quote.id}`} className="font-medium text-brand-600 hover:underline">
                        {quote.number ?? t("draftLabel")}
                      </Link>
                      <p className="text-xs text-foreground/50">{quote.title}</p>
                    </td>
                    <td className="px-3 py-2 text-foreground/70">{quote.client.displayName}</td>
                    <td className="px-3 py-2">
                      <Badge tone={STATUS_TONE[quote.status]}>{t(`statusValue.${quote.status}`)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-foreground/70" dir="ltr">
                      {formatMoney(quote.total, quote.currency, locale)}
                    </td>
                    <td className="px-3 py-2 text-foreground/60">{quote.createdAt.toLocaleDateString(locale)}</td>
                  </tr>
                ))}
                {quotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-foreground/50">
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
