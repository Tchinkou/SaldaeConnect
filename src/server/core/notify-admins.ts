import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/core/db/client";

/**
 * Les administrateurs à notifier des événements publics (nouvelle demande,
 * message de contact — §D.2). Le staff non-admin n'est pas notifié ici : il
 * n'a pas encore de responsabilité assignée sur une opportunité qui vient
 * d'être créée (§H.3, périmètre `ASSIGNED`) — voir la phase 4 (CRM) pour la
 * règle d'attribution.
 */
export async function getActiveAdmins() {
  return prisma.user.findMany({
    where: { status: "ACTIVE", userType: "STAFF", roles: { some: { role: { key: "admin" } } } },
    select: { id: true, email: true, locale: true, name: true },
  });
}

/** Notification in-app (§I.7) — composée à l'affichage à partir de `type` et `params` dans la langue du destinataire. */
export async function createNotifications(
  admins: Array<{ id: string }>,
  type: string,
  params: Prisma.InputJsonValue,
  link: string,
) {
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((admin) => ({ userId: admin.id, type, params, link })),
  });
}
