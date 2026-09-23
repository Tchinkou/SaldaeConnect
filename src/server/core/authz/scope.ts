import type { PermissionKey } from "@/lib/permissions";
import type { PermissionScope } from "@/generated/prisma/client";

/**
 * Logique pure de résolution des permissions — séparée de `session.ts` (qui
 * dépend de Prisma/Better Auth) pour rester testable sans base de données
 * ni session HTTP (voir `scope.test.ts`).
 */
export function scopeRank(scope: PermissionScope): number {
  switch (scope) {
    case "ALL":
      return 2;
    case "ASSIGNED":
      return 1;
    case "OWN":
    default:
      return 0;
  }
}

export type PermissionMap = { permissions: Map<string, PermissionScope> };

/** Le périmètre accordé pour cette permission, ou `null` si non accordée. */
export function permissionScope(currentUser: Pick<PermissionMap, "permissions"> | null, key: PermissionKey): PermissionScope | null {
  return currentUser?.permissions.get(key) ?? null;
}

export function hasPermission(currentUser: Pick<PermissionMap, "permissions"> | null, key: PermissionKey): boolean {
  return permissionScope(currentUser, key) !== null;
}
