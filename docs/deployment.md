# Déploiement

Les options d'hébergement envisagées sont comparées dans
[`architecture.md` §A.7](./architecture.md#a7-cibles-dhébergement). Ce
document couvre la mise en route pratique — le développement local et,
plus bas, la checklist de mise en production complétée en phase 12.

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

## Production

L'application est conçue pour ne dépendre d'aucun hébergeur précis (voir
les interfaces `EmailProvider`, `StorageProvider`, `PdfRenderer`,
`JobQueue`, `RateLimiter` dans `src/server/core/`). Deux profils sont
documentés dans `architecture.md` :

- **Managé** : Vercel + Neon (PostgreSQL) + Cloudflare R2 + Resend —
  recommandé pour démarrer sans serveur à maintenir.
- **VPS** : Docker Compose (application, PostgreSQL, MinIO, Caddy pour le
  TLS, cron système) — pour maîtriser les coûts et les données.

### Checklist de mise en production

Toutes les phases du plan (1 à 12) sont fonctionnellement complètes et
vérifiées en direct (voir les rapports `docs/phase-*.md`). Ce qui suit est
ce qui reste **spécifique à un déploiement réel** — ne peut pas être fait
ni vérifié depuis cet environnement de développement.

**Infrastructure et variables d'environnement** (voir `.env.example` pour
la liste complète et le détail de chaque variable) :

- [ ] Choisir le profil d'hébergement (§A.7 `architecture.md`) et
      provisionner PostgreSQL, le stockage de fichiers, l'envoi d'emails.
- [ ] `APP_ENV="production"` (bloque `seed:dev` et les données fictives).
- [ ] `AUTH_SECRET` et `DATA_ENCRYPTION_KEY` générés pour la production
      (`openssl rand -base64 32` / `openssl rand -hex 16`) — **jamais**
      les valeurs de développement, et à ne jamais perdre :
      `DATA_ENCRYPTION_KEY` chiffre les données d'identité client du
      module transactionnel (§D.6) ; sa perte les rend irrécupérables.
- [ ] `DATABASE_URL` de production, puis `npm run db:migrate:deploy`
      (jamais `npm run db:migrate` ni `prisma db push` en production).
- [ ] `STORAGE_PROVIDER="s3"` + identifiants du bucket choisi (jamais
      `local` en production — non durable entre déploiements).
- [ ] `EMAIL_PROVIDER="resend"` ou `"postmark"` + domaine d'envoi avec
      SPF/DKIM/DMARC configurés (sans quoi les emails de notification et
      les invitations au portail client arrivent en spam ou sont rejetés).
- [ ] `CRON_SECRET` généré, et le déclencheur cron de l'hébergeur pointé
      vers `POST /api/cron/[job]` pour les 3 jobs (`quotes-expire`,
      `invoices-overdue`, `reservations-remind`).
- [ ] `LOG_LEVEL="info"` ou `"warn"` (pas `"debug"`, trop verbeux en
      production).

**Première mise en route** :

- [ ] `npm run create-admin -- --email=... --name="..."` pour le premier
      administrateur, puis activer sa double authentification (2FA
      obligatoire, §H.2) à la première connexion — sans quoi il ne pourra
      pas accéder à l'admin (bloqué par `admin/layout.tsx`).
- [ ] Vérifier `GET /api/health` répond `200` depuis l'extérieur, puis le
      brancher sur un service de ping externe (§H.8 `architecture.md`).
- [ ] Mettre en place les sauvegardes automatiques (voir section
      « Sauvegardes » ci-dessous) et exécuter un premier test de
      restauration réel avant d'y faire confiance.

**Points en attente de décision, identifiés lors des phases précédentes**
(voir `docs/phase-11-durcissement.md` pour le détail de chacun — aucun
n'est bloquant pour un premier déploiement, mais à traiter avant une
utilisation à grande échelle) :

- [ ] Resserrer `img-src` dans la CSP (`next.config.ts`) au domaine de
      stockage définitif, une fois choisi (actuellement `https:` en
      attente de ce choix).
- [ ] Contenu juridique définitif (mentions légales, CGV, politique de
      confidentialité) et validation du cadre applicable aux services de
      change/transactionnels (§D.6, §H.7) — **juridique, hors périmètre
      technique**.
- [ ] Ré-exécuter `npm audit` juste avant la mise en production (3
      vulnérabilités actuellement, toutes dans des outils de
      développement jamais exécutés en production, mais à reconfirmer sur
      les versions alors installées).

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

La checklist de mise en production ci-dessus est ce qui reste à faire au
moment du choix d'hébergement réel — le reste du plan (1 à 12) est
fonctionnellement complet et vérifié en direct, voir les rapports
`docs/phase-*.md`.
