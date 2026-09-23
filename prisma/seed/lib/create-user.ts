import { hash as argon2Hash } from "@node-rs/argon2";
import { prisma } from "./client";

/**
 * Crée un utilisateur avec un mot de passe, en reproduisant exactement ce
 * que fait Better Auth à l'inscription (voir better-auth/dist/api/routes/
 * sign-up.mjs) : un `User` et un `Account` de type "credential" dont
 * `accountId` vaut l'id de l'utilisateur. On ne passe pas par `auth.api.*`
 * ici car src/server/core/auth/auth.ts importe "server-only", incompatible
 * avec un script de seed exécuté par tsx.
 */
export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  userType: "STAFF" | "CLIENT";
  locale?: string;
  timezone?: string;
  phone?: string;
  status?: "INVITED" | "ACTIVE" | "SUSPENDED";
  roleKeys?: string[];
}) {
  const passwordHash = await argon2Hash(input.password);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: {
      email: input.email,
      name: input.name,
      emailVerified: true,
      userType: input.userType,
      locale: input.locale ?? "fr",
      timezone: input.timezone ?? "Africa/Algiers",
      phone: input.phone,
      status: input.status ?? "ACTIVE",
      accounts: {
        create: {
          providerId: "credential",
          accountId: "PLACEHOLDER", // remplacé juste après (a besoin de l'id utilisateur)
          password: passwordHash,
        },
      },
    },
  });

  // `accountId` doit valoir l'id de l'utilisateur (convention Better Auth) ;
  // on ne le connaît qu'une fois le user créé, d'où cette seconde passe.
  await prisma.account.updateMany({
    where: { userId: user.id, providerId: "credential" },
    data: { accountId: user.id },
  });

  if (input.roleKeys?.length) {
    for (const key of input.roleKeys) {
      const role = await prisma.role.findUnique({ where: { key } });
      if (!role) continue;
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }
  }

  return user;
}
