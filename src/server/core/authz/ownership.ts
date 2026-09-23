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

/**
 * `Quote` n'a pas son propre `ownerId` (§F) : le périmètre `ASSIGNED` suit
 * celui du `Client` rattaché (`client.ownerId`), comme pour les autres
 * documents du dossier client.
 */
export function quoteWhereClause(currentUser: CurrentUser, permission: PermissionKey): { client?: { ownerId: string } } {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return {};
  return { client: { ownerId: currentUser.user.id } };
}

/** Lève une erreur si le périmètre `ASSIGNED` ne couvre pas le propriétaire du client rattaché au devis. */
export function assertQuoteOwnerInScope(currentUser: CurrentUser, permission: PermissionKey, clientOwnerId: string | null): void {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return;
  if (clientOwnerId === currentUser.user.id) return;
  throw new ForbiddenError();
}
