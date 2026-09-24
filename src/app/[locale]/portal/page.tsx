import { getTranslations, getFormatter } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { RecentNotifications } from "@/components/portal/recent-notifications";

/** Tableau de bord du portail (§16) : accès rapide aux devis/projets/factures, derniers documents, messages non lus, notifications récentes. */
export default async function PortalDashboardPage() {
  const currentUser = await getCurrentUser();
  const t = await getTranslations("portal.dashboard");
  const format = await getFormatter();

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  const clientId = contact?.clientId ?? null;

  const [recentProjectFiles, recentQuoteVersions, recentInvoices, conversationsRaw] = clientId
    ? await Promise.all([
        prisma.file.findMany({
          where: { project: { clientId }, visibility: "CLIENT", status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
        prisma.quoteVersion.findMany({
          where: { quote: { clientId }, pdfFileId: { not: null } },
          include: { quote: { select: { id: true, number: true } } },
          orderBy: { sentAt: "desc" },
          take: 3,
        }),
        prisma.invoice.findMany({
          where: { clientId, pdfFileId: { not: null }, status: { not: "DRAFT" } },
          select: { id: true, number: true, issueDate: true },
          orderBy: { issueDate: "desc" },
          take: 3,
        }),
        prisma.conversation.findMany({
          where: { clientId },
          include: { participants: { where: { userId: currentUser!.user.id } } },
        }),
      ])
    : [[], [], [], []];

  const recentDocuments = [
    ...recentProjectFiles.map((f) => ({ id: f.id, title: f.originalName, createdAt: f.createdAt })),
    ...recentQuoteVersions.map((v) => ({
      id: v.id,
      title: t("documentQuote", { number: v.quote.number ?? v.quote.id }),
      createdAt: v.sentAt,
    })),
    ...recentInvoices.map((i) => ({
      id: i.id,
      title: t("documentInvoice", { number: i.number ?? i.id }),
      createdAt: i.issueDate ?? new Date(),
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const unreadCount = (
    await Promise.all(
      conversationsRaw.map((conversation) =>
        prisma.message.count({
          where: {
            conversationId: conversation.id,
            isInternalNote: false,
            deletedAt: null,
            createdAt: { gt: conversation.participants[0]?.lastReadAt ?? new Date(0) },
            authorId: { not: currentUser!.user.id },
          },
        }),
      ),
    )
  ).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("quotesCard")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-foreground/70">{t("quotesCardDescription")}</p>
            <Link href="/portal/quotes" className="text-sm font-medium text-brand-600 hover:underline">
              {t("quotesCardLink")}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("projectsCard")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-foreground/70">{t("projectsCardDescription")}</p>
            <Link href="/portal/projects" className="text-sm font-medium text-brand-600 hover:underline">
              {t("projectsCardLink")}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("invoicesCard")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-foreground/70">{t("invoicesCardDescription")}</p>
            <Link href="/portal/invoices" className="text-sm font-medium text-brand-600 hover:underline">
              {t("invoicesCardLink")}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("messagesCard")}
              {unreadCount > 0 ? (
                <span className="ms-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                  {unreadCount}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-foreground/70">{t("messagesCardDescription")}</p>
            <Link href="/portal/messages" className="text-sm font-medium text-brand-600 hover:underline">
              {t("messagesCardLink")}
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("documentsCard")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recentDocuments.length === 0 ? (
            <p className="text-sm text-foreground/50">{t("documentsCardEmpty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recentDocuments.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate text-foreground">{doc.title}</span>
                  <span className="shrink-0 text-xs text-foreground/50">
                    {format.dateTime(doc.createdAt, { dateStyle: "medium" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/portal/documents" className="text-sm font-medium text-brand-600 hover:underline">
            {t("documentsCardLink")}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("notificationsCard")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentNotifications />
        </CardContent>
      </Card>
    </div>
  );
}
