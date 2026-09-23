# Base de données

Le modèle de données complet (entités, relations, décisions) est documenté
dans [`architecture.md` §B](./architecture.md#b-architecture-de-la-base-de-données).
Ce document couvre uniquement la partie pratique : comment travailler avec
le schéma au quotidien.

## Structure

Le schéma Prisma est découpé par domaine dans `prisma/schema/*.prisma`
(fusionnés automatiquement par Prisma) :

| Fichier | Domaine |
|---|---|
| `00-base.prisma` | Générateur, datasource |
| `10-identity.prisma` | Utilisateurs (Better Auth), RBAC, invitations |
| `20-crm.prisma` | Leads, clients, opportunités, pipeline, tâches |
| `30-catalog.prisma` | Catégories, services, formulaires de demande |
| `40-quotes.prisma` | Devis |
| `50-projects.prisma` | Projets, jalons, tâches |
| `60-billing.prisma` | Factures, paiements, abonnements |
| `70-bookings.prisma` | Réservations |
| `80-transactions.prisma` | Produits transactionnels (change, cartes…) |
| `90-messaging.prisma` | Conversations, notifications, fichiers, outbox |
| `95-cms.prisma` | Paramètres, portfolio, témoignages, blog, pages |
| `99-audit.prisma` | Journal d'audit, limitation de débit |

Les modèles `User`, `Session`, `Account`, `Verification` et `TwoFactor` dans
`10-identity.prisma` sont générés par Better Auth — voir
[`security.md`](./security.md#régénérer-le-schéma-better-auth) avant de les
modifier à la main.

## Identifiants, montants, traductions

- Identifiants : UUID v7 (`@default(uuid(7))`), triables chronologiquement.
- Montants : `BigInt` en unités mineures (centimes) + une colonne `currency`
  séparée. Ne jamais utiliser de nombre à virgule flottante pour un montant.
- Contenu traduisible : une table `Xxx` + une table `XxxTranslation` avec
  `@@unique([parentId, locale])` et, quand c'est indexable publiquement,
  `@@unique([locale, slug])`.

## Ce que Prisma n'exprime pas

Certaines contraintes ne sont pas représentables dans `schema.prisma` et
vivent en SQL brut dans une migration dédiée
(`prisma/migrations/20260923020812_constraints_and_search/migration.sql`) :

- des `CHECK` (ex. une opportunité vient toujours d'un lead ou d'un client,
  un fichier n'a qu'un seul parent métier, les montants sont positifs) ;
- l'extension `pg_trgm` et les index GIN utilisés par la recherche globale
  (§I.6 de `architecture.md`) ;
- un index unique partiel (un seul contact principal actif par client).

Si vous ajoutez une contrainte de ce type, créez une migration dédiée avec
`prisma migrate dev --create-only --name <nom>`, puis éditez son
`migration.sql` à la main plutôt que de tenter de l'exprimer dans le schéma.

## Commandes courantes

```bash
npm run db:migrate          # créer/appliquer une migration en développement
npm run db:migrate:deploy   # appliquer les migrations en production
npm run db:generate         # régénérer le client Prisma (src/generated/prisma)
npm run db:seed             # seed:base, puis seed:dev hors production
npm run db:reset-dev        # supprime uniquement les données de seed:dev
npm run db:studio           # explorateur de données Prisma Studio
```

`npm run db:seed` exécute `prisma/seed/index.ts`, qui appelle toujours
`seedBase()` (idempotent, utilisable en production : rôles, permissions,
pipeline, catalogue réel, paramètres par défaut) puis, uniquement si
`APP_ENV !== "production"`, `seedDev()` (données strictement fictives, §40
du cahier des charges).

## Recherche

La recherche globale (§I.6) s'appuie sur `pg_trgm` : `WHERE column %
$1 ORDER BY similarity(column, $1) DESC`, sur les colonnes indexées listées
dans la migration `constraints_and_search`. Ajouter une nouvelle colonne à
la recherche = ajouter un index GIN trigram dans une nouvelle migration SQL.
