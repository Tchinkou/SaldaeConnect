import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { formatMoney } from "@/server/core/money";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

const STATUS_TONE = {
  SENT: "info",
  VIEWED: "brand",
  ACCEPTED: "success",
  REJECTED: "danger",
  CHANGES_REQUESTED: "warning",
  EXPIRED: "danger",
  CANCELLED: "neutral",
} as const;

/** Liste des devis du client (§J) — les brouillons ne sont jamais visibles côté portail, ils n'existent pas encore pour lui. */
export default async function PortalQuotesPage() {
  const currentUser = await getCurrentUser();
  const locale = await getLocale();
  const t = await getTranslations("portal.quotes");

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  const quotes = contact
    ? await prisma.quote.findMany({
        where: { clientId: contact.clientId, status: { not: "DRAFT" } },
        orderBy: { sentAt: "desc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>

      {quotes.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {quotes.map((quote) => (
            <Link key={quote.id} href={`/portal/quotes/${quote.id}`}>
              <Card className="transition-colors hover:border-brand-400">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-xs font-medium text-brand-600">{quote.number}</p>
                    <p className="text-sm font-semibold text-foreground">{quote.title}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-foreground" dir="ltr">
                      {formatMoney(quote.total, quote.currency, locale)}
                    </span>
                    <Badge tone={STATUS_TONE[quote.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                      {t(`statusValue.${quote.status}`)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
