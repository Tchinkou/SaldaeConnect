import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/server/core/auth/auth";
import { prisma } from "@/server/core/db/client";
import type { PermissionScope } from "@/generated/prisma/client";
import { scopeRank, hasPermission, permissionScope } from "@/server/core/authz/scope";

export { hasPermission, permissionScope };

/**
 * Session courante + rôles/permissions résolus, mis en cache pour la durée
 * de la requête (`cache()`) : un même rendu peut appeler `getCurrentUser`
 * depuis plusieurs composants serveur sans multiplier les requêtes.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const userRoles = await prisma.userRole.findMany({
    where: { userId: session.user.id },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });

  const permissions = new Map<string, PermissionScope>();
  for (const userRole of userRoles) {
    for (const grant of userRole.role.permissions) {
      const key = grant.permission.key;
      const existing = permissions.get(key);
      // ALL > ASSIGNED > OWN : si plusieurs rôles accordent la même
      // permission, on garde le périmètre le plus large.
      if (!existing || scopeRank(grant.scope) > scopeRank(existing)) {
        permissions.set(key, grant.scope);
      }
    }
  }

  return {
    session,
    user: session.user as typeof session.user & {
      userType: string;
      status: string;
      locale: string;
    },
    roles: userRoles.map((userRole) => userRole.role.key),
    permissions,
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
