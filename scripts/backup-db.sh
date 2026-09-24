#!/usr/bin/env bash
# Sauvegarde de la base PostgreSQL (docs/architecture.md §H.6).
# Usage : ./scripts/backup-db.sh [dossier-de-sortie]
set -euo pipefail

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL n'est pas défini (chargez .env, ou exportez-le avant d'appeler ce script)." >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/saldaeconnect-${TIMESTAMP}.dump"

# Prisma ajoute ?schema=... à DATABASE_URL, un paramètre que pg_dump ne
# reconnaît pas (erreur "invalid URI query parameter: schema") — on le
# retire avant l'appel (le schéma par défaut "public" convient ici).
PG_URL="${DATABASE_URL%%\?*}"

pg_dump "$PG_URL" -Fc -f "$OUT_FILE"

echo "Sauvegarde écrite : $OUT_FILE"
echo "Chiffrez-la avant tout envoi vers un stockage distant, par ex. :"
echo "  age -r <clé-publique> -o ${OUT_FILE}.age $OUT_FILE && rm $OUT_FILE"
