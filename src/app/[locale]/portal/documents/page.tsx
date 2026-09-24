import { getTranslations, getFormatter } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Bibliothèque unifiée des documents du client (§16) : fichiers de projet visibles côté client, PDF de devis, PDF de factures. */
export default async function PortalDocumentsPage() {
  const currentUser = await getCurrentUser();
  const t = await getTranslations("portal.documents");
  const format = await getFormatter();

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  const clientId = contact?.clientId ?? null;

  const [projectFiles, quoteVersions, invoices] = clientId
    ? await Promise.all([
        prisma.file.findMany({
          where: { project: { clientId }, visibility: "CLIENT", status: "ACTIVE" },
          include: { project: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.quoteVersion.findMany({
          where: { quote: { clientId }, pdfFileId: { not: null } },
          include: { quote: { select: { id: true, number: true } } },
          orderBy: { sentAt: "desc" },
        }),
        prisma.invoice.findMany({
          where: { clientId, pdfFileId: { not: null }, status: { not: "DRAFT" } },
          select: { id: true, number: true, pdfFileId: true, issueDate: true },
          orderBy: { issueDate: "desc" },
        }),
      ])
    : [[], [], []];

  const pdfFileIds = [
    ...quoteVersions.map((v) => v.pdfFileId!),
    ...invoices.map((i) => i.pdfFileId!),
  ];
  const pdfFiles = pdfFileIds.length
    ? await prisma.file.findMany({ where: { id: { in: pdfFileIds } } })
    : [];
  const pdfFileById = new Map(pdfFiles.map((f) => [f.id, f]));

  const quoteDocs = quoteVersions
    .map((v) => {
      const file = pdfFileById.get(v.pdfFileId!);
      if (!file) return null;
      return {
        id: file.id,
        title: t("quoteDocument", { number: v.quote.number ?? v.quote.id }),
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt,
        href: `/portal/quotes/${v.quote.id}`,
      };
    })
    .filter((doc): doc is NonNullable<typeof doc> => doc !== null);

  const invoiceDocs = invoices
    .map((invoice) => {
      const file = pdfFileById.get(invoice.pdfFileId!);
      if (!file) return null;
      return {
        id: file.id,
        title: t("invoiceDocument", { number: invoice.number ?? invoice.id }),
        sizeBytes: file.sizeBytes,
        createdAt: invoice.issueDate ?? file.createdAt,
        href: `/portal/invoices/${invoice.id}`,
      };
    })
    .filter((doc): doc is NonNullable<typeof doc> => doc !== null);

  const projectDocs = projectFiles.map((file) => ({
    id: file.id,
    title: file.originalName,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt,
    href: `/portal/projects/${file.project!.id}`,
    subtitle: file.project!.name,
  }));

  const isEmpty = projectDocs.length === 0 && quoteDocs.length === 0 && invoiceDocs.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </div>

      {isEmpty ? (
        <p className="text-sm text-foreground/60">{t("empty")}</p>
      ) : (
        <>
          {projectDocs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("projectSection")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {projectDocs.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} format={format} downloadLabel={t("download")} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {quoteDocs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("quoteSection")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {quoteDocs.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} format={format} downloadLabel={t("download")} />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {invoiceDocs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("invoiceSection")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {invoiceDocs.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} format={format} downloadLabel={t("download")} />
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function DocumentRow({
  doc,
  format,
  downloadLabel,
}: {
  doc: { id: string; title: string; sizeBytes: bigint; createdAt: Date; href: string; subtitle?: string };
  format: Awaited<ReturnType<typeof getFormatter>>;
  downloadLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
      <div className="min-w-0">
        <Link href={doc.href} className="truncate text-sm font-medium text-foreground hover:text-brand-600">
          {doc.title}
        </Link>
        <div className="flex items-center gap-2 text-xs text-foreground/50">
          {doc.subtitle ? <span>{doc.subtitle}</span> : null}
          <span>{formatBytes(doc.sizeBytes)}</span>
          <span>{format.dateTime(doc.createdAt, { dateStyle: "medium" })}</span>
        </div>
      </div>
      <a
        href={`/api/files/${doc.id}`}
        className="shrink-0 text-sm font-medium text-brand-600 hover:underline"
      >
        {downloadLabel}
      </a>
    </div>
  );
}
