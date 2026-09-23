"use server";

import { z } from "zod";
import { prisma } from "@/server/core/db/client";
import { definePublicAction } from "@/server/core/public-action";
import { ValidationError } from "@/server/core/errors";
import { getActiveAdmins, createNotifications } from "@/server/core/notify-admins";
import { sendNewContactMessageNotificationEmail } from "@/server/core/email/send-new-contact-message-notification-email";
import { pickDefaultOwner } from "@/server/core/crm/attribution";
import { env } from "@/server/core/env";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(255),
  message: z.string().trim().min(1).max(5000),
  locale: z.enum(["fr", "en", "ar"]),
  // Anti-spam (§H.2) : piège à robots (doit rester vide) + temps de saisie minimal.
  website: z.string().max(0, "Requête invalide.").optional().default(""),
  renderedAt: z.coerce.number(),
});

export const submitContactMessageAction = definePublicAction({
  schema: contactSchema,
  rateLimits: (input, { ip }) => [
    ...(ip ? [{ key: `contact:ip:${ip}`, windowSeconds: 3600, max: 10 }] : []),
    { key: `contact:email:${input.email.toLowerCase()}`, windowSeconds: 3600, max: 5 },
  ],
  handler: async (input) => {
    if (Date.now() - input.renderedAt < 2000) {
      throw new ValidationError("Envoi trop rapide, réessayez.");
    }

    const [firstName, ...rest] = input.name.trim().split(/\s+/);
    const lastName = rest.join(" ") || "—";

    const lead = await prisma.$transaction(async (tx) => {
      const existing = await tx.lead.findFirst({ where: { email: input.email } });
      const record =
        existing ??
        (await tx.lead.create({
          data: {
            firstName: firstName ?? input.name,
            lastName,
            email: input.email,
            locale: input.locale,
            sourceId: (await tx.leadSource.findUnique({ where: { key: "website" } }))?.id,
            ownerId: await pickDefaultOwner(tx),
          },
        }));

      await tx.activity.create({
        data: {
          type: "NOTE",
          subject: "Message reçu depuis la page contact",
          body: input.message,
          leadId: record.id,
        },
      });

      return record;
    });

    const admins = await getActiveAdmins();
    await createNotifications(
      admins,
      "lead.contact_message",
      { leadId: lead.id, contactName: input.name },
      `/admin/leads/${lead.id}`,
    );
    await Promise.all(
      admins
        .filter((admin) => admin.email)
        .map((admin) =>
          sendNewContactMessageNotificationEmail({
            to: admin.email,
            contactName: input.name,
            crmUrl: `${env.NEXT_PUBLIC_APP_URL}/${admin.locale}/admin/leads/${lead.id}`,
            locale: admin.locale,
          }),
        ),
    );

    return { leadId: lead.id };
  },
  audit: {
    category: "BUSINESS",
    action: "lead.contact_message",
    entityType: "Lead",
    entityId: (output) => output.leadId,
  },
});
