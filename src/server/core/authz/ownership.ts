import "server-only";
import type { PermissionKey } from "@/lib/permissions";
import { ForbiddenError } from "@/server/core/errors";
import { permissionScope, type CurrentUser } from "@/server/core/authz/session";

/**
 * Filtrage par périmètre (§H.3) pour les entités CRM à propriétaire
 * (`Lead`/`Opportunity`/`Client`.`ownerId`) : un périmètre `ASSIGNED` ne doit
 * lire/modifier que ce qui lui est attribué, `ALL` n'est pas filtré.
 * `defineAction` ne vérifie que la possession de la permission, pas son
 * périmètre — ce filtrage doit être appliqué explicitement à chaque lecture
 * et écriture d'entité CRM.
 */
export function ownerWhereClause(currentUser: CurrentUser, permission: PermissionKey): { ownerId?: string } {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return {};
  return { ownerId: currentUser.user.id };
}

/** Lève une erreur si le périmètre `ASSIGNED` ne couvre pas `ownerId`. */
export function assertOwnerInScope(currentUser: CurrentUser, permission: PermissionKey, ownerId: string | null): void {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return;
  if (ownerId === currentUser.user.id) return;
  throw new ForbiddenError();
}
