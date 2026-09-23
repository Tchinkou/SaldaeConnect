import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { formatMoney } from "@/server/core/money";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

const STATUS_TONE = {
  SENT: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CANCELLED: "neutral",
} as const;

/** Liste des factures du client (§F.5, §J) — les brouillons ne sont jamais visibles côté portail, ils n'existent pas encore pour lui. */
export default async function PortalInvoicesPage() {
  const currentUser = await getCurrentUser();
  const locale = await getLocale();
  const t = await getTranslations("portal.invoices");

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  const invoices = contact
    ? await prisma.invoice.findMany({
        where: { clientId: contact.clientId, status: { not: "DRAFT" } },
        orderBy: { issueDate: "desc" },
      })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>

      {invoices.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={`/portal/invoices/${invoice.id}`}>
              <Card className="transition-colors hover:border-brand-400">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-xs font-medium text-brand-600">{invoice.number}</p>
                    <p className="text-sm font-semibold text-foreground">{t(`typeValue.${invoice.type}`)}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-foreground" dir="ltr">
                      {formatMoney(invoice.total, invoice.currency, locale)}
                    </span>
                    <Badge tone={STATUS_TONE[invoice.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                      {t(`statusValue.${invoice.status}`)}
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
