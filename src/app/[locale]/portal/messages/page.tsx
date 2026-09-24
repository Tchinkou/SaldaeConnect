import { getTranslations, getFormatter } from "next-intl/server";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

/**
 * Vue unifiée des conversations du client (§16) : pour l'instant uniquement
 * de type PROJECT (réservations/transactions n'existent pas avant la phase
 * 9), mais la requête ne filtre pas sur `type` pour rester valable une fois
 * ces types alimentés. Le compteur non-lus s'appuie sur
 * `ConversationParticipant.lastReadAt`, mis à jour par
 * `listPortalProjectMessagesAction` à l'ouverture du fil (§F.4).
 */
export default async function PortalMessagesPage() {
  const currentUser = await getCurrentUser();
  const t = await getTranslations("portal.messages");
  const format = await getFormatter();

  const contact = await prisma.clientContact.findUnique({ where: { userId: currentUser!.user.id } });
  const clientId = contact?.clientId ?? null;

  const conversationsRaw = clientId
    ? await prisma.conversation.findMany({
        where: { clientId },
        include: {
          project: { select: { id: true, name: true } },
          participants: { where: { userId: currentUser!.user.id } },
        },
        orderBy: { lastMessageAt: "desc" },
      })
    : [];

  const conversations = await Promise.all(
    conversationsRaw.map(async (conversation) => {
      const lastReadAt = conversation.participants[0]?.lastReadAt ?? new Date(0);
      const [lastMessage, unreadCount] = await Promise.all([
        prisma.message.findFirst({
          where: { conversationId: conversation.id, isInternalNote: false, deletedAt: null },
          orderBy: { createdAt: "desc" },
        }),
        prisma.message.count({
          where: {
            conversationId: conversation.id,
            isInternalNote: false,
            deletedAt: null,
            createdAt: { gt: lastReadAt },
            authorId: { not: currentUser!.user.id },
          },
        }),
      ]);
      return { conversation, lastMessage, unreadCount };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </div>

      {conversations.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {conversations.map(({ conversation, lastMessage, unreadCount }) => {
            const title = conversation.project ? conversation.project.name : (conversation.subject ?? t("conversation"));
            const href = conversation.project ? `/portal/projects/${conversation.project.id}` : "/portal";
            return (
              <Link key={conversation.id} href={href}>
                <Card className="transition-colors hover:border-brand-400">
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                        {unreadCount > 0 ? <Badge tone="info">{t("unreadCount", { count: unreadCount })}</Badge> : null}
                      </div>
                      {lastMessage ? (
                        <p className="mt-1 truncate text-sm text-foreground/60">{lastMessage.body}</p>
                      ) : (
                        <p className="mt-1 text-sm text-foreground/40">{t("noMessage")}</p>
                      )}
                    </div>
                    {lastMessage ? (
                      <span className="shrink-0 text-xs text-foreground/50">
                        {format.dateTime(lastMessage.createdAt, { dateStyle: "medium" })}
                      </span>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
