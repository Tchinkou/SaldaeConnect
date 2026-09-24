# Déploiement

Les options d'hébergement envisagées sont comparées dans
[`architecture.md` §A.7](./architecture.md#a7-cibles-dhébergement). Ce
document couvre la mise en route pratique — en développement aujourd'hui,
en production au fur et à mesure des phases suivantes.

## Développement local

Prérequis : Node.js 20.9+, PostgreSQL 16.

```bash
cp .env.example .env          # puis renseignez au moins DATABASE_URL, AUTH_SECRET, DATA_ENCRYPTION_KEY
npm install
npm run db:migrate            # applique les migrations
npm run db:seed               # rôles, catalogue, paramètres + données de démonstration
npm run dev
```

Ou avec Docker (PostgreSQL uniquement, pour l'instant) :

```bash
docker compose up -d
```

Voir `docker-compose.yml` pour les identifiants par défaut (développement
uniquement — jamais utilisés en production).

### Générer des secrets de développement

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 16      # DATA_ENCRYPTION_KEY, CRON_SECRET
```

## Production (à faire en phase 12)

L'application est conçue pour ne dépendre d'aucun hébergeur précis (voir
les interfaces `EmailProvider`, `StorageProvider`, `PdfRenderer`,
`JobQueue`, `RateLimiter` dans `src/server/core/`). Deux profils sont
documentés dans `architecture.md` :

- **Managé** : Vercel + Neon (PostgreSQL) + Cloudflare R2 + Resend —
  recommandé pour démarrer sans serveur à maintenir.
- **VPS** : Docker Compose (application, PostgreSQL, MinIO, Caddy pour le
  TLS, cron système) — pour maîtriser les coûts et les données.

Avant la première mise en production :

1. `npm run db:migrate:deploy` (jamais `db push` en production).
2. `npm run create-admin -- --email=... --name="..."` pour créer le premier
   administrateur, puis activer sa double authentification à la première
   connexion.
3. Configurer un domaine d'envoi d'emails (SPF/DKIM/DMARC) avant d'activer
   `EMAIL_PROVIDER=resend` ou `postmark`.
4. Vérifier que `APP_ENV=production` (bloque `seed:dev` et le seed de
   données fictives).
5. Mettre en place les sauvegardes (§H.6 de `architecture.md`) : export
   `pg_dump` quotidien chiffré, test de restauration mensuel.

## Sauvegardes

Procédure testée en conditions réelles (dump réel → restauration dans une
base neuve → vérification des effectifs de lignes et d'une lecture
applicative via Prisma → nettoyage) ; détails et méthodologie dans
`docs/phase-12-tests-deploiement.md` §3.

- Base : `scripts/backup-db.sh [dossier]` produit un export `pg_dump -Fc`
  horodaté de `DATABASE_URL`. En production, chiffrez l'export avant tout
  envoi vers un stockage distant, par exemple avec
  [`age`](https://github.com/FiloSottile/age) :
  `age -r <clé-publique> -o sauvegarde.dump.age sauvegarde.dump`.
- Restauration : `scripts/restore-db.sh <fichier.dump> <url-postgresql-cible>` —
  l'URL cible est **toujours** un argument explicite, jamais implicite,
  pour ne jamais écraser une base par erreur. Demande confirmation avant
  `pg_restore --clean`.
- Fichiers (`StorageProvider` local) : archive `tar czf` du dossier de
  stockage (ex. `.storage/files` en développement) ; en production avec un
  stockage objet (R2, MinIO...), le versionnage du bucket tient lieu de
  sauvegarde continue (§H.6).
- **Test de restauration mensuel** (§H.6) : exécuter `backup-db.sh` puis
  `restore-db.sh` vers une base Postgres temporaire, comparer les
  effectifs de lignes des tables principales avec la base source, puis
  supprimer la base temporaire. C'est exactement la procédure vérifiée
  lors de la phase 12.
- À mettre en place au choix de l'hébergement (hors périmètre de ce
  dépôt) : programmation automatique (cron / tâche planifiée) du
  `pg_dump` quotidien, restauration à un instant donné côté fournisseur
  managé (ex. Neon), réplication du stockage de fichiers vers un second
  emplacement.

## Supervision

`GET /api/health` vérifie la connexion à la base de données et répond
`200`/`503` ; à brancher sur un service de ping externe (UptimeRobot,
Better Uptime, Healthchecks.io...). Le reste (suivi d'erreurs, détection
d'absence d'exécution des jobs cron, stratégie de journaux) est une
recommandation documentée dans `architecture.md` §H.8, à mettre en œuvre
une fois l'hébergement choisi.

Ce document sera complété phase par phase (checklist de mise en
production) plutôt que rempli par anticipation.
