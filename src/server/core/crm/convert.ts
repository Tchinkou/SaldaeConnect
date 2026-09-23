"use server";
import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { ValidationError } from "@/server/core/errors";
import { recordActivity } from "@/server/core/crm/timeline";

const schema = z.object({ leadId: z.string().min(1) });

/**
 * Conversion lead → client (§E.1) : réutilise un client existant si l'email
 * correspond (dédoublonnage), rattache toutes les opportunités et activités
 * du lead, et ne redemande aucune information déjà connue. Extrait de
 * `convertLeadToClientAction` pour être réutilisable depuis d'autres
 * transactions (ex. création d'un devis sur une opportunité sans client —
 * §E.1, conversion automatique au premier brouillon).
 */
export async function convertLeadToClient(
  tx: Prisma.TransactionClient,
  leadId: string,
  actorId: string,
): Promise<{ clientId: string }> {
  const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.status === "CONVERTED" && lead.convertedClientId) {
    throw new ValidationError("Ce lead est déjà converti en client.");
  }

  let client = lead.email ? await tx.client.findFirst({ where: { email: lead.email } }) : null;

  if (!client) {
    const last = await tx.client.findFirst({ where: { code: { startsWith: "CL-" } }, orderBy: { code: "desc" } });
    const lastNumber = last ? Number.parseInt(last.code.slice(3), 10) || 0 : 0;
    const code = `CL-${String(lastNumber + 1).padStart(4, "0")}`;

    client = await tx.client.create({
      data: {
        code,
        kind: lead.companyName ? "COMPANY" : "INDIVIDUAL",
        displayName: lead.companyName || `${lead.firstName} ${lead.lastName}`,
        email: lead.email,
        phone: lead.phone,
        country: lead.country,
        city: lead.city,
        preferredLocale: lead.locale,
        ownerId: lead.ownerId,
        status: "PROSPECT",
      },
    });

    await tx.clientContact.create({
      data: {
        clientId: client.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        isPrimary: true,
      },
    });
  }

  await tx.opportunity.updateMany({ where: { leadId: lead.id }, data: { clientId: client.id } });
  await tx.activity.updateMany({ where: { leadId: lead.id }, data: { clientId: client.id } });
  await tx.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED", convertedClientId: client.id } });

  await recordActivity(tx, {
    type: "SYSTEM",
    subject: "Lead converti en client",
    actorId,
    clientId: client.id,
    leadId: lead.id,
  });

  return { clientId: client.id };
}

export const convertLeadToClientAction = defineAction({
  permission: "client.write",
  schema,
  handler: async (input, { user }) => {
    return prisma.$transaction((tx) => convertLeadToClient(tx, input.leadId, user.user.id));
  },
  audit: {
    category: "BUSINESS",
    action: "lead.convert",
    entityType: "Client",
    entityId: (_input, output) => output.clientId,
  },
});
