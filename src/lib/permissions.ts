/**
 * Catalogue des permissions RBAC (§H.3). Source unique utilisée à la fois
 * par le seed (`prisma/seed/base.ts`, qui crée les lignes `Permission`) et
 * par le serveur applicatif (`server/core/authz`, qui vérifie ces clés) —
 * aucun des deux ne doit avoir sa propre copie de cette liste.
 *
 * Pas de `server-only` ici : ce fichier est aussi importé par les scripts
 * de seed exécutés via `tsx` en dehors de Next.js.
 */
export const PERMISSIONS = [
  ["lead.read", "Lire les prospects"],
  ["lead.write", "Créer/modifier les prospects"],
  ["opportunity.read", "Lire les opportunités"],
  ["opportunity.write", "Créer/modifier les opportunités"],
  ["client.read", "Lire les clients"],
  ["client.write", "Créer/modifier les clients"],
  ["quote.read", "Lire les devis"],
  ["quote.write", "Créer/modifier les devis"],
  ["quote.send", "Envoyer un devis"],
  ["project.read", "Lire les projets"],
  ["project.write", "Créer/modifier les projets"],
  ["task.read", "Lire les tâches"],
  ["task.write", "Créer/modifier les tâches"],
  ["message.read", "Lire les messages"],
  ["message.write", "Envoyer des messages"],
  ["file.read", "Lire les fichiers"],
  ["file.write", "Envoyer des fichiers"],
  ["invoice.read", "Lire les factures"],
  ["invoice.write", "Créer/modifier les factures"],
  ["invoice.issue", "Émettre une facture"],
  ["payment.read", "Lire les paiements"],
  ["payment.write", "Enregistrer un paiement"],
  ["reservation.read", "Lire les réservations"],
  ["reservation.write", "Créer/modifier les réservations"],
  ["transaction.read", "Lire les transactions"],
  ["transaction.write", "Créer/modifier les transactions"],
  ["reporting.financial.read", "Lire les statistiques financières"],
  ["cms.write", "Modifier le contenu du site (services, pages, portfolio, blog)"],
  ["team.write", "Gérer l'équipe et les rôles"],
  ["settings.write", "Modifier les paramètres globaux"],
  ["audit.read", "Consulter le journal d'audit"],
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number][0];
