"use server";
import "server-only";
import { z } from "zod";
import type { ActionResult } from "@/server/core/action";
import { getCurrentUser } from "@/server/core/authz/session";
import { prisma } from "@/server/core/db/client";
import { AppError, UnauthenticatedError, ValidationError } from "@/server/core/errors";

/**
 * Notifications in-app (§I.7) : toujours « ses propres » — aucune permission
 * dédiée n'existe ni n'a de sens ici (staff comme client lisent uniquement
 * `WHERE userId = soi-même`), donc pas de `defineAction`/`definePortalAction`
 * (l'un exige une `PermissionKey`, l'autre est réservé aux clients) : un
 * enveloppeur minimal, commun aux deux types d'utilisateurs.
 */
async function requireUser() {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new UnauthenticatedError();
  return currentUser;
}

export interface NotificationRow {
  id: string;
  type: string;
  params: unknown;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listMyNotificationsAction(): Promise<ActionResult<{ items: NotificationRow[]; unreadCount: number }>> {
  try {
    const currentUser = await requireUser();
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: currentUser.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.notification.count({ where: { userId: currentUser.user.id, readAt: null } }),
    ]);
    return {
      ok: true,
      data: {
        items: items.map((n) => ({
          id: n.id,
          type: n.type,
          params: n.params,
          link: n.link,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      },
    };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message };
    console.error("Erreur inattendue en listant les notifications", error);
    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}

const markReadSchema = z.object({ id: z.string().min(1) });

export async function markNotificationReadAction(rawInput: z.input<typeof markReadSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const currentUser = await requireUser();
    const parsed = markReadSchema.safeParse(rawInput);
    if (!parsed.success) throw new ValidationError();

    const notification = await prisma.notification.findUnique({ where: { id: parsed.data.id } });
    if (!notification || notification.userId !== currentUser.user.id) {
      throw new ValidationError("Notification introuvable.");
    }
    if (!notification.readAt) {
      await prisma.notification.update({ where: { id: parsed.data.id }, data: { readAt: new Date() } });
    }
    return { ok: true, data: { id: parsed.data.id } };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message };
    console.error("Erreur inattendue en marquant une notification comme lue", error);
    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  try {
    const currentUser = await requireUser();
    const result = await prisma.notification.updateMany({
      where: { userId: currentUser.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, data: { count: result.count } };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, error: error.message };
    console.error("Erreur inattendue en marquant les notifications comme lues", error);
    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}
