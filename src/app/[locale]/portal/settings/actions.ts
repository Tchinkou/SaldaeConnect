"use server";
import "server-only";
import { z } from "zod";
import { definePortalAction } from "@/server/core/portal-action";
import { prisma } from "@/server/core/db/client";
import { ValidationError } from "@/server/core/errors";
import { CLIENT_NOTIFICATION_TYPES } from "@/server/core/notifications/preference-catalog";

const emptySchema = z.object({});

/** Préférences effectives du client (§16, "Paramètres") : une ligne absente vaut « activé » (modèle opt-out). */
export const listPortalNotificationPreferencesAction = definePortalAction({
  schema: emptySchema,
  handler: async (_input, { user }) => {
    const rows = await prisma.notificationPreference.findMany({ where: { userId: user.user.id } });
    const disabled = new Set(rows.filter((row) => !row.enabled).map((row) => `${row.type}:${row.channel}`));

    return CLIENT_NOTIFICATION_TYPES.map(({ type, channels }) => ({
      type,
      channels: channels.map((channel) => ({ channel, enabled: !disabled.has(`${type}:${channel}`) })),
    }));
  },
});

const updatePortalNotificationPreferenceSchema = z.object({
  type: z.string().min(1),
  channel: z.enum(["IN_APP", "EMAIL"]),
  enabled: z.boolean(),
});

export const updatePortalNotificationPreferenceAction = definePortalAction({
  schema: updatePortalNotificationPreferenceSchema,
  handler: async (input, { user }) => {
    const entry = CLIENT_NOTIFICATION_TYPES.find((item) => item.type === input.type);
    if (!entry || !entry.channels.includes(input.channel)) {
      throw new ValidationError("Type de notification inconnu.");
    }

    await prisma.notificationPreference.upsert({
      where: { userId_type_channel: { userId: user.user.id, type: input.type, channel: input.channel } },
      create: { userId: user.user.id, type: input.type, channel: input.channel, enabled: input.enabled },
      update: { enabled: input.enabled },
    });

    return { ok: true as const };
  },
  audit: {
    category: "BUSINESS",
    action: "portal.notification_preference.update",
    entityType: "NotificationPreference",
    entityId: (input) => `${input.type}:${input.channel}`,
  },
});
