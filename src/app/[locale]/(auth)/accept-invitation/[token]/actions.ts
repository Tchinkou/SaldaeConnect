"use server";
import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/server/core/db/client";
import { auth } from "@/server/core/auth/auth";
import { rateLimit } from "@/server/core/rate-limit";
import { logAudit } from "@/server/core/audit";
import { AppError } from "@/server/core/errors";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères.").max(120),
  password: z.string().min(12, "Le mot de passe doit faire au moins 12 caractères.").max(128),
});

export type AcceptInvitationInput = z.infer<typeof schema>;
export type AcceptInvitationResult = { ok: true } | { ok: false; error: string };

/**
 * Crée le compte d'un membre invité (§D.2). Non authentifié par nature (le
 * jeton d'invitation en tient lieu) — ne passe donc pas par
 * `server/core/action.ts`, réservé aux actions admin déjà authentifiées.
 */
export async function acceptInvitationAction(rawInput: AcceptInvitationInput): Promise<AcceptInvitationResult> {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for");
  const userAgent = requestHeaders.get("user-agent");

  try {
    const input = schema.parse(rawInput);

    await rateLimit(`accept-invitation:${ip ?? "unknown"}`, { windowSeconds: 60, max: 10 });

    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const invitation = await prisma.invitation.findUnique({ where: { tokenHash } });

    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new AppError("Cette invitation n'est plus valide ou a expiré.");
    }

    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingUser) {
      throw new AppError("Un compte existe déjà pour cette adresse email.");
    }

    try {
      await auth.api.signUpEmail({
        body: { email: invitation.email, password: input.password, name: input.name },
        headers: requestHeaders,
      });
    } catch (signUpError) {
      const message =
        signUpError instanceof Error && signUpError.message
          ? signUpError.message
          : "Impossible de créer le compte.";
      throw new AppError(message);
    }

    const createdUser = await prisma.user.findUniqueOrThrow({ where: { email: invitation.email } });

    if (invitation.clientId) {
      // Invitation au portail client (§D.3/§D.9) : même jeton, même formulaire
      // de choix de mot de passe que l'équipe, mais le compte créé est un
      // userType CLIENT rattaché au rôle système "client" (CLIENT_GRANTS),
      // pas un rôle d'équipe. Rattache le compte au contact existant de ce
      // client (même email) s'il y en a un, sinon en crée un.
      await prisma.$transaction(async (tx) => {
        const clientRole = await tx.role.findUniqueOrThrow({ where: { key: "client" } });

        await tx.user.update({
          where: { id: createdUser.id },
          data: { userType: "CLIENT", status: "ACTIVE" },
        });
        await tx.userRole.create({ data: { userId: createdUser.id, roleId: clientRole.id } });

        const existingContact = await tx.clientContact.findFirst({
          where: { clientId: invitation.clientId!, email: invitation.email, userId: null },
        });
        if (existingContact) {
          await tx.clientContact.update({ where: { id: existingContact.id }, data: { userId: createdUser.id } });
        } else {
          const [firstName, ...rest] = input.name.trim().split(/\s+/);
          await tx.clientContact.create({
            data: {
              clientId: invitation.clientId!,
              firstName: firstName ?? input.name,
              lastName: rest.join(" ") || (firstName ?? input.name),
              email: invitation.email,
              userId: createdUser.id,
            },
          });
        }

        await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      });
    } else {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: createdUser.id },
          data: { userType: "STAFF", status: "ACTIVE" },
        }),
        ...(invitation.roleId
          ? [prisma.userRole.create({ data: { userId: createdUser.id, roleId: invitation.roleId } })]
          : []),
        prisma.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        }),
      ]);
    }

    await logAudit({
      category: "SECURITY",
      action: "invitation.accepted",
      actorUserId: createdUser.id,
      actorLabel: createdUser.name,
      entityType: "user",
      entityId: createdUser.id,
      entityLabel: createdUser.email,
      ip,
      userAgent,
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message };
    }
    console.error("Échec de l'acceptation d'invitation", error);
    return { ok: false, error: "Une erreur inattendue est survenue." };
  }
}
