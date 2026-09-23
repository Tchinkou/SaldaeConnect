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

Ce document sera complété phase par phase (supervision, sauvegardes
testées, checklist de mise en production) plutôt que rempli par
anticipation.
