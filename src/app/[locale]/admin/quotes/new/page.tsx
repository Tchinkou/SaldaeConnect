import { prisma } from "@/server/core/db/client";
import { getCurrentUser, hasPermission } from "@/server/core/authz/session";
import { ownerWhereClause } from "@/server/core/authz/ownership";
import { Forbidden } from "@/components/admin/forbidden";
import { NewQuoteForm } from "@/app/[locale]/admin/quotes/new/new-quote-form";

export default async function NewQuotePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, "quote.write")) {
    return <Forbidden />;
  }

  const clients = await prisma.client.findMany({
    where: { deletedAt: null, ...ownerWhereClause(currentUser, "quote.write") },
    orderBy: { displayName: "asc" },
    take: 200,
    select: { id: true, displayName: true, code: true },
  });

  return <NewQuoteForm clients={clients} />;
}
