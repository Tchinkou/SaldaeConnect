#!/usr/bin/env bash
# Restauration d'une sauvegarde PostgreSQL (docs/architecture.md §H.6).
# Usage : ./scripts/restore-db.sh <fichier.dump> <postgresql://url-de-la-base-cible>
#
# Restaure TOUJOURS vers l'URL passée explicitement en second argument —
# jamais vers DATABASE_URL implicitement, pour éviter d'écraser une base
# de développement ou de production par erreur.
set -euo pipefail

DUMP_FILE="${1:?Usage: restore-db.sh <fichier.dump> <url-postgresql-cible>}"
RAW_TARGET_URL="${2:?Usage: restore-db.sh <fichier.dump> <url-postgresql-cible>}"
# Même retrait de ?schema=... qu'à la sauvegarde (voir backup-db.sh) :
# pg_restore ne reconnaît pas ce paramètre ajouté par Prisma.
TARGET_URL="${RAW_TARGET_URL%%\?*}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Fichier introuvable : $DUMP_FILE" >&2
  exit 1
fi

echo "Restauration de $DUMP_FILE vers $TARGET_URL"
echo "Cette opération remplace le contenu des tables existantes. Ctrl+C pour annuler, Entrée pour continuer."
read -r _

pg_restore --dbname="$TARGET_URL" --no-owner --no-privileges --clean --if-exists "$DUMP_FILE"

echo "Restauration terminée."
