"use server";
import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { defineAction } from "@/server/core/action";
import { prisma } from "@/server/core/db/client";
import { sendInvitationEmail } from "@/server/core/email/send-invitation-email";
import { AppError } from "@/server/core/errors";

const inviteSchema = z.object({
  email: z.email(),
  roleId: z.string().min(1),
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
});

const INVITATION_TTL_DAYS = 7;

async function createAndSendInvitation(input: z.infer<typeof inviteSchema>, invitedById: string, invitedByName: string) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw new AppError("Cette personne fait déjà partie de l'équipe.");
  }

  const role = await prisma.role.findUniqueOrThrow({ where: { id: input.roleId } });

  const existingInvitation = await prisma.invitation.findFirst({
    where: { email: input.email, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (existingInvitation) {
    throw new AppError("Une invitation est déjà en attente pour cette adresse.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      email: input.email,
      roleId: input.roleId,
      tokenHash,
      expiresAt,
      invitedById,
    },
  });

  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${input.locale}/accept-invitation/${rawToken}`;
  await sendInvitationEmail({
    to: input.email,
    acceptUrl,
    roleName: role.name,
    invitedBy: invitedByName,
    locale: input.locale,
  });

  return invitation;
}

export const inviteStaffAction = defineAction({
  permission: "team.write",
  schema: inviteSchema,
  audit: {
    category: "SECURITY",
    action: "team.invite",
    entityType: "invitation",
    entityLabel: (input) => input.email,
  },
  handler: async (input, { user }) => {
    const invitation = await createAndSendInvitation(input, user.user.id, user.user.name);
    return { invitationId: invitation.id };
  },
});

const resendSchema = z.object({
  invitationId: z.string().min(1),
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
});

export const resendInvitationAction = defineAction({
  permission: "team.write",
  schema: resendSchema,
  audit: {
    category: "SECURITY",
    action: "team.invite.resend",
    entityType: "invitation",
    entityId: (input) => input.invitationId,
  },
  handler: async (input, { user }) => {
    const existing = await prisma.invitation.findUniqueOrThrow({ where: { id: input.invitationId } });
    if (existing.acceptedAt) {
      throw new AppError("Cette invitation a déjà été acceptée.");
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const role = existing.roleId
      ? await prisma.role.findUniqueOrThrow({ where: { id: existing.roleId } })
      : null;

    await prisma.invitation.update({
      where: { id: existing.id },
      data: { tokenHash, expiresAt },
    });

    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${input.locale}/accept-invitation/${rawToken}`;
    await sendInvitationEmail({
      to: existing.email,
      acceptUrl,
      roleName: role?.name ?? "",
      invitedBy: user.user.name,
      locale: input.locale,
    });

    return { ok: true };
  },
});
