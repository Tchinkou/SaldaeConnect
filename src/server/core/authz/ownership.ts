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

/** `Invoice` suit la même règle que `Quote` (pas d'`ownerId` propre, périmètre du `Client` rattaché). */
export function invoiceWhereClause(currentUser: CurrentUser, permission: PermissionKey): { client?: { ownerId: string } } {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return {};
  return { client: { ownerId: currentUser.user.id } };
}

/** Lève une erreur si le périmètre `ASSIGNED` ne couvre pas le propriétaire du client rattaché à la facture. */
export function assertInvoiceOwnerInScope(currentUser: CurrentUser, permission: PermissionKey, clientOwnerId: string | null): void {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return;
  if (clientOwnerId === currentUser.user.id) return;
  throw new ForbiddenError();
}

/**
 * `Project` n'a pas d'`ownerId` mais un `managerId` (§F.4) : le responsable
 * de la livraison, distinct du `Client.ownerId` (qui a mené la phase
 * commerciale). Le périmètre `ASSIGNED` de `project.*` suit ce
 * `managerId` — c'est lui, pas le commercial, qui doit voir « ses »
 * projets dans un périmètre restreint.
 */
export function projectWhereClause(currentUser: CurrentUser, permission: PermissionKey): { managerId?: string } {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return {};
  return { managerId: currentUser.user.id };
}

/** Lève une erreur si le périmètre `ASSIGNED` ne couvre pas le responsable du projet. */
export function assertProjectManagerInScope(currentUser: CurrentUser, permission: PermissionKey, managerId: string | null): void {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return;
  if (managerId === currentUser.user.id) return;
  throw new ForbiddenError();
}

/**
 * `Reservation` et `TransactionOrder` suivent le même principe que `Project`
 * (périmètre `ASSIGNED` = staff attribué, `assignedToId`) — §H.3 : « ALL ou
 * ASSIGNED selon réglage » pour ce domaine.
 */
export function reservationWhereClause(currentUser: CurrentUser, permission: PermissionKey): { assignedToId?: string } {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return {};
  return { assignedToId: currentUser.user.id };
}

/** Lève une erreur si le périmètre `ASSIGNED` ne couvre pas le staff attribué à la réservation. */
export function assertReservationAssigneeInScope(currentUser: CurrentUser, permission: PermissionKey, assignedToId: string | null): void {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return;
  if (assignedToId === currentUser.user.id) return;
  throw new ForbiddenError();
}

export function transactionOrderWhereClause(currentUser: CurrentUser, permission: PermissionKey): { assignedToId?: string } {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return {};
  return { assignedToId: currentUser.user.id };
}

/** Lève une erreur si le périmètre `ASSIGNED` ne couvre pas le staff attribué à la commande de transaction. */
export function assertTransactionAssigneeInScope(currentUser: CurrentUser, permission: PermissionKey, assignedToId: string | null): void {
  const scope = permissionScope(currentUser, permission);
  if (scope === "ALL") return;
  if (assignedToId === currentUser.user.id) return;
  throw new ForbiddenError();
}
