import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { magicLink } from "better-auth/plugins/magic-link";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import { prisma } from "@/server/core/db/client";
import { env } from "@/server/core/env";
import { sendMagicLinkEmail } from "@/server/core/email/send-magic-link-email";

/**
 * Configuration Better Auth. Voir docs/security.md pour la justification de
 * chaque choix (hachage argon2id, 2FA, sessions en base, etc.).
 *
 * `user.additionalFields` ajoute au modèle `User` généré les colonnes dont
 * SaldaeConnect a besoin en plus du strict nécessaire de Better Auth :
 * type d'utilisateur (staff/client), locale, fuseau horaire, téléphone.
 */
export const auth = betterAuth({
  appName: "SaldaeConnect",
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24, // rafraîchie une fois par jour d'activité
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  advanced: {
    database: {
      generateId: false, // les identifiants sont générés par Postgres (uuid v7, voir schéma)
    },
    cookiePrefix: "saldaeconnect",
    useSecureCookies: env.APP_ENV === "production",
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: false, // activé une fois l'envoi d'emails de vérification en place
    password: {
      // argon2id plutôt que le scrypt par défaut de Better Auth (§27 du cahier des charges).
      hash: (password) => argon2Hash(password),
      verify: ({ hash, password }) => argon2Verify(hash, password),
    },
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await import(
        "@/server/core/email/send-password-reset-email"
      );
      // `user.locale` vient de `user.additionalFields` ci-dessous ; son type
      // n'est pas propagé jusqu'à ce callback par Better Auth.
      const locale = (user as unknown as { locale?: string }).locale;
      await sendPasswordResetEmail({ to: user.email, resetUrl: url, locale });
    },
  },

  user: {
    additionalFields: {
      userType: {
        type: "string", // "STAFF" | "CLIENT"
        required: true,
        defaultValue: "CLIENT",
        input: false, // jamais fourni par le client, décidé par le serveur (invitation)
      },
      locale: {
        type: "string", // "fr" | "en" | "ar"
        required: true,
        defaultValue: "fr",
      },
      timezone: {
        type: "string",
        required: true,
        defaultValue: "Africa/Algiers",
      },
      phone: {
        type: "string",
        required: false,
      },
      status: {
        type: "string", // "INVITED" | "ACTIVE" | "SUSPENDED"
        required: true,
        defaultValue: "ACTIVE",
        input: false,
      },
    },
  },

  plugins: [
    twoFactor({
      issuer: "SaldaeConnect",
    }),
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        "Ce mot de passe a été exposé dans une fuite de données connue. Choisissez-en un autre.",
    }),
    magicLink({
      // Utilisé pour l'invitation des clients au portail (D.3) : pas de mot
      // de passe à choisir tant qu'ils n'en veulent pas un.
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ to: email, magicLinkUrl: url });
      },
    }),
  ],

  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
});

export type Auth = typeof auth;
