import type { NotificationChannel } from "@/generated/prisma/client";

/**
 * Catalogue des types de notification que le client peut effectivement
 * régler (§16, "Paramètres"). N'y figurent que les couples type/canal
 * réellement envoyés côté code — pas de case à cocher qui ne changerait
 * rien (§48, ne jamais faire semblant) :
 * - `quote.available` n'a pas de contrepartie in-app (l'invitation par
 *   email est la communication elle-même, pas une notification qu'on
 *   couperait) — volontairement absent d'ici.
 * - `project.message` et `invoice.payment_recorded` n'ont pas d'email.
 */
export const CLIENT_NOTIFICATION_TYPES: Array<{ type: string; channels: NotificationChannel[] }> = [
  { type: "project.status_changed", channels: ["IN_APP", "EMAIL"] },
  { type: "project.message", channels: ["IN_APP"] },
  { type: "invoice.issued", channels: ["IN_APP", "EMAIL"] },
  { type: "invoice.payment_recorded", channels: ["IN_APP"] },
  { type: "reservation.status_changed", channels: ["IN_APP", "EMAIL"] },
  { type: "transaction.status_changed", channels: ["IN_APP", "EMAIL"] },
];
