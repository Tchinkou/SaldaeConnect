# SaldaeConnect

Plateforme d'agence numérique : site public, CRM, devis → projet → facture,
espace client, réservations, transactions, CMS et tableau de bord —
multilingue FR/EN/AR (RTL). Voir [`docs/architecture.md`](./docs/architecture.md)
pour la conception complète (validée le 2026-09-23) et
[`docs/roadmap`](./docs/architecture.md#j-feuille-de-route) pour l'avancement
par phase. Ce dépôt en est à la **Phase 1 — Fondations**.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack, React 19.2) — voir
  `AGENTS.md`, cette version diffère des habitudes d'avant Next 16.
- TypeScript strict, Tailwind CSS v4.
- [Prisma ORM 7](https://www.prisma.io) + PostgreSQL 16 (adaptateur
  `@prisma/adapter-pg`).
- [Better Auth](https://www.better-auth.com) (email/mot de passe argon2id,
  double authentification, lien magique).
- [next-intl](https://next-intl.dev) pour l'internationalisation FR/EN/AR.

## Structure du dossier

```
src/
  app/[locale]/       Pages (App Router), une racine par langue
  components/         ui/ (design system), layout/, icons/
  i18n/                routing, navigation et chargement des messages
  server/core/         env, base de données, auth, email — logique serveur transverse
  styles/               tokens du design system (globals.css)
  generated/prisma/      client Prisma généré (ignoré par git)
prisma/
  schema/               schéma multi-fichiers (identité, CRM, catalogue, devis, projets…)
  migrations/            migrations SQL (dont contraintes CHECK et index de recherche écrits à la main)
  seed/                  seed de base (production) + seed de démonstration (développement)
messages/{fr,en,ar}/    traductions, un fichier par espace de noms
docs/                    architecture.md (référence) + database/security/i18n/deployment.md (pratique)
```

## Installation

Prérequis : Node.js 20.9+, PostgreSQL 16 (ou Docker).

```bash
cp .env.example .env
# renseignez au moins DATABASE_URL, SHADOW_DATABASE_URL, AUTH_SECRET, DATA_ENCRYPTION_KEY
npm install
```

Générer les secrets de développement :

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 16      # DATA_ENCRYPTION_KEY, CRON_SECRET
```

Toutes les variables sont documentées dans [`.env.example`](./.env.example)
et validées au démarrage par `src/server/core/env.ts` (l'application refuse
de démarrer si une variable obligatoire manque). Détails de chaque
sous-système : [`docs/security.md`](./docs/security.md),
[`docs/database.md`](./docs/database.md), [`docs/i18n.md`](./docs/i18n.md),
[`docs/deployment.md`](./docs/deployment.md).

## Base de données

Avec Docker (PostgreSQL, MinIO, Mailpit) :

```bash
docker compose up -d
```

Ou une instance PostgreSQL locale existante — ajustez `DATABASE_URL` /
`SHADOW_DATABASE_URL` dans `.env` en conséquence.

```bash
npm run db:migrate          # applique les migrations (mode développement, calcule le diff via la base "shadow")
npm run db:seed             # rôles, permissions, catalogue de services, paramètres + données de démonstration
```

`npm run db:seed` exécute toujours le seed de base (idempotent, sûr en
production) puis, sauf si `APP_ENV=production`, un jeu de données fictives
(2 comptes admin, 2 staff, 4 clients, un pipeline commercial, un devis
accepté, un projet, une facture partiellement payée…). Mot de passe de
démonstration : `SaldaeConnect2026!`.

Autres commandes utiles :

```bash
npm run db:studio           # explorateur de données Prisma Studio
npm run db:reset-dev         # supprime uniquement les données de démonstration (pas un reset complet)
npm run db:migrate:deploy    # applique les migrations sans prompt interactif (CI, production)
```

Voir [`docs/database.md`](./docs/database.md) pour le détail du schéma et
des contraintes.

## Développement

```bash
npm run dev
```

Ouvrir [http://localhost:3000/fr](http://localhost:3000/fr) (ou `/en`,
`/ar`). La page d'accueil actuelle est un point de contrôle technique
« Phase 1 — Fondations », pas le site vitrine final (voir §48 des
spécifications : aucune interface ne doit simuler une fonctionnalité qui
n'existe pas encore).

```bash
npm run lint
npm run typecheck
npm run build
```

## Créer un compte administrateur (production)

```bash
npm run create-admin -- --email=admin@example.com --name="Nom Prénom"
```

Génère un mot de passe aléatoire si `--password=` n'est pas fourni. Activez
la double authentification dès la première connexion.

## Traductions

Trois fichiers par espace de noms sous `messages/{fr,en,ar}/`. Voir
[`docs/i18n.md`](./docs/i18n.md) pour la marche à suivre (ajout de clé,
namespaces, règles RTL) et [`docs/architecture.md` §G](./docs/architecture.md#g-architecture-multilingue-frenar--rtl)
pour les principes.

## Déploiement

Voir [`docs/deployment.md`](./docs/deployment.md).
