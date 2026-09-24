"use server";
import "server-only";
import { z } from "zod";
import { definePortalAction } from "@/server/core/portal-action";
import { prisma } from "@/server/core/db/client";

const updatePortalProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
});

/** Le client ne modifie que ses propres coordonnées de contact (§16, "Profil"). */
export const updatePortalProfileAction = definePortalAction({
  schema: updatePortalProfileSchema,
  handler: async (input, { contactId, user }) => {
    await prisma.$transaction([
      prisma.clientContact.update({
        where: { id: contactId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone || null,
          jobTitle: input.jobTitle || null,
        },
      }),
      prisma.user.update({
        where: { id: user.user.id },
        data: { name: `${input.firstName} ${input.lastName}`.trim() },
      }),
    ]);
    return { contactId };
  },
  audit: {
    category: "BUSINESS",
    action: "portal.profile.update",
    entityType: "ClientContact",
    entityId: (_input, output) => output.contactId,
  },
});
