import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { ownerWhereClause } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { NewInvoiceForm } from "@/app/[locale]/admin/invoices/new/new-invoice-form";

export default async function NewInvoicePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "invoice.write")) {
    return <Forbidden />;
  }

  const clients = await prisma.client.findMany({
    where: { deletedAt: null, ...ownerWhereClause(currentUser, "invoice.write") },
    orderBy: { displayName: "asc" },
    take: 200,
    select: { id: true, displayName: true, code: true },
  });

  return <NewInvoiceForm clients={clients} />;
}
