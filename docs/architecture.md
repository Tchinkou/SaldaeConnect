# SaldaeConnect : architecture technique v1

> **Statut :** proposition à valider · **Date :** 23/09/2026 · **Portée :** sections A à K demandées au §57 du cahier des charges.
> Aucun code n'a encore été écrit. Le développement démarre phase par phase après validation de ce document.

## Sommaire

0. Synthèse de l'analyse (décisions, ambiguïtés, risques)
- A. Architecture générale
- B. Base de données
- C. Architecture des dossiers
- D. Flux utilisateurs
- E. Flux CRM
- F. Flux devis → projet → facture
- G. Multilingue FR/EN/AR et RTL
- H. Sécurité
- I. Dashboard (admin et portail)
- J. Roadmap de développement
- K. Points réellement bloquants
- Annexe 1. Design system et identité provisoire
- Annexe 2. Variables d'environnement prévues

---

## 0. Synthèse de l'analyse

### 0.1 Lecture du besoin

SaldaeConnect est **un seul produit** avec quatre surfaces : le site public, le back-office (CRM + ERP léger + CMS), le portail client et une API. Toutes partagent la même base de données, les mêmes règles métier et les mêmes permissions.

La vraie difficulté n'est pas le nombre d'écrans : c'est que **les services n'ont pas le même cycle de vie**. Un site web se vend sur devis et devient un projet ; une gestion de réseaux sociaux se facture chaque mois ; un rendez-vous visa se réserve ; une vente d'euros est une transaction avec stock. L'architecture est donc construite autour d'un **catalogue unique** dont chaque service déclare un **mode de traitement** qui l'oriente vers le bon module.

### 0.2 Décisions structurantes

| Sujet | Décision | Raison |
|---|---|---|
| Forme de l'application | **Monolithe modulaire** Next.js (App Router), couche métier isolée dans `src/server/modules` | Une seule application à déployer ; les modules sont du TypeScript pur, extractibles vers NestJS sans réécriture |
| Langage | TypeScript `strict` partout | Exigé (§51) |
| Rendu | Server Components par défaut, composants client uniquement pour l'interactivité | Peu de JavaScript côté navigateur (§26) |
| Base de données | PostgreSQL + Prisma, migrations versionnées | Exigé ; SQL brut versionné pour les contraintes que Prisma n'exprime pas |
| Authentification | **Better Auth** (adaptateur Prisma) | Auth.js a rejoint le projet Better Auth en 2025 et n'évolue plus qu'en maintenance. Better Auth fournit nativement mot de passe local, sessions en base, 2FA TOTP, lien magique, invitations et limitation de tentatives |
| Hachage des mots de passe | argon2id | Standard actuel recommandé (OWASP) |
| i18n | next-intl, préfixe de langue obligatoire (`/fr`, `/en`, `/ar`) | Exigé ; URLs stables pour le SEO |
| Styles | Tailwind CSS v4, jetons en variables CSS, **utilitaires logiques uniquement** | RTL natif, thème modifiable depuis l'admin |
| Composants | Primitives **Radix UI** (accessibles, sans style) + design system maison | Accessibilité sans apparence de template (§53) |
| Validation | Zod, schémas partagés client et serveur | Exigé (§42) |
| Formulaires | React Hook Form + résolveur Zod | Léger, compatible avec les formulaires multi-étapes |
| Emails | Interface `EmailProvider` ; adaptateur **Resend** par défaut, **Postmark** en second ; gabarits React Email | Pas de dépendance à un fournisseur (§4) |
| PDF | Gabarits HTML rendus par **Chromium headless (Puppeteer)** derrière une interface `PdfRenderer` | L'arabe (liaison des lettres, texte bidirectionnel) n'est rendu de façon fiable que par un vrai moteur de navigateur. React-PDF a des limites connues en RTL ; un prototype en phase 1 confirmera le choix |
| Fichiers | Stockage **compatible S3** (Cloudflare R2, AWS S3, Scaleway, MinIO sur VPS) via une interface `StorageProvider` ; bucket privé | Portable entre Vercel, Railway et VPS |
| Tâches différées | Table `Job` / outbox dans PostgreSQL + point d'entrée cron protégé | Fonctionne avec Vercel Cron, Railway Cron ou un timer système sur VPS |
| Limitation de débit | Stockage PostgreSQL par défaut, adaptateur Redis optionnel | Aucun service supplémentaire obligatoire |
| Recherche globale | Recherche plein texte PostgreSQL + `pg_trgm` | Pas de moteur externe à héberger |
| Montants | Entiers en **unités mineures** (centimes) + code devise ISO 4217 | Aucun calcul financier en virgule flottante |
| Dates | UTC en base ; fuseau de l'agence configurable | Réservations et échéances cohérentes |
| Tests | Vitest (unitaires, intégration), Playwright (E2E, responsive, RTL), axe-core (accessibilité) | §15, §38, §39 |
| CI | GitHub Actions : lint, typecheck, tests, build, contrôle des migrations | §56 |

### 0.3 Ambiguïtés relevées et décisions par défaut

Aucune de ces décisions ne bloque le démarrage ; toutes sont modifiables. Celles qui méritent une confirmation sont reprises en K.

1. **Pays d'établissement.** Le nom (Saldae est l'ancien nom de Béjaïa) et les services (TCF, visa, euros, Paysera) laissent penser que l'agence est en Algérie. *Déduction, non confirmée.* Par défaut : devise DZD, fuseau `Africa/Algiers`, indicatif téléphonique +213, EUR disponible pour les clients internationaux. Tout reste paramétrable.
2. **Prospect, client, entreprise.** Trois notions séparées : le **Lead** (la personne ou société qui nous contacte), l'**Opportunité** (une affaire précise, c'est la carte du Kanban) et le **Client** (le compte facturable, particulier ou société). L'entité « Company » du cahier des charges est intégrée au Client (champ `kind`), avec des contacts multiples. Détails en E.1.
3. **Pipeline.** Les neuf étapes demandées sont reprises, plus une étape **« Perdu »** (hors colonne principale), indispensable pour mesurer la conversion. Les étapes sont stockées en base et renommables.
4. **Types de services.** Le « Type 3 » du cahier des charges regroupe deux fonctionnements différents (réservation et transaction), qui ont chacun leur module (§20 et §21). Le catalogue connaît donc quatre modes : `QUOTE` (sur devis), `RECURRING` (forfait récurrent), `BOOKING` (réservation), `TRANSACTION`. Ajouter un mode demandera du code (un nouveau flux métier), mais aucune refonte : chaque mode est un gestionnaire indépendant.
5. **Rendez-vous visa et TCF.** Deux lectures possibles : le client réserve un créneau **à l'agence**, ou il demande à l'agence d'**obtenir un rendez-vous externe** (consulat, centre de visa, centre d'examen). Le module gère les deux (`AGENCY_SLOT` et `EXTERNAL_APPOINTMENT`), configurable par service.
6. **Emplacement de l'administration.** `/{locale}/admin` plutôt que `/admin`, pour que le back-office soit lui aussi traduit et fonctionne en RTL. Tous ses textes sont dans les fichiers de traduction dès le départ ; le français est livré en premier, l'anglais et l'arabe de l'admin en phase i18n.
7. **Portail client.** URL `/{locale}/portal` (le cahier des charges proposait `/dashboard`, ambigu entre admin et client).
8. **Inscription des clients.** Pas d'inscription publique en V1. Un client obtient un accès par **invitation** (automatique à l'envoi du premier devis, ou manuelle). Surface d'attaque réduite, pas de comptes vides.
9. **Formats de numérotation.** Configurables. Valeurs par défaut : demande `SC-2026-00001` (format demandé), devis `DEV-2026-0001`, facture `FAC-2026-0001`, avoir `AV-2026-0001`, projet `PRJ-2026-001`, réservation `RDV-2026-0001`, transaction `TRX-2026-0001`. Le numéro de facture est attribué **à l'émission**, jamais au brouillon, pour garantir une suite sans trou.
10. **Traductions manquantes.** Une page publique (service, article, projet du portfolio) n'est publiée dans une langue que si sa traduction existe et est validée. Pas de repli silencieux vers le français : cela créerait du contenu dupliqué pour Google et une page en mauvaise langue.
11. **Slugs arabes.** Slug latin par défaut (par exemple `/ar/services/web-development`), modifiable en slug arabe si souhaité. Les slugs arabes s'encodent en `%D8%...` dans les URLs partagées, ce qui est peu lisible.
12. **Chiffres en arabe.** Chiffres occidentaux (0-9), usage courant au Maghreb, via `Intl` avec `numberingSystem: "latn"`. Modifiable.
13. **Fiscalité.** Aucun taux de TVA n'est inventé. Les taux, mentions obligatoires et identifiants légaux sont des paramètres. Tant que la configuration fiscale n'est pas marquée « validée par le comptable », l'admin affiche un avertissement sur le module facturation.
14. **Paiement en ligne.** Absent en V1 (§19) ; les paiements sont enregistrés manuellement. L'interface `PaymentProvider` est prévue pour plus tard.
15. **Messagerie en temps réel.** V1 : rafraîchissement automatique périodique de la conversation ouverte et des compteurs. Un vrai temps réel (WebSocket ou service managé) pourra venir ensuite sans changer le modèle de données.
16. **Blog.** Modèle de données et routes prévus dès le départ ; interface d'édition livrée en phase 10 (le §30 autorise la phase 2).
17. **Données fictives.** Deux seeds séparés : `seed:base` (rôles, étapes, paramètres par défaut, catalogue réel de services) utilisable en production, et `seed:dev` (données fictives du §40), qui **refuse de s'exécuter en production**.
18. **Contenus non fournis.** Portfolio, témoignages et chiffres clés ne sont jamais inventés. Une section vide est masquée sur le site plutôt que remplie de faux contenu.

### 0.4 Risques identifiés

| Risque | Impact | Réponse prévue |
|---|---|---|
| Cadre réglementaire du change, des cartes prépayées, de Paysera et des démarches visa | Juridique, potentiellement élevé | Module conçu comme outil de suivi interne ; affichage public désactivé par défaut ; aucun texte ne présente l'agence comme agréée ; champs d'identification, plafonds et mentions légales configurables |
| Facturation non conforme | Fiscal | Paramètres fiscaux configurables, validation par le comptable avant la première facture réelle, factures émises immuables, avoirs pour les corrections |
| Données personnelles sensibles (passeport, pièces d'identité pour visa et transactions) | Fuite de données | Minimisation, chiffrement applicatif des champs sensibles, accès restreint, durée de conservation configurable, purge automatique |
| Périmètre très large | Retard, qualité inégale | Livraison par phases avec critères de sortie ; site public et demandes de devis en ligne tôt (fin de phase 3) |
| Qualité du contenu arabe et anglais | Image de marque | Textes rédigés nativement, relecture par un arabophone natif avant mise en ligne |
| PDF en arabe | Documents illisibles | Rendu Chromium, prototype dès la phase 1 |
| Spam sur les formulaires publics | CRM pollué | Piège à robots, contrôle du temps de saisie, limitation de débit, captcha optionnel (Turnstile) activable depuis l'admin |
| Dépendance à un hébergeur | Coût, migration | Interfaces pour email, stockage, PDF, cron, limitation de débit ; sortie `standalone` Next.js et Docker Compose |

---

## A. Architecture générale

### A.1 Vue d'ensemble

```
  Navigateurs                 ┌──────────────────────────────────────────────────────┐
  (visiteur, client,  HTTPS   │                 Application Next.js                  │
   staff, admin)  ──────────▶ │                                                      │
                              │  proxy (middleware) : langue, en-têtes de sécurité,  │
                              │  redirection si non connecté (confort, pas sécurité) │
                              │                                                      │
                              │  ┌───────────── Présentation ─────────────────────┐  │
                              │  │ Site public     Portail client     Admin       │  │
                              │  │ (statique/ISR)  (dynamique)        (dynamique) │  │
                              │  └──────┬──────────────────────┬─────────────────┘  │
                              │   Server Actions        Route Handlers /api/v1      │
                              │         └──────────┬───────────┘                    │
                              │  ┌─────────────────▼──────────────────────────────┐ │
                              │  │ Couche métier  src/server/modules/*            │ │
                              │  │ authentifier → autoriser → valider → exécuter  │ │
                              │  │ (transaction) → journaliser → émettre événement│ │
                              │  └─────────────────┬──────────────────────────────┘ │
                              │  Accès aux données : Prisma, requêtes filtrées      │
                              │  par périmètre (scope) de l'utilisateur             │
                              └────────────────────┼─────────────────────────────────┘
                                                   ▼
        ┌──────────────┐   ┌──────────────────┐   ┌──────────────┐   ┌───────────────┐
        │ PostgreSQL   │   │ Stockage S3      │   │ Email        │   │ Chromium      │
        │ données, jobs│   │ fichiers, PDF    │   │ Resend /     │   │ (PDF)         │
        │ audit, cache │   │ médias publics   │   │ Postmark     │   │               │
        └──────────────┘   └──────────────────┘   └──────────────┘   └───────────────┘
                 ▲
                 │ appel toutes les minutes (Vercel Cron, Railway Cron ou timer VPS)
        /api/cron/* : envoi des emails et notifications, devis expirés, factures en
        retard, factures récurrentes, rappels de rendez-vous, purges
```

### A.2 Principes

1. **Découpage par domaine.** Modules : `identity`, `crm`, `catalog`, `quotes`, `projects`, `billing`, `subscriptions`, `bookings`, `transactions`, `messaging`, `notifications`, `files`, `cms`, `seo`, `settings`, `search`, `reporting`, `audit`. Chaque module contient ses schémas Zod, ses cas d'usage (`service`), son accès aux données (`repository`), ses règles d'accès (`policy`) et ses événements.
2. **Frontière stricte.** Les composants n'importent jamais Prisma. Tout le code serveur est marqué `server-only`. Un module ne modifie pas les tables d'un autre module : il appelle son service ou réagit à un événement.
3. **Deux portes d'entrée, une seule logique.** L'interface web utilise des Server Actions ; l'API REST `/api/v1` sert les intégrations et la future application mobile. Les deux passent par le même enveloppeur, qui applique dans l'ordre : authentification, autorisation, validation Zod, exécution (transaction si plusieurs écritures), journal d'audit, émission d'événements, réponse normalisée :
   ```ts
   type Result<T> =
     | { ok: true; data: T }
     | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };
   ```
   Le `message` est une clé de traduction : l'utilisateur ne voit jamais d'erreur technique brute (§43).
4. **Événements fiables (outbox).** Une action métier écrit, dans la même transaction que ses données, les événements à traiter (`quote.accepted`, `lead.created`…). Un répartiteur les consomme juste après la requête, et le cron rattrape ce qui a échoué. Résultat : aucune notification perdue, et aucune notification envoyée pour une action annulée.
5. **Trois niveaux de configuration.** Variables d'environnement (secrets, infrastructure) ; table `Setting` (tout ce qui est métier et administrable : marque, couleurs, coordonnées, textes, fiscalité, modules actifs) ; code (règles, jamais de contenu administrable).
6. **Modules activables.** Réservations, transactions et blog peuvent être activés ou désactivés depuis les paramètres. Un module désactivé disparaît du site et de la navigation, sans fausse interface (§48).

### A.3 Surfaces et routes principales

| Surface | Préfixe | Rendu | Accès |
|---|---|---|---|
| Site public | `/{locale}/…` | Statique avec revalidation à la modification (ISR par tags) | Public |
| Authentification | `/{locale}/login`, `/forgot-password`, `/invitation/[token]`… | Dynamique | Public, limité en débit |
| Portail client | `/{locale}/portal/…` | Dynamique, jamais mis en cache | Rôle client, données du client uniquement |
| Administration | `/{locale}/admin/…` | Dynamique, `noindex` | Admin et staff selon permissions |
| API REST | `/api/v1/…` | Dynamique | Session (web) ou jeton (mobile, plus tard) |
| Technique | `/api/auth/*`, `/api/cron/*`, `/api/files/*`, `/api/health` | Dynamique | Selon le cas (secret cron, session) |

### A.4 Rendu et cache

- **Pages publiques** générées statiquement et revalidées par **tags** quand l'admin modifie un contenu (`revalidateTag("services")`, `revalidateTag("settings")`…). Le site reste rapide tout en reflétant immédiatement les modifications.
- **Portail et admin** entièrement dynamiques ; aucune donnée personnelle n'est mise en cache partagé.
- **Paramètres globaux** (marque, couleurs, coordonnées) lus une fois par requête puis mis en cache avec un tag.
- **Auto-hébergement** : sortie `standalone`. Avec plusieurs instances, un gestionnaire de cache partagé (Redis) sera nécessaire ; une seule instance suffit au départ.

### A.5 Services externes et abstractions

| Besoin | Interface | Implémentation V1 | Alternatives prévues |
|---|---|---|---|
| Email | `EmailProvider` | Resend | Postmark, SMTP ; Mailpit en développement |
| Fichiers | `StorageProvider` | S3 compatible (R2 recommandé) | AWS S3, Scaleway, MinIO ; disque local en développement |
| PDF | `PdfRenderer` | Puppeteer + Chromium | Service Gotenberg sur VPS ; `@sparticuz/chromium` sur Vercel |
| Tâches | `JobQueue` | Table PostgreSQL + cron | pg-boss ou file Redis si le volume l'exige |
| Limitation de débit | `RateLimiter` | PostgreSQL | Redis (Upstash ou auto-hébergé) |
| Anti-spam | `CaptchaVerifier` | Désactivé (piège à robots + débit) | Cloudflare Turnstile |
| Antivirus | `FileScanner` | Vérification du type réel, pas d'antivirus | ClamAV si l'infrastructure le permet |
| Paiement en ligne | `PaymentProvider` | Aucun (manuel) | Plus tard |
| Signature électronique | `SignatureProvider` | Acceptation par clic horodatée | Fournisseur de signature qualifiée plus tard |
| SMS / WhatsApp | `NotificationChannel` | Application + email | WhatsApp Business API, SMS plus tard |

### A.6 Évolutivité

- **Vers NestJS** : `src/server/modules` n'importe rien de Next.js. Déplacer un module revient à l'exposer par un contrôleur NestJS ; Next.js appellerait alors l'API au lieu du service local.
- **Vers une application mobile** : l'API `/api/v1` existe dès le départ ; l'ajout d'une authentification par jeton est prévu par Better Auth.
- **Vers l'IA, le chatbot, les tickets, l'automatisation** : les événements métier (`lead.created`, `message.posted`…) sont le point d'accroche naturel. Rien n'est implémenté maintenant.

### A.7 Cibles d'hébergement

| Option | Composition | Adaptée si |
|---|---|---|
| Managée | Vercel + Neon (PostgreSQL) + Cloudflare R2 + Resend | On veut zéro serveur à maintenir |
| VPS | Docker Compose : application, PostgreSQL, MinIO, Caddy (HTTPS), Chromium, cron | On veut maîtriser les coûts et les données |
| Intermédiaire | Railway (application + PostgreSQL) + R2 | Compromis simplicité / coût |

Le code est identique dans les trois cas. Le choix n'est nécessaire qu'en phase 12 (déploiement) ; la recommandation est en K.

---

## B. Architecture de la base de données

### B.1 Conventions

- **Identifiants** : UUID v7 (triables chronologiquement, non devinables). Les numéros métier lisibles (`SC-2026-00001`) sont des colonnes séparées, uniques.
- **Horodatage** : `createdAt`, `updatedAt` sur toutes les tables ; `deletedAt` (suppression logique) là où c'est pertinent (B.5).
- **Montants** : `BigInt` en unités mineures + `currency` (ISO 4217). Quantités et taux en `Decimal`.
- **Statuts stables** (cycle de vie codé) : enums PostgreSQL. **Listes que l'agence doit pouvoir modifier** (étapes du pipeline, sources de prospects, moyens de paiement, taux de taxe, motifs de perte) : tables.
- **Contenu traduisible** : tables `…Translation` avec `(parentId, locale)` unique et `(locale, slug)` unique. Permet un slug, un SEO et un statut de publication par langue.
- **Instantanés** : un document émis (version de devis envoyée, facture émise) stocke une copie figée de ses données (client, lignes, mentions légales, taux) et l'empreinte SHA-256 de son contenu. Modifier un client ou un taux ne modifie jamais un document déjà envoyé.
- **Contraintes que Prisma n'exprime pas** (CHECK, index partiels, colonnes de recherche) : SQL versionné dans les migrations.

### B.2 Vue des relations principales

```
                          ┌───────────────┐
      LeadSource ────────▶│     Lead      │── converti en ──┐
                          └──────┬────────┘                 ▼
                                 │ 1..n            ┌─────────────────┐     ┌───────────────┐
   Service ◀──── Opportunity ◀───┘                 │     Client      │────▶│ ClientContact │── User (accès portail)
   (catalogue)   (carte Kanban,  ───── ou ────────▶│ (particulier ou │     └───────────────┘
                  n° SC-…)                         │  société)       │
                     │                             └──┬───┬───┬───┬──┘
                     │                                │   │   │   │
                     ▼                                │   │   │   └──▶ Reservation, TransactionOrder
                  Quote ◀─────────────────────────────┘   │   └──────▶ Subscription ──▶ Invoice (récurrente)
                  ├─ QuoteItem                            │
                  ├─ QuoteInstallment (échéancier)        │
                  ├─ QuoteVersion (figée, PDF, empreinte) │
                  └─ QuoteDecision (acceptation / refus)  │
                     │ acceptée                           │
                     ▼                                    │
                  Project ────────────────────────────────┤
                  ├─ ProjectMember ── User (staff)        │
                  ├─ Milestone ─ Task ─ Comment           │
                  ├─ Conversation ─ Message               │
                  └─ File                                 ▼
                                                       Invoice ─ InvoiceItem
                                                       └─ Payment
```

### B.3 Entités par domaine

#### Identité et accès

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `User` | Toute personne qui se connecte | email (unique, insensible à la casse), name, phone, `userType` (STAFF, CLIENT), locale, timezone, status (INVITED, ACTIVE, SUSPENDED), twoFactorEnabled, lastLoginAt, deletedAt | n rôles ; lié à 0..n `ClientContact` |
| `Account`, `Session`, `Verification`, `TwoFactor` | Tables de Better Auth | hash du mot de passe, jetons hachés, expiration, IP, user agent | Cascade à la suppression de l'utilisateur |
| `Role` | Rôle (admin, staff, client, puis rôles personnalisés comme « comptable ») | key (unique), name, isSystem | Les rôles système ne sont pas supprimables |
| `Permission` | Droit élémentaire | key (`quote.send`, `invoice.issue`…), description | Liste définie dans le code, synchronisée en base |
| `RolePermission` | Droits d'un rôle, avec périmètre | roleId, permissionId, `scope` (ALL, ASSIGNED, OWN) | Unique (roleId, permissionId) |
| `UserRole` | Rôles d'un utilisateur | userId, roleId | Unique |
| `Invitation` | Invitation staff ou client | email, roleId, clientId?, tokenHash, expiresAt, acceptedAt, invitedById | Jeton à usage unique, stocké haché |

#### CRM

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `Lead` | Personne ou société qui nous a contactés | firstName, lastName, email, phone (E.164), companyName, country, city, locale, sourceId, ownerId, status (OPEN, CONVERTED, DISQUALIFIED), convertedClientId, privacyAcceptedAt, marketingConsentAt, utm (JSON), deletedAt | Index sur email et phone (dédoublonnage) |
| `LeadSource` | Origine | key, libellés traduits, isActive | Site, WhatsApp, Facebook, Instagram, téléphone, visite, recommandation, autre |
| `Opportunity` | Une affaire ; la « demande » et la carte du Kanban | number (`SC-2026-00001`), title, leadId?, clientId?, serviceId, stageId, ownerId, budget (min, max, devise ou tranche), desiredDeadline, `formVersionId` + answers (JSON validé), message, locale, sourceId, estimatedValue, lostReasonId, position, closedAt, deletedAt | CHECK : leadId ou clientId renseigné ; index (stageId, position), (ownerId), (clientId) |
| `PipelineStage` | Colonne du Kanban | key, order, `kind` (OPEN, WON, LOST), libellés traduits, color, isSystem | Les clés système pilotent les automatismes |
| `OpportunityStageChange` | Historique du pipeline | opportunityId, fromStageId, toStageId, changedById (null si automatique), reason, createdAt | Append-only |
| `LostReason` | Motif de perte | libellés traduits | Obligatoire pour passer en « Perdu » |
| `Activity` | Chronologie commerciale | type (NOTE, CALL, EMAIL, MEETING, WHATSAPP, STAGE_CHANGE, SYSTEM), subject, body, occurredAt, actorId, leadId?, clientId?, opportunityId?, projectId?, quoteId?, invoiceId? | Index par parent + occurredAt |
| `Task` | Tâche (CRM et projets) | title, description, status (TODO, IN_PROGRESS, DONE, CANCELLED), priority, dueAt, assigneeId, createdById, opportunityId?, clientId?, projectId?, milestoneId?, visibleToClient, position, completedAt | Index (assigneeId, status, dueAt) pour les tâches en retard |
| `Client` | Compte facturable | code, `kind` (INDIVIDUAL, COMPANY), displayName, legalName, email, phone, adresse, country, city, `legalIdentifiers` (JSON : liste libellé/valeur, ex. identifiants fiscaux à définir avec le comptable), status (PROSPECT, ACTIVE, INACTIVE), preferredLocale, ownerId, deletedAt | Remplace « Company » |
| `ClientContact` | Personne rattachée à un client | clientId, firstName, lastName, email, phone, jobTitle, isPrimary, userId? | Un seul contact principal par client (index unique partiel) ; `userId` donne l'accès portail |

#### Catalogue

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `ServiceCategory` | Développement, Branding, Marketing… | order, icon, isActive | + `ServiceCategoryTranslation` (name, slug, description) |
| `Service` | Un service vendu | categoryId, **`fulfillmentType`** (QUOTE, RECURRING, BOOKING, TRANSACTION), isActive, isFeatured, order, icon, imageFileId, indicativePrice + currency + priceDisplay (masqué, « à partir de », fourchette), requestFormId, bookingConfig (JSON typé), deletedAt | — |
| `ServiceTranslation` | Contenu d'une page service | locale, name, slug, shortDescription, content (blocs : présentation, avantages, processus, exemples), estimatedDuration, seoTitle, seoDescription, ogImageFileId, noindex, isPublished | Unique (serviceId, locale) et (locale, slug) |
| `ServiceFaq` | FAQ d'un service | order, isActive | + traductions (question, answer) |
| `ServicePlan` | Formule d'un service récurrent | serviceId, billingInterval (MONTH, QUARTER, YEAR), price, currency, isActive, order | + traductions (nom, contenu de la formule) |
| `RequestForm` | Questionnaire spécifique à un service (étape 2 du formulaire) | serviceId ou categoryId, version, `schema` (JSON : champs, types, options, libellés FR/EN/AR, conditions d'affichage), isActive | Versionné : une demande garde la version du questionnaire auquel elle a répondu |

#### Devis

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `Quote` | Devis (modifiable tant qu'il est brouillon) | number, clientId, contactId, opportunityId?, projectId? (devis complémentaire), title, locale du document, currency, status, validUntil, introduction, terms, internalNotes, globalDiscount (type, valeur), deposit (pourcentage ou montant), subtotal, discountTotal, taxTotal, total, currentVersion, sentAt, firstViewedAt, decidedAt, createdById | Index (clientId, status), (status, validUntil) |
| `QuoteItem` | Ligne | position, serviceId?, title, description, quantity, unit, unitPrice, discountPercent, taxRateId?, taxRatePercent (copié), lineTotal | Cascade avec le devis ; CHECK quantité > 0, prix ≥ 0 |
| `QuoteInstallment` | Échéancier | label, percent ou amount, trigger (ON_ACCEPTANCE, ON_MILESTONE, ON_DELIVERY, ON_DATE), milestoneKey?, dueDate?, position | La somme doit faire 100 % (validé côté serveur) |
| `QuoteVersion` | Version envoyée, figée | quoteId, version, snapshot (JSON), contentHash, pdfFileId, sentAt, sentById | Unique (quoteId, version) ; jamais modifiée |
| `QuoteDecision` | Réponse du client | quoteId, quoteVersionId, decision (ACCEPTED, REJECTED, CHANGES_REQUESTED), comment, userId, signerName, signerEmail, ipAddress, userAgent, decidedAt, method (CLICK ; plus tard ESIGN), evidence (JSON) | Append-only ; prépare la signature électronique |

#### Projets

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `Project` | Projet de production | number, clientId, quoteId?, opportunityId?, subscriptionId?, name, description, status (PLANNING, IN_PROGRESS, WAITING_CLIENT, REVIEW, COMPLETED, ARCHIVED), startDate, dueDate, completedAt, budget + currency, progressMode (TASKS, MILESTONES, MANUAL), progressManual, managerId, deletedAt | Index (clientId, status), (managerId) |
| `ProjectMember` | Équipe | projectId, userId, role (MANAGER, MEMBER, VIEWER) | Unique (projectId, userId) ; base du périmètre ASSIGNED du staff |
| `Milestone` | Jalon visible par le client | title, description, dueDate, status, weight, position, completedAt | Peut déclencher une échéance de facturation |
| `Comment` | Commentaire de tâche | taskId, authorId, body, visibleToClient | — |
| `ProjectStatusChange` | Historique | from, to, changedById, note | Append-only |

#### Messagerie et notifications

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `Conversation` | Fil de discussion | type (PROJECT, CLIENT, RESERVATION, TRANSACTION), projectId?, clientId, subject, lastMessageAt | Une conversation principale par projet |
| `ConversationParticipant` | Participants | conversationId, userId, lastReadAt, muted | Le statut lu / non lu se calcule à partir de `lastReadAt` |
| `Message` | Message | conversationId, authorId, body (texte brut, rendu échappé), isInternalNote (jamais visible du client), editedAt, deletedAt | Pièces jointes via `File` |
| `Notification` | Notification dans l'application | userId, type, params (JSON, texte traduit à l'affichage), link, readAt | Index (userId, readAt, createdAt) |
| `NotificationPreference` | Préférences | userId, type, channel (IN_APP, EMAIL ; SMS, WHATSAPP plus tard), enabled | — |
| `Job` (outbox) | Événements et tâches différées | type, payload, status (PENDING, PROCESSING, DONE, FAILED), attempts, runAt, lockedAt, lastError | Verrouillage `FOR UPDATE SKIP LOCKED` |
| `EmailLog` | Traçabilité des envois | to, template, locale, providerMessageId, status, error, entité liée | — |

#### Facturation et récurrence

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `TaxRate` | Taux de taxe | name, ratePercent, mention légale traduite, isDefault, isActive | Aucun taux pré-rempli : à saisir après validation du comptable |
| `NumberSequence` | Numérotation | key (REQUEST, QUOTE, INVOICE, CREDIT_NOTE, PROJECT, RESERVATION, TRANSACTION), pattern (`{PREFIX}-{YYYY}-{SEQ:4}`), prefix, resetPolicy (YEARLY, NEVER), year, nextValue | Incrément atomique dans la transaction qui émet le document |
| `Invoice` | Facture ou avoir | number (null tant que brouillon), type (STANDARD, DEPOSIT, CREDIT_NOTE), clientId, projectId?, quoteId?, subscriptionId?, originalInvoiceId? (avoir), currency, status, issueDate, dueDate, subtotal, discountTotal, taxTotal, total, amountPaid, balanceDue, billingSnapshot (identités légales client et agence à l'émission), terms, notes, pdfFileId, contentHash, issuedById, cancelledAt, cancelReason | Numéro unique quand renseigné (index partiel) ; contenu immuable après émission |
| `InvoiceItem` | Ligne | comme `QuoteItem` | Cascade |
| `Payment` | Paiement reçu sur facture | invoiceId, clientId, amount, currency, paidAt, methodId, reference, note, recordedById, status (RECORDED, REVERSED), reversedById, reversalReason | CHECK montant > 0 ; une annulation garde la trace, rien n'est supprimé |
| `PaymentMethod` | Moyen de paiement | key, libellés traduits, isActive | Virement, espèces, carte, chèque ; autres moyens locaux ajoutables depuis l'admin |
| `Subscription` | Contrat récurrent (Type 2) | clientId, serviceId, planId?, title, currency, interval, intervalCount, startDate, endDate?, nextInvoiceDate, status (ACTIVE, PAUSED, CANCELLED, ENDED), autoIssue (faux par défaut : génère un brouillon) | + `SubscriptionItem` (lignes) |

#### Réservations

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `Service.bookingConfig` | Réglages d'un service réservable | mode (AGENCY_SLOT, EXTERNAL_APPOINTMENT), slotMinutes, capacityPerSlot, minNoticeHours, maxAdvanceDays, requiredDocuments, fee | Validé par Zod |
| `AvailabilityRule` | Horaires récurrents | serviceId?, weekday, startTime, endTime, validFrom, validTo | — |
| `AvailabilityException` | Fermetures ou ouvertures exceptionnelles | date, startTime?, endTime?, type (CLOSED, EXTRA), reason | — |
| `Reservation` | Rendez-vous ou démarche | number, serviceId, clientId?, leadId?, contact (instantané), status (REQUESTED, CONFIRMED, PENDING, COMPLETED, CANCELLED), startsAt/endsAt (créneau agence) ou preferredFrom/preferredTo (démarche externe), externalAppointmentAt, externalReference, answers (JSON, champs sensibles chiffrés), assignedToId, cancelReason, invoiceId? | Anti-surréservation : verrou transactionnel par (service, créneau) + contrôle de capacité |
| `ReservationStatusChange` | Historique | from, to, changedById, note | Append-only |

#### Transactions

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `Product` | Produit transactionnel | serviceId?, kind (CURRENCY, PREPAID_CARD, PAYSERA, OTHER), sku, unit, trackStock, isActive, **isPubliclyVisible (faux par défaut)**, currentPrice + currency, minQuantity, maxQuantity, requiredCustomerFields (configurable) | + traductions |
| `ProductPriceChange` | Historique des prix et taux | productId, price, effectiveAt, setById | Append-only |
| `StockMovement` | Mouvement de stock | productId, type (IN, OUT, ADJUSTMENT), quantity, unitCost?, transactionOrderId?, reference, note, createdById | Le stock est la **somme des mouvements**, jamais un champ modifiable à la main |
| `TransactionOrder` | Commande | number, clientId?, leadId?, contact (instantané), status (REQUESTED, PRICE_CONFIRMED, AWAITING_PAYMENT, PAID, COMPLETED, CANCELLED), total, currency, assignedToId, identityData (chiffré, champs configurables), notes, completedAt | + `TransactionOrderItem` (productId, quantity, unitPrice copié, total) |
| `TransactionPayment` | Encaissement d'une commande | orderId, amount, currency, methodId, reference, paidAt, recordedById, status | **Séparé de `Payment`** : les volumes de change ne doivent pas se mélanger au chiffre d'affaires de prestations |
| `TransactionStatusChange` | Historique | from, to, changedById, note | Append-only |

#### Fichiers

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `File` | Tout fichier stocké | storageKey (unique), originalName, safeName, mimeType (détecté), sizeBytes, sha256, uploadedById?, visibility (INTERNAL, CLIENT, PUBLIC), category (BRIEF, LOGO, DOCUMENT, DELIVERABLE, QUOTE_PDF, INVOICE_PDF, MEDIA, ATTACHMENT), status (QUARANTINE, ACTIVE, REJECTED, DELETED), scanStatus, fileGroupId + version, parents possibles : clientId?, opportunityId?, projectId?, taskId?, messageId?, reservationId?, transactionOrderId?, deletedAt | CHECK : au plus un parent métier ; les PDF de documents émis ne sont jamais supprimables |

#### CMS, SEO et paramètres

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `Setting` | Paramètres globaux | key (unique : `brand`, `theme`, `contact`, `social`, `homepage`, `navigation`, `footer`, `seo`, `legal`, `invoicing`, `modules`, `security`…), value (JSON validé par un schéma Zod propre à chaque clé ; textes au format `{fr, en, ar}`), updatedById | Chaque modification est auditée et revalide le cache |
| `KeyFigure` | Chiffres clés | value, suffix, libellés traduits, order, isActive | Masqués si aucun chiffre actif |
| `Page` | Pages gérées (à propos, mentions légales, confidentialité, CGV, cookies, pages libres) | key, isSystem | + `PageTranslation` (title, slug, blocks JSON, SEO, isPublished, **needsLegalReview**) |
| `Testimonial` | Témoignage | authorName, company, jobTitle, content, originalLocale, rating?, photoFileId, publicationConsent + date + preuve, googleReviewUrl, clientId?, isActive, order | Pas de publication sans consentement enregistré |
| `PortfolioProject` | Réalisation / étude de cas | clientName (affichable ou anonymisé), clientId?, sectorId, date, url, coverFileId, isFeatured, isPublished, order | + traductions (title, slug, summary, problem, solution, execution, result, SEO), liens n-n vers `Service` et `Technology`, galerie d'images |
| `Sector`, `Technology` | Filtres du portfolio | libellés traduits | — |
| `BlogPost` | Article | authorId, categoryId, status (DRAFT, SCHEDULED, PUBLISHED, ARCHIVED), publishedAt, coverFileId | + traductions (title, slug, excerpt, content, SEO) ; `BlogCategory`, `BlogTag` traduits |
| `Redirect` | Redirections 301 | fromPath (unique), toPath, statusCode, hits | Créée automatiquement quand un slug change |

Les champs SEO (title, description, image OG, `noindex`, canonical personnalisé) sont portés par chaque traduction de contenu indexable, et par `Setting.seo` pour les valeurs globales.

#### Audit et sécurité

| Entité | Rôle | Champs clés | Relations et contraintes |
|---|---|---|---|
| `AuditLog` | Journal des actions sensibles | category (SECURITY, BUSINESS, DATA), actorUserId?, actorLabel (copié), actorRoles, action (`quote.update`, `auth.login_failed`…), entityType, entityId, entityLabel (ex. `DEV-2026-0012`), changes (avant/après, champs sensibles masqués), ip, userAgent, requestId, createdAt | Append-only ; index (entityType, entityId), (actorUserId, createdAt) |
| `RateLimitBucket` | Compteurs de limitation | key, windowStart, count | Purge automatique |

### B.4 Index et contraintes transverses

- **Clés étrangères** : `RESTRICT` sur tout ce qui touche aux documents financiers (impossible de supprimer un client qui a une facture), `CASCADE` sur les lignes et éléments dépendants (lignes de devis, participants).
- **Unicités** : email utilisateur, numéros métier, `(locale, slug)` par type de contenu, `(projectId, userId)` des membres, numéro de facture quand renseigné.
- **CHECK** : montants et quantités positifs, parent unique des fichiers, lead ou client pour une opportunité, cohérence des dates (fin ≥ début).
- **Recherche** : colonnes `tsvector` générées (nom, email, entreprise, numéro, titre) et index GIN + `pg_trgm` sur Client, Lead, Opportunity, Project, Quote, Invoice et traductions de Service.
- **Listes paginées** : index composites alignés sur les filtres de l'admin (statut + date, responsable + statut).

### B.5 Suppression et immuabilité

| Donnée | Règle |
|---|---|
| Leads, clients, opportunités, services, projets, fichiers, contenus CMS | Suppression logique (`deletedAt`), filtrée par défaut par une extension Prisma ; purge définitive possible par un admin, tracée |
| Devis brouillon | Suppression possible |
| Devis envoyé, version de devis, décision client | Jamais supprimés ; un devis peut être annulé |
| Facture émise, paiement, avoir | Jamais supprimés ni modifiés ; annulation et avoir uniquement |
| Journal d'audit, historiques de statut | Append-only ; l'application n'a aucune fonction de modification |
| Données sensibles (pièces d'identité, passeports) | Chiffrées ; purge automatique après une durée configurable une fois le dossier clôturé |

### B.6 Migrations et seeds

- `prisma migrate dev` en développement, `prisma migrate deploy` en production ; jamais `db push` hors développement local.
- `seed:base` (idempotent, utilisable en production) : permissions, rôles système, étapes du pipeline, séquences de numérotation, sources de leads, motifs de perte, moyens de paiement, paramètres par défaut, catalogue initial des services (FR/EN/AR, marqué « à relire »), pages légales vides marquées « validation juridique requise ».
- `seed:dev` : données fictives du §40 (2 admins, staff, clients, prospects, devis, projets, factures, paiements, messages, portfolio, témoignages), emails en `@example.test`. Refuse de s'exécuter si `APP_ENV=production`.
- `pnpm create-admin` : script en ligne de commande pour créer le premier administrateur (avec 2FA à configurer à la première connexion).

---

## C. Architecture des dossiers

La structure proposée reprend celle du cahier des charges avec trois ajustements : un dossier `src/`, une couche `server/` qui remplace `lib/services` et `lib/crm` (pour séparer strictement le code serveur), et des fichiers de traduction découpés par espace de noms.

```
saldaeconnect/
├─ src/
│  ├─ app/
│  │  ├─ [locale]/
│  │  │  ├─ layout.tsx                    # <html lang dir>, polices par langue, thème depuis Setting
│  │  │  ├─ not-found.tsx, error.tsx
│  │  │  ├─ (public)/
│  │  │  │  ├─ page.tsx                    # accueil
│  │  │  │  ├─ services/page.tsx           # catalogue
│  │  │  │  ├─ services/[slug]/page.tsx    # page service
│  │  │  │  ├─ portfolio/page.tsx, portfolio/[slug]/page.tsx
│  │  │  │  ├─ about/, contact/
│  │  │  │  ├─ quote/                      # formulaire multi-étapes
│  │  │  │  ├─ booking/[slug]/             # réservation (si module actif)
│  │  │  │  ├─ blog/, blog/[slug]/         # si module actif
│  │  │  │  └─ legal/[slug]/               # mentions, confidentialité, CGV, cookies
│  │  │  ├─ (auth)/
│  │  │  │  ├─ login/, forgot-password/, reset-password/
│  │  │  │  ├─ invitation/[token]/, two-factor/
│  │  │  ├─ portal/                        # espace client
│  │  │  │  ├─ page.tsx                    # dashboard
│  │  │  │  ├─ projects/, quotes/, invoices/, documents/
│  │  │  │  ├─ messages/, reservations/, orders/
│  │  │  │  └─ profile/, settings/
│  │  │  └─ admin/
│  │  │     ├─ page.tsx                    # dashboard
│  │  │     ├─ crm/ (pipeline), leads/, clients/, requests/
│  │  │     ├─ services/, quotes/, projects/, tasks/
│  │  │     ├─ invoices/, payments/, subscriptions/
│  │  │     ├─ reservations/, transactions/, products/
│  │  │     ├─ files/, messages/, team/
│  │  │     ├─ content/ (pages, portfolio, testimonials, blog, key-figures)
│  │  │     ├─ seo/, settings/, audit/
│  │  ├─ api/
│  │  │  ├─ auth/[...all]/route.ts         # Better Auth
│  │  │  ├─ v1/                            # REST : leads, clients, services, quotes, projects,
│  │  │  │                                 # invoices, payments, reservations, transactions, messages, files
│  │  │  ├─ files/[id]/route.ts            # téléchargement contrôlé (URL signée courte)
│  │  │  ├─ cron/[job]/route.ts            # protégé par CRON_SECRET
│  │  │  └─ health/route.ts
│  │  ├─ sitemap.ts, robots.ts, manifest.ts
│  │  └─ global-error.tsx
│  ├─ components/
│  │  ├─ ui/          # design system : Button, Input, Select, Checkbox, Card, Badge, Table,
│  │  │               # Dialog, Drawer, Toast, Tabs, Tooltip, Skeleton, EmptyState, Alert…
│  │  ├─ layout/      # Header, Footer, LocaleSwitcher, AdminShell, PortalShell, Sidebar, CommandPalette
│  │  ├─ marketing/   # Hero, ServiceGrid, WhyUs, KeyFigures, Process, Testimonials, CaseStudy, FinalCta
│  │  ├─ forms/       # Stepper, DynamicForm (questionnaires), FileUpload, PhoneInput, MoneyInput
│  │  ├─ data/        # DataTable, Filters, Pagination, Kanban, Calendar, Charts, Timeline
│  │  └─ domain/      # crm/, quotes/, projects/, billing/, bookings/, transactions/, messaging/, portal/
│  ├─ server/
│  │  ├─ core/
│  │  │  ├─ db.ts, env.ts (variables validées par Zod au démarrage), logger.ts
│  │  │  ├─ auth/, authz/ (permissions, périmètres, policies)
│  │  │  ├─ action.ts, route.ts            # enveloppeurs communs (auth → authz → Zod → exécution → audit)
│  │  │  ├─ errors.ts, result.ts
│  │  │  ├─ audit/, events/ (outbox), jobs/
│  │  │  ├─ rate-limit/, storage/, email/, pdf/, crypto/
│  │  │  └─ numbering/, money/, cache-tags.ts
│  │  └─ modules/
│  │     ├─ identity/, crm/, catalog/, quotes/, projects/, billing/, subscriptions/
│  │     ├─ bookings/, transactions/, messaging/, notifications/, files/
│  │     └─ cms/, seo/, settings/, search/, reporting/, audit/
│  │        # chaque module : x.schemas.ts, x.service.ts, x.repository.ts, x.policy.ts, x.events.ts, x.test.ts
│  ├─ i18n/           # routing.ts, request.ts, navigation.ts, formats.ts
│  ├─ emails/         # gabarits React Email (multilingues, RTL)
│  ├─ documents/      # gabarits HTML des PDF (devis, facture, avoir, confirmation)
│  ├─ lib/            # utilitaires sans secret, utilisables côté client (dates, formats, bidi, cn)
│  ├─ hooks/
│  ├─ styles/globals.css   # jetons du design system (@theme)
│  └─ proxy.ts             # middleware Next.js : langue, en-têtes, redirections
├─ messages/
│  ├─ fr/ common.json, public.json, auth.json, portal.json, admin.json, emails.json, documents.json, validation.json
│  ├─ en/ …
│  └─ ar/ …
├─ prisma/
│  ├─ schema.prisma        # découpé par domaine si la version de Prisma le permet
│  ├─ migrations/
│  └─ seed/ base.ts, dev.ts
├─ public/ images/, logos/, icons/
├─ scripts/ create-admin.ts, check-i18n.ts (clés manquantes), check-rtl.ts (classes physiques interdites), backup.sh
├─ tests/ unit/, integration/, e2e/, fixtures/
├─ docs/ architecture.md, database.md, security.md, deployment.md, i18n.md, adr/ (décisions)
├─ docker/ docker-compose.yml       # PostgreSQL, MinIO, Mailpit (+ ClamAV optionnel) pour le développement
├─ .github/workflows/ci.yml
├─ .env.example
└─ README.md
```

---

## D. Flux utilisateurs

### D.1 Profils

| Profil | Compte | Ce qu'il voit |
|---|---|---|
| Visiteur | Aucun | Site public, formulaire de demande, réservation |
| Prospect | Aucun au départ, invité à l'envoi du premier devis | Emails de confirmation, puis portail limité à ses devis |
| Client | Oui (invitation) | Portail : ses projets, devis, factures, documents, messages, réservations, commandes |
| Staff | Oui (invitation, 2FA) | Admin limité à ses projets, ses tâches, les clients autorisés |
| Admin | Oui (invitation ou script, 2FA obligatoire) | Tout |

### D.2 Visiteur : demande de devis (services `QUOTE` et `RECURRING`)

```
Accueil / page service ──▶ « Démarrer un projet » (service pré-sélectionné si on vient d'une page service)
  1. Type de service
  2. Questions propres au service (questionnaire administrable, version figée)
  3. Budget (tranches configurables, ou « je ne sais pas »)
  4. Délai souhaité
  5. Coordonnées (nom, prénom, email, téléphone, entreprise, pays, ville)
  6. Message + fichiers (types et tailles limités)
  ▶ Résumé ──▶ « Envoyer ma demande »
```

Chaque étape est validée côté client pour le confort, puis **l'ensemble est revalidé côté serveur**. La progression est conservée dans le navigateur pour ne rien perdre en cas de rechargement.

À l'envoi, une seule transaction serveur :

1. contrôles anti-spam (piège à robots, temps minimal de saisie, limitation par IP et par email, captcha si activé) ;
2. recherche d'un Lead ou d'un Client existant par email puis téléphone ; sinon création du **Lead** (coordonnées, langue, source, UTM, consentement) ;
3. création de l'**Opportunité** : numéro `SC-2026-00001`, service, réponses, budget, délai, message, étape « Nouveau lead », responsable attribué selon la règle configurée ;
4. rattachement des fichiers (sortis de quarantaine après vérification) ;
5. création d'une **Activité** « Demande reçue depuis le site » ;
6. événement `opportunity.created` : notification aux admins (application + email) et email de confirmation au prospect, **dans sa langue**, avec le numéro de demande.

L'écran de confirmation affiche le numéro et les prochaines étapes. Rien n'est simulé : si l'enregistrement échoue, l'utilisateur voit une erreur compréhensible et ses données restent dans le formulaire.

### D.3 Prospect : du devis à l'acceptation

```
Admin envoie le devis ──▶ email « Votre devis est disponible » + invitation au portail (si pas de compte)
  ──▶ le prospect choisit un mot de passe ou se connecte par lien magique
  ──▶ portail : consulte le devis (statut « consulté », date enregistrée)
        ├─ Télécharger le PDF
        ├─ Accepter  ─▶ saisie du nom + case « J'accepte les conditions » ─▶ confirmation
        ├─ Refuser   ─▶ motif facultatif
        └─ Demander une modification ─▶ commentaire, l'admin prépare une nouvelle version
```

### D.4 Client : portail

- **Tableau de bord** : message de bienvenue, projets actifs avec progression, derniers documents, devis en attente de réponse, factures à régler, messages non lus, notifications.
- **Mes projets** : jalons, avancement, tâches marquées visibles, livrables, messagerie du projet.
- **Mes devis / Mes factures** : liste, détail, PDF, statut de paiement.
- **Documents** : tous les fichiers visibles par le client, classés par projet.
- **Messages** : conversations par projet, pièces jointes, lu / non lu.
- **Réservations / Commandes** : si le client utilise ces services.
- **Profil / Paramètres** : coordonnées, langue préférée, mot de passe, 2FA facultative, préférences de notification.

Un client lié à plusieurs contacts (société) : chaque contact avec un accès portail voit les données **de son client uniquement**.

### D.5 Réservation (service `BOOKING`)

**Mode créneau à l'agence** (`AGENCY_SLOT`) :
```
Service ─▶ calendrier des créneaux libres (règles + exceptions − réservations existantes)
  ─▶ informations demandées (formulaire du service) + documents éventuels
  ─▶ envoi : réservation « Demandée », créneau bloqué, numéro RDV-…, emails
  ─▶ staff confirme ─▶ « Confirmée » + email ─▶ rappel automatique la veille
  ─▶ « Terminée » ou « Annulée » (motif)
```

**Mode démarche externe** (`EXTERNAL_APPOINTMENT`, ex. rendez-vous visa ou TCF) :
```
Service ─▶ période souhaitée + informations nécessaires ─▶ « Demandée »
  ─▶ staff prend en charge ─▶ « En attente » (démarche en cours)
  ─▶ rendez-vous obtenu : date, lieu, référence saisis ─▶ « Confirmée » + email au client
  ─▶ « Terminée » ou « Annulée »
```

Des frais de service peuvent être facturés via une facture classique.

### D.6 Transaction (service `TRANSACTION`)

```
Client (ou staff au comptoir) ─▶ produit + quantité + informations requises
  ─▶ « Demandée » ─▶ staff vérifie disponibilité et fixe le prix définitif ─▶ « Prix confirmé »
  ─▶ client accepte ─▶ « En attente de paiement » ─▶ paiement enregistré ─▶ « Payée »
  ─▶ remise effectuée, sortie de stock ─▶ « Terminée »      (ou « Annulée » à toute étape avant remise)
```

Tant que le cadre légal n'est pas validé, ce module sert **uniquement au suivi interne** : aucune page publique, aucun taux affiché.

### D.7 Service récurrent (`RECURRING`)

```
Demande ou proposition ─▶ devis (formule + personnalisation) ─▶ acceptation
  ─▶ création d'un Contrat (Subscription) + projet de production associé si utile
  ─▶ à chaque échéance : brouillon de facture généré automatiquement, émis par un admin
  ─▶ pause, reprise ou résiliation depuis l'admin
```

### D.8 Staff et admin

- **Staff** : se connecte (2FA), voit « Mes tâches », « Mes projets », les messages de ses projets, les clients de ses projets. Il n'a accès à la facturation et aux statistiques financières que si un admin lui donne ces permissions.
- **Admin** : dashboard global, pipeline, catalogue, devis, facturation, paramètres, équipe et rôles, contenus, SEO, journal d'audit.

### D.9 Authentification

| Parcours | Règles |
|---|---|
| Connexion | Email + mot de passe ; lien magique possible pour les clients ; blocage progressif après échecs répétés (par compte et par IP) |
| 2FA | TOTP, obligatoire pour admin et staff, codes de secours |
| Invitation | Lien à usage unique, expiration 7 jours (configurable), choix du mot de passe |
| Mot de passe oublié | Réponse identique que le compte existe ou non ; lien valable 1 heure ; toutes les sessions fermées après changement |
| Sessions | En base, révocables depuis le profil (« déconnecter mes autres appareils ») et par un admin |

---

## E. Flux CRM

### E.1 Modèle : Lead, Opportunité, Client

- Le **Lead** représente *qui* nous contacte. Il existe dès le premier contact.
- L'**Opportunité** représente *une affaire*. Un même lead peut en avoir plusieurs (un site web aujourd'hui, une campagne publicitaire dans six mois). C'est elle qui avance dans le Kanban et qui porte le numéro de demande.
- Le **Client** est le compte facturable. Le lead est **converti** en client au moment où un devis doit lui être adressé (ou manuellement). La conversion réutilise un client existant si l'email correspond, rattache toutes les opportunités, activités et fichiers, et ne demande **aucune ressaisie**.

La « fiche prospect » du cahier des charges est la fiche du Lead tant qu'il n'est pas converti, puis la fiche du Client, avec le même contenu : identité, entreprise, coordonnées, pays, source, service, budget, délai, notes, activités, devis, projets, factures, fichiers, historique.

### E.2 Entrées dans le CRM

| Source | Création |
|---|---|
| Formulaire de demande de devis | Automatique (D.2) |
| Formulaire de contact | Lead + activité ; opportunité si un service est choisi |
| Réservation ou commande d'un visiteur | Lead + réservation ou commande (pas d'opportunité) |
| WhatsApp, téléphone, visite, réseaux sociaux, recommandation | Saisie manuelle rapide par le staff (formulaire court), source renseignée |

**Dédoublonnage** : à la création, recherche par email puis par téléphone normalisé. En cas de correspondance, l'opportunité est rattachée au lead ou client existant et l'admin est averti.

**Attribution** : responsable par défaut configurable (un admin, un responsable par catégorie de service, ou tour de rôle).

### E.3 Pipeline

| Étape | Type | Passage automatique | Passage manuel |
|---|---|---|---|
| Nouveau lead | OPEN | Création depuis le site | Oui |
| Contacté | OPEN | Première activité appel / email / WhatsApp enregistrée | Oui |
| Qualifié | OPEN | — | Oui (budget, besoin et décideur confirmés) |
| Devis préparé | OPEN | Création d'un devis brouillon lié | Oui |
| Devis envoyé | OPEN | Envoi du devis | Oui |
| Négociation | OPEN | Demande de modification par le client | Oui |
| Accepté | WON | Acceptation du devis | Oui |
| Client actif | WON | Démarrage du projet | Oui |
| Terminé | WON | Projet terminé | Oui |
| Perdu | LOST | Devis refusé ou expiré sans autre devis ouvert | Oui, motif obligatoire |

- **Glisser-déposer** accessible au clavier (dnd-kit), ordre des cartes conservé.
- **Retour en arrière** autorisé ; chaque changement, automatique ou manuel, est inscrit dans `OpportunityStageChange` et dans la chronologie.
- **Automatismes non destructifs** : un automatisme ne fait jamais reculer une opportunité ; il n'avance que si l'étape actuelle est antérieure.
- **Filtres du Kanban** : responsable, service, source, période, montant estimé. Une vue liste équivalente existe pour le mobile et l'export.

### E.4 Activités, tâches et relances

- **Chronologie unifiée** sur chaque fiche : notes, appels, emails, rendez-vous, changements d'étape, événements système (devis envoyé, consulté, accepté, facture émise, paiement reçu).
- **Tâches** avec échéance et responsable (« Rappeler lundi », « Envoyer la maquette ») ; les tâches en retard remontent dans le dashboard et dans les notifications du responsable.
- **Relances suggérées** : un devis envoyé non consulté après N jours (paramétrable) crée une tâche de relance pour le responsable.

### E.5 Dashboard CRM

Nouveaux prospects, prospects qualifiés, devis envoyés, devis acceptés, projets actifs, chiffre d'affaires (visible selon permission), tâches en retard, et taux de conversion par étape et par source. Définitions précises en I.3.

---

## F. Flux devis → projet → facture

### F.1 Cycle de vie du devis

```
            ┌──────────────── nouvelle version (modification demandée) ◀─────┐
            ▼                                                                 │
BROUILLON ──envoyer──▶ ENVOYÉ ──ouvert par le client──▶ CONSULTÉ ─┬─▶ ACCEPTÉ
    │                     │                                 │      ├─▶ REFUSÉ
  supprimer               └───── date de validité passée ───┴──────┼─▶ EXPIRÉ
                                                                   └─▶ MODIFICATION DEMANDÉE ─┘
Tout devis non accepté peut être ANNULÉ par un admin.
```

- **Prix libres** : chaque ligne a son prix, sa quantité, sa remise ; le prix indicatif du catalogue n'est qu'une suggestion pré-remplie.
- **Envoi** : le serveur recalcule tous les totaux, fige une `QuoteVersion` (instantané + PDF + empreinte SHA-256), passe le devis en « Envoyé », crée l'activité, fait avancer l'opportunité et envoie l'email.
- **Consultation** : la première ouverture par le client connecté enregistre `firstViewedAt` et notifie le responsable.
- **Expiration** : le cron passe en « Expiré » les devis dont la date de validité est dépassée ; un admin peut prolonger en envoyant une nouvelle version.

### F.2 Acceptation (juridiquement simple, extensible)

Le client clique sur « Accepter », saisit son nom complet et coche « J'ai lu et j'accepte ce devis et ses conditions ». Le serveur enregistre dans `QuoteDecision` : version acceptée et son empreinte, utilisateur, nom saisi, email, date et heure (UTC), adresse IP et navigateur (la conservation de l'IP est un paramètre, à confirmer avec le conseil juridique), méthode `CLICK`.

L'empreinte prouve que le document accepté est exactement celui qui a été envoyé. Une vraie signature électronique s'ajoutera plus tard comme une nouvelle `method` via `SignatureProvider`, sans changer le reste du flux.

### F.3 Ce qui se passe à l'acceptation (une seule transaction)

1. devis → « Accepté », décision enregistrée ;
2. client → « Actif » (s'il était prospect) ;
3. **création du projet** : nom et description repris du devis, budget = total du devis, client, responsable = responsable de l'opportunité, jalons créés à partir de l'échéancier si celui-ci en contient ;
4. opportunité → « Accepté » ;
5. si le devis prévoit un acompte et que le paramètre est activé : **brouillon de facture d'acompte** (jamais émise automatiquement : un admin la vérifie et l'émet) ;
6. pour un service récurrent : création du contrat (`Subscription`) ;
7. activité, journal d'audit, événements : notification aux admins et au responsable, email de confirmation au client.

Si une étape échoue, rien n'est enregistré : le client voit une erreur et peut réessayer.

### F.4 Projet

```
PLANIFICATION ─▶ EN COURS ⇄ EN ATTENTE CLIENT
                     │   ⇄ RÉVISION
                     ▼
                  TERMINÉ ─▶ ARCHIVÉ
```

- **Progression** : calculée automatiquement à partir des tâches terminées ou des jalons pondérés, ou saisie manuellement (choix par projet).
- **Visibilité client** : le client voit les jalons, la progression, les tâches marquées visibles, les livrables et la messagerie ; il ne voit jamais les notes internes ni les tâches internes.
- **Changement de statut** : notifie le client (« changement projet ») ; « En attente client » peut préciser ce qui est attendu.
- **Fin de projet** : opportunité → « Terminé », email « Projet terminé », tâche facultative « demander un témoignage ».

### F.5 Facturation

```
BROUILLON ──émettre──▶ ÉMISE ──paiement partiel──▶ PARTIELLEMENT PAYÉE ──solde──▶ PAYÉE
    │                    │                               │
 supprimer               └──── échéance dépassée ────────┴──▶ EN RETARD ──paiement──▶ …
                         ÉMISE / EN RETARD ──annuler (motif, avoir recommandé)──▶ ANNULÉE
```

- **Sources d'une facture** : échéance d'un devis (acompte, jalon, solde), contrat récurrent, ou saisie libre.
- **Émission** : attribution du numéro dans la même transaction (séquence verrouillée, sans trou), figement de l'instantané (identités légales de l'agence et du client, lignes, taux, mentions), génération du PDF, empreinte, email au client.
- **Après émission** : aucune modification possible. Une erreur se corrige par un **avoir** (facture de type `CREDIT_NOTE` liée à l'originale) puis une nouvelle facture. Les règles exactes (annulation, avoir, mentions) sont à valider avec le comptable.
- **Retard** : le cron passe en « En retard » les factures dont l'échéance est dépassée et le solde non nul, et notifie l'admin. Relances client configurables (désactivées par défaut).
- **Solde du devis** : l'écran du projet affiche « Devisé / Facturé / Encaissé / Reste à facturer ».

### F.6 Paiements

Saisie manuelle en V1 : montant, date, moyen de paiement, référence, note, utilisateur qui enregistre. Le serveur refuse un montant supérieur au solde (sauf trop-perçu explicitement autorisé), recalcule `amountPaid`, `balanceDue` et le statut, crée l'activité, journalise, puis notifie le client (« paiement enregistré ») et les admins (« nouveau paiement »). Un paiement erroné est **annulé** (motif obligatoire), jamais supprimé.

### F.7 Règles de calcul

- Ligne : `quantité × prix unitaire − remise de ligne`, arrondie à l'unité mineure.
- Remise globale : répartie au prorata sur les lignes avant taxe.
- Taxe : calculée par ligne sur la base remisée, puis sommée.
- Arrondi : demi supérieur par défaut. **La méthode d'arrondi et le calcul des taxes sont des paramètres à valider avec le comptable.**
- Devises : un document a une seule devise ; aucune conversion automatique. Les indicateurs financiers sont présentés **par devise**.

Ces calculs sont centralisés dans `server/core/money` et couverts par des tests unitaires ; le navigateur affiche des totaux indicatifs, mais seuls ceux du serveur sont enregistrés.

---

## G. Architecture multilingue FR/EN/AR et RTL

### G.1 Routage

- Préfixe obligatoire : `/fr/…`, `/en/…`, `/ar/…`. Français par défaut.
- `/` redirige selon le cookie de langue, puis l'en-tête `Accept-Language`, puis le français.
- Segments statiques identiques dans les trois langues (`/fr/services`, `/ar/services`), comme dans les exemples du cahier des charges ; seuls les **slugs de contenu** sont traduits (`/fr/services/developpement-web`, `/en/services/web-development`).
- Le sélecteur de langue conduit à la **page équivalente** dans l'autre langue (même contenu, slug traduit), ou à la page parente si la traduction n'existe pas.

### G.2 Textes de l'interface

- Fichiers `messages/{fr,en,ar}/*.json` par espace de noms (public, admin, portail, emails, documents, validation) : une page ne charge que ce dont elle a besoin.
- Format ICU (pluriels, genres, variables). L'arabe a six formes de pluriel ; ICU les gère.
- **Clés typées** : TypeScript signale toute clé inexistante. Un script de CI (`check-i18n`) échoue si une clé du français manque en anglais ou en arabe.
- Aucun texte visible écrit en dur dans un composant (règle ESLint dédiée sur les chaînes JSX).
- Les messages d'erreur Zod sont des clés de traduction, affichées dans la langue de l'utilisateur.

### G.3 Contenus administrables

- Traductions en base (tables `…Translation`, `Setting` au format `{fr, en, ar}`).
- L'éditeur de l'admin présente des onglets FR / EN / AR avec un indicateur de complétude, et un aperçu en RTL pour l'arabe.
- Une traduction a son propre statut de publication. Non publiée : la page n'existe pas dans cette langue (404), n'apparaît ni dans le sitemap ni dans les `hreflang`.

### G.4 SEO multilingue

- `hreflang` pour chaque langue publiée + `x-default` vers le français ; `canonical` sur l'URL de la langue courante.
- Sitemap unique généré depuis la base, avec les alternatives de langue de chaque URL.
- Métadonnées, Open Graph et données structurées dans la langue de la page (`inLanguage`).
- Changement de slug : redirection 301 automatique.

### G.5 Formats

- Dates, nombres, devises via `Intl` ; locales `fr-DZ`, `en`, `ar` avec chiffres latins (réglage modifiable).
- Fuseau de l'agence pour tout affichage de date et pour les créneaux ; stockage en UTC.
- Téléphones validés et stockés au format international (libphonenumber), pays par défaut configurable.

### G.6 RTL

| Point | Règle |
|---|---|
| Document | `<html lang="ar" dir="rtl">` ; `lang="fr"` / `"en"` et `dir="ltr"` sinon, décidé côté serveur (pas de bascule visible au chargement) |
| Espacements et positions | Uniquement des utilitaires logiques : `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `border-s`, `rounded-s`… Le script `check-rtl` fait échouer la CI sur `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right` (exceptions justifiées en commentaire) |
| CSS personnalisé | `margin-inline`, `padding-inline`, `inset-inline`, `border-inline-start`… |
| Icônes | Les icônes directionnelles (flèches, chevrons, « retour ») sont inversées via `rtl:-scale-x-100` ; les logos, médias, horloges et coches ne le sont pas |
| Animations | Les translations horizontales utilisent le sens de lecture (`--dir: 1 / -1`) |
| Composants Radix | `DirectionProvider` : menus, sous-menus, onglets, curseurs suivent le sens |
| Contenus mixtes | Numéros (SC-2026-00001), emails, téléphones, URLs et montants isolés avec `<bdi>` ou `dir="ltr"` pour qu'ils ne soient pas retournés dans une phrase arabe |
| Champs de saisie | Email, téléphone, URL, IBAN : `dir="ltr"` quelle que soit la langue |
| Tableaux et Kanban | Colonnes en ordre inversé naturellement (grille logique) ; le Kanban se lit de droite à gauche |
| Graphiques | Axe du temps conservé de gauche à droite, choix courant pour les données chronologiques ; légendes et libellés en arabe |
| Tests | Captures Playwright de chaque page clé en `ar` à plusieurs largeurs, comparées d'une version à l'autre |

### G.7 Typographie

- Latin : une police de titres affirmée et une police de texte très lisible (proposition en annexe 1).
- Arabe : **IBM Plex Sans Arabic** (texte et titres), alternative Cairo ou Tajawal selon la validation visuelle.
- Chargement via `next/font`, auto-hébergé, sous-ensembles : la police arabe n'est chargée que sur les pages `/ar`.
- Arabe : interlignage plus grand, pas de majuscules forcées, pas d'espacement de lettres, pas d'italique.

### G.8 Emails et PDF

- Emails : un gabarit par type, rendu dans la **langue du destinataire** (`User.locale`, sinon `Lead.locale`, sinon langue par défaut), avec `dir` adapté. Les notifications internes utilisent la langue de chaque membre du staff.
- PDF : langue du document choisie sur le devis ou la facture (par défaut celle du client) ; rendu Chromium, donc RTL et liaison des lettres corrects.

### G.9 Qualité des traductions

Le français est la langue source. L'anglais et l'arabe sont **rédigés** dans un registre commercial naturel, pas traduits mot à mot. Les contenus arabes livrés sont marqués « à relire » dans l'admin jusqu'à validation par un arabophone natif.

---

## H. Architecture de sécurité

### H.1 Principe

La sécurité se joue **côté serveur, à chaque requête**. Le masquage d'un bouton ou d'un menu n'est qu'un confort : toute action et toute lecture passent par l'enveloppeur serveur qui authentifie, autorise, valide et journalise.

### H.2 Couches de défense

| Couche | Mesures |
|---|---|
| Transport et en-têtes | HTTPS uniquement, HSTS, Content-Security-Policy avec nonce, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive |
| Authentification | Better Auth ; argon2id ; mots de passe de 12 caractères minimum, vérification facultative contre les mots de passe connus comme compromis ; 2FA obligatoire admin et staff ; sessions en base, cookies `HttpOnly`, `Secure`, `SameSite=Lax`, préfixe `__Host-` ; rotation de session à la connexion ; expiration d'inactivité configurable |
| Force brute | Limitation par IP et par compte sur connexion, 2FA, mot de passe oublié, formulaires publics ; blocage progressif ; événements journalisés |
| Autorisation | Permissions + périmètres (H.3) vérifiés dans chaque service ; requêtes filtrées par périmètre au niveau du repository |
| Propriété des ressources | Aucune lecture par simple identifiant : chaque requête inclut le filtre de périmètre (ex. `clientId IN (clients de l'utilisateur)`). Une ressource hors périmètre renvoie 404, jamais 403, pour ne pas révéler son existence |
| Validation | Zod sur toutes les entrées serveur (actions, routes, paramètres d'URL, JSON des questionnaires) ; listes blanches des champs modifiables (pas d'affectation de masse) |
| CSRF | Server Actions : contrôle d'origine natif de Next.js. Routes API avec cookie : contrôle `Origin` / `Host` + `SameSite`. Routes API par jeton (mobile) : pas de cookie |
| XSS | Échappement React ; pas de HTML libre en base : le texte riche est stocké en JSON structuré (éditeur TipTap) et rendu avec une liste blanche ; les messages sont en texte brut ; CSP en dernier rempart |
| Injection SQL | Prisma paramétré ; SQL brut uniquement via requêtes paramétrées, relu |
| Fichiers | Voir H.4 |
| Secrets | Variables d'environnement uniquement, validées au démarrage (l'application refuse de démarrer si une variable obligatoire manque) ; `.env*` ignorés par git ; analyse des secrets en CI |
| Données sensibles | Chiffrement applicatif AES-256-GCM des champs sensibles (numéros de passeport, pièces d'identité, données d'identification des transactions), clé dans l'environnement, rotation prévue ; masquage dans les journaux ; purge après la durée de conservation |
| Dépendances | Fichier de verrouillage, mises à jour automatiques (Renovate ou Dependabot), audit en CI |
| Erreurs | Messages génériques à l'utilisateur ; détail et identifiant de requête dans les journaux serveur uniquement |

### H.3 RBAC et périmètres

Les permissions sont des clés `ressource.action`, attribuées à des rôles avec un **périmètre** :

- `ALL` : toutes les données ;
- `ASSIGNED` : données liées à l'utilisateur (projets dont il est membre, clients de ces projets, opportunités et tâches dont il est responsable) ;
- `OWN` : données du client auquel l'utilisateur est rattaché.

| Domaine | Admin | Staff (défaut) | Client |
|---|---|---|---|
| Leads, opportunités, pipeline | ALL | ASSIGNED (lecture, activités, tâches) | — |
| Clients | ALL | ASSIGNED (lecture) | OWN (son profil) |
| Catalogue, CMS, SEO, portfolio, témoignages, blog | ALL | — (activable) | — |
| Devis | ALL (créer, envoyer, annuler) | — (activable : préparer) | OWN (lire, accepter, refuser, demander une modification) |
| Projets, jalons, tâches | ALL | ASSIGNED | OWN (lecture de ce qui est visible) |
| Fichiers | ALL | ASSIGNED | OWN (fichiers visibles client + ses envois) |
| Messages | ALL | ASSIGNED | OWN |
| Factures, paiements, contrats | ALL | — (activable) | OWN (lecture) |
| Statistiques financières | ALL | — (activable) | — |
| Réservations, transactions | ALL | ASSIGNED ou ALL selon réglage | OWN |
| Équipe, rôles, paramètres, audit | ALL | — | — |

Des rôles personnalisés (ex. « comptable » : factures, paiements, statistiques financières) se créent depuis l'admin sans code. Les changements de permissions sont journalisés et invalident les sessions concernées.

### H.4 Fichiers

1. Le navigateur demande l'autorisation d'envoi : le serveur vérifie permission, type déclaré (liste blanche par usage), taille et quotas, puis délivre une URL d'envoi signée valable quelques minutes vers un dossier de **quarantaine**.
2. Après l'envoi, le serveur lit les premiers octets pour détecter le **type réel**, vérifie la taille, calcule l'empreinte, lance l'antivirus s'il est configuré, puis déplace le fichier vers son emplacement définitif. Un fichier non conforme est rejeté et supprimé.
3. Nom stocké : identifiant aléatoire ; le nom d'origine est conservé en base, nettoyé, pour l'affichage uniquement.
4. Téléchargement : route serveur qui vérifie la permission, puis redirige vers une URL signée de courte durée avec `Content-Disposition: attachment` pour tout ce qui n'est pas une image.
5. Limites par défaut (modifiables) : 10 Mo par fichier sur le formulaire public (5 fichiers maximum), 50 Mo dans l'espace client et l'admin. Types : PDF, images (JPEG, PNG, WebP ; SVG uniquement pour les admins, nettoyé), documents bureautiques, ZIP pour le staff. Exécutables refusés.
6. Médias publics (logo, portfolio, blog) : dossier public optimisé par `next/image`.

### H.5 Journal d'audit

Sont journalisés : connexion réussie ou échouée, déconnexion, 2FA activée ou désactivée, changement de mot de passe, création, modification (avec différences), suppression, changement de statut, envoi et acceptation de devis, émission, modification ou annulation de facture, paiement ajouté ou annulé, changement de rôle ou de permission, modification des paramètres, exports de données.

Affichage dans l'admin : « Admin Chakib · a modifié le devis DEV-2026-0012 · 23/09/2026 10:32 », filtrable par personne, entité, action et période. Le journal est en ajout seul ; sa durée de conservation est configurable.

### H.6 Sauvegardes

- Base : sauvegardes automatiques du fournisseur (restauration à un instant donné avec Neon) **et** export quotidien chiffré (`pg_dump`) vers un stockage distinct, conservé 30 jours, 12 mensuels.
- Fichiers : versionnage activé sur le bucket, réplication vers un second stockage si l'hébergement le permet.
- Test de restauration mensuel documenté dans `docs/deployment.md`.
- Objectif par défaut : perte de données maximale de 24 h (quelques minutes avec la restauration à un instant donné).

### H.7 Données personnelles

- Consentement enregistré (date, version de la politique) sur les formulaires publics.
- Export et suppression des données d'une personne sur demande, depuis l'admin, en respectant les obligations de conservation comptable.
- Durées de conservation configurables par type de donnée.
- Le cadre applicable (par exemple la loi algérienne 18-07 sur la protection des données personnelles si l'agence est en Algérie, le RGPD pour les clients dans l'UE) est **à valider juridiquement** ; l'architecture ne prétend à aucune conformité.

---

## I. Architecture du dashboard

### I.1 Coquille de l'administration

```
┌────────────┬──────────────────────────────────────────────────────────────┐
│ Logo       │  Recherche globale (Ctrl/Cmd + K)    🔔 Notifications  FR ▾  Profil │
│            ├──────────────────────────────────────────────────────────────┤
│ Pilotage   │                                                              │
│  Dashboard │   Fil d'Ariane                                                │
│ Commercial │   Titre de page                       [Actions principales]  │
│  Pipeline  │                                                              │
│  Demandes  │   Contenu : KPI, tableaux, Kanban, fiche, calendrier…        │
│  Prospects │                                                              │
│  Clients   │                                                              │
│  Devis     │                                                              │
│ Production │                                                              │
│  Projets   │                                                              │
│  Tâches    │                                                              │
│  Messages  │                                                              │
│  Fichiers  │                                                              │
│ Finance    │                                                              │
│  Factures  │                                                              │
│  Paiements │                                                              │
│  Contrats  │                                                              │
│ Opérations │                                                              │
│  Réservat. │                                                              │
│  Transact. │                                                              │
│ Contenu    │                                                              │
│  Services, Portfolio, Témoignages, Blog, Pages, SEO                       │
│ Système    │                                                              │
│  Équipe, Paramètres, Journal d'audit                                      │
└────────────┴──────────────────────────────────────────────────────────────┘
```

- La navigation est construite côté serveur selon les permissions : un staff sans accès finance ne voit pas le groupe Finance (et le serveur refuserait de toute façon).
- Barre latérale repliable ; en RTL, elle passe à droite automatiquement.
- **Tablette** : barre latérale en icônes. **Mobile** : menu en tiroir, tableaux transformés en listes de cartes, actions principales dans une barre inférieure.

### I.2 Dashboard admin

| Zone | Contenu |
|---|---|
| Sélecteur | Période (mois en cours, 30 jours, trimestre, année, personnalisée), devise |
| KPI | Prospects (total période), nouveaux prospects, clients actifs, projets actifs, devis envoyés, devis acceptés, CA facturé, CA encaissé, factures en retard (nombre et montant) |
| Graphiques | Prospects par mois, CA facturé et encaissé par mois, entonnoir de conversion des devis, projets par statut |
| Activité récente | Nouveau prospect, devis accepté, paiement, message, projet terminé ; chaque ligne mène à la fiche |
| À traiter | Mes tâches en retard, devis sans réponse, réservations à confirmer, factures en retard |

Chaque widget déclare la permission qu'il exige. Un staff voit un dashboard opérationnel (tâches, projets, messages, réservations) sans chiffres financiers.

### I.3 Définitions des indicateurs

Définitions précises pour que les chiffres soient justes et vérifiables :

- **Nouveaux prospects** : leads créés dans la période.
- **Clients actifs** : clients avec au moins un projet en cours, un contrat actif ou une facture émise dans les 12 derniers mois.
- **Devis envoyés / acceptés** : devis dont la première date d'envoi ou d'acceptation tombe dans la période.
- **Taux de conversion des devis** : acceptés ÷ (acceptés + refusés + expirés) sur les devis décidés dans la période.
- **CA facturé** : total des factures émises dans la période (hors brouillons et annulées, avoirs déduits), par devise, hors taxes et toutes taxes comprises.
- **CA encaissé** : paiements non annulés dont la date tombe dans la période, par devise.
- **Factures en retard** : factures émises, échéance dépassée, solde non nul.

Les volumes de transactions (change, cartes) ont leurs propres indicateurs dans leur module et **ne sont pas additionnés au chiffre d'affaires** des prestations.

### I.4 Données et performance

- Requêtes d'agrégation SQL dédiées dans le module `reporting`, avec index adaptés.
- Cache court (60 secondes) par utilisateur et période ; invalidé par les événements financiers.
- Composants de graphiques chargés uniquement dans l'admin (import dynamique) : aucun impact sur le site public.

### I.5 Modèles d'écrans réutilisables

| Modèle | Utilisation | Détails |
|---|---|---|
| Tableau de données | Toutes les listes | Pagination, tri et filtres côté serveur, état dans l'URL (partageable), colonnes masquables, sélection multiple et actions groupées, export CSV selon permission, états vide / chargement / erreur |
| Fiche | Lead, client, projet, devis, facture | En-tête avec statut et actions, onglets, chronologie à droite (ou en bas sur mobile) |
| Kanban | Pipeline, tâches de projet | Glisser-déposer accessible au clavier, mises à jour optimistes annulées en cas de refus serveur |
| Calendrier | Réservations, échéances | Vues jour, semaine, mois, liste ; création et déplacement selon permission |
| Éditeur de contenu | Services, pages, portfolio, blog | Onglets de langue, complétude, aperçu, brouillon et publication, champs SEO avec aperçu du résultat Google |
| Éditeur de document | Devis, facture | Lignes éditables, totaux recalculés, aperçu PDF |

### I.6 Recherche globale

Palette de commandes (Ctrl/Cmd + K) : recherche instantanée dans clients, prospects, opportunités, projets, devis, factures et services (numéro, nom, email, entreprise), résultats groupés par type, **filtrés par les permissions de l'utilisateur**. Elle propose aussi des actions rapides (« Nouveau devis », « Nouveau prospect »).

### I.7 Notifications

Cloche avec compteur de non lus, liste des notifications récentes, « tout marquer comme lu », lien vers l'élément concerné, réglage des préférences par type et par canal.

### I.8 Portail client

Coquille plus simple, même design system : navigation Dashboard, Mes projets, Mes devis, Mes factures, Documents, Messages, Profil, Paramètres (plus Réservations et Commandes si le client en a). Dashboard décrit en D.4. Conçu d'abord pour le mobile, car beaucoup de clients le consulteront depuis leur téléphone.

---

## J. Roadmap de développement

Les 16 étapes du §47 sont regroupées en phases livrables, avec deux ajustements d'ordre justifiés :

- **L'authentification et une administration minimale passent avant le site public.** Le site lit ses contenus (services, paramètres, textes) en base dès le départ ; il faut donc pouvoir les modifier depuis l'admin avant la mise en ligne, sinon on reviendrait à du contenu codé en dur.
- **Sécurité, SEO, performance et tests sont intégrés à chaque phase**, pas repoussés à la fin. Les phases 11 et 12 sont des audits et des durcissements, pas un rattrapage.

Chaque phase se termine par un rapport au format du §55 (développé, fichiers, base de données, fonctionnalités disponibles, tests, problèmes, étapes suivantes) et n'est déclarée terminée que si ses critères de sortie sont réellement atteints.

| Phase | Contenu | Critères de sortie |
|---|---|---|
| **0. Validation** | Ce document ; création du dépôt | Architecture validée, dépôt accessible |
| **1. Fondations** (étape 2) | Projet Next.js strict, Tailwind v4, ESLint, CI ; schéma Prisma complet v1 + migrations ; `seed:base` et `seed:dev` ; i18n + RTL (routage, messages, polices) ; design system (jetons, composants de base, page de référence interne) ; enveloppeurs serveur, erreurs, journalisation ; abstractions email, stockage, PDF (prototype PDF arabe) ; Docker Compose de développement ; README, `.env.example`, `docs/` | Build et CI verts ; les 3 langues et le RTL fonctionnent sur la page de référence ; PDF arabe validé |
| **2. Identité et administration minimale** (étape 4) | Better Auth, connexion, 2FA, invitations, mot de passe oublié ; rôles, permissions, périmètres ; coquille admin ; gestion de l'équipe ; paramètres globaux (marque, couleurs, coordonnées, réseaux) ; catalogue de services et questionnaires ; journal d'audit ; limitation de débit | Un admin crée un staff, modifie la marque et un service ; tests d'accès refusés automatisés |
| **3. Site public** (étapes 3, 13 en partie) | Accueil, services, pages service, à propos, contact, pages légales (textes provisoires signalés), formulaire de demande multi-étapes complet (lead, opportunité, notifications, emails) ; SEO technique (métadonnées, hreflang, sitemap, robots, données structurées) ; témoignages, chiffres clés et portfolio administrables | **Mise en ligne possible** : le site reçoit de vraies demandes et les range dans la base ; Lighthouse ≥ 90 sur mobile |
| **4. CRM** (étape 5) | Leads, opportunités, Kanban, fiches, activités, tâches, conversion en client, dédoublonnage, attribution, dashboard CRM | Parcours demande → qualification de bout en bout |
| **5. Devis** (étape 6) | Éditeur de devis, versions, PDF, envoi, invitation au portail, consultation, acceptation / refus / modification côté client (portail minimal), expiration, création automatique du projet | Un devis envoyé est accepté par un client de test et crée le projet |
| **6. Projets** (étape 7) | Projets, membres, jalons, tâches, commentaires, progression, fichiers (envoi sécurisé complet), messagerie, notifications | Un client et un staff échangent messages et fichiers sur un projet |
| **7. Facturation** (étape 8) | Factures, acomptes, avoirs, numérotation, PDF, paiements manuels, retards, contrats récurrents, paramètres fiscaux | Cycle devis → acompte → paiement → solde complet ; calculs couverts par des tests |
| **8. Portail client** (étape 9) | Portail complet (dashboard, documents, profil, préférences de notification) | Tests d'isolation : un client ne voit jamais les données d'un autre |
| **9. Réservations et transactions** (étape 10) | Disponibilités, calendrier, deux modes de réservation, rappels ; produits, stock, commandes, paiements de transaction, historique ; activation par module | Modules fonctionnels en interne ; publication publique conditionnée à la validation légale |
| **10. Dashboard et CMS** (étape 11) | KPI et graphiques, recherche globale, pages libres, blog, SEO par page, redirections, portfolio avancé | Toute la liste du §49 est modifiable sans code |
| **11. Durcissement** (étapes 12 à 14) | Revue de sécurité complète, tests d'intrusion de base, CSP stricte, revue des performances et du cache, accessibilité (WCAG AA), relecture des traductions | Aucune faille connue non traitée ; rapport de revue |
| **12. Tests et déploiement** (étapes 15 et 16) | E2E complets (parcours clés, 9 largeurs d'écran, RTL), déploiement de production, sauvegardes et restauration testées, supervision, `docs/deployment.md` | Checklist du §56 entièrement cochée |

Les tests unitaires et d'intégration sont écrits **dans chaque phase** pour ce qu'elle livre ; la phase 12 complète la couverture E2E.

---

## K. Points réellement bloquants

### K.1 Bloquant pour démarrer le développement

1. **Validation de cette architecture.** Les choix structurants à confirmer en priorité : Better Auth plutôt qu'Auth.js, PDF via Chromium, administration sous `/{locale}/admin`, pas d'inscription publique des clients, séparation Lead / Opportunité / Client.
2. **Dépôt du code.** Aucun dépôt GitHub n'est rattaché au projet. Deux options :
   - créer un dépôt privé (par exemple `saldaeconnect`) sur votre compte GitHub et l'ajouter aux ressources du projet ;
   - indiquer un dépôt existant à utiliser.

   Sans dépôt, le code ne peut pas être versionné ni conservé entre les sessions.

### K.2 Bloquant avant la mise en ligne (pas pour démarrer)

| Point | Nécessaire avant | Défaut en attendant |
|---|---|---|
| Pays d'établissement, forme juridique, identifiants légaux de l'agence | Mentions légales, factures | Champs vides, pages légales marquées « validation requise » |
| Règles fiscales validées par le comptable (taxes, mentions obligatoires, numérotation, arrondis, avoirs) | Première facture réelle | Aucun taux, avertissement dans l'admin |
| Cadre légal du change, des cartes prépayées, de Paysera et des démarches visa / TCF | Affichage public de ces services | Modules en suivi interne, invisibles du public |
| Nom de domaine et hébergement (managé ou VPS) | Déploiement | Recommandation : Vercel + Neon + R2 + Resend pour démarrer vite, ou VPS si vous préférez maîtriser les données et les coûts |
| Adresse email d'envoi sur le domaine (SPF, DKIM, DMARC) | Emails aux clients | Emails capturés localement (Mailpit) en développement |
| Contenus réels : portfolio, témoignages avec autorisation, chiffres clés, photos | Sections correspondantes | Sections masquées tant qu'elles sont vides |
| Relecture native de l'arabe (et de l'anglais) | Publication des pages AR / EN | Contenus marqués « à relire » |
| Textes juridiques (mentions, confidentialité, CGV, cookies) | Mise en ligne | Textes provisoires clairement signalés |

### K.3 Décisions prises par défaut, à confirmer quand vous le souhaitez

- Devise principale DZD, fuseau `Africa/Algiers`, EUR en seconde devise.
- Chiffres latins dans l'interface arabe.
- Slugs latins en arabe.
- Formats de numérotation listés en 0.3 (dont `SC-2026-00001` pour les demandes).
- Brouillon (et non émission automatique) des factures d'acompte et récurrentes.
- Conservation de l'adresse IP lors de l'acceptation des devis.
- Identité visuelle provisoire décrite en annexe 1.

---

## Annexe 1. Design system et identité provisoire

**Intention** : sobre, technologique, méditerranéen. Beaucoup d'espace, une typographie forte, une seule couleur d'accent utilisée avec parcimonie, aucune surcharge d'effets.

| Élément | Proposition (modifiable depuis l'admin pour les couleurs, le logo et la marque) |
|---|---|
| Logo provisoire | Logo textuel « Saldae**Connect** » : « Saldae » en graisse forte, « Connect » en graisse régulière, avec un petit signe graphique (un arc reliant deux points, évoquant la baie et la connexion). Version arabe du nom si souhaitée |
| Couleurs | Encre profonde (#0B1220) pour les fonds sombres et les textes ; bleu « mer de Saldae » (#1D4ED8) comme couleur principale ; accent sable cuivré (#D08C4A) pour les éléments rares à mettre en valeur ; neutres froids ; couleurs sémantiques succès, avertissement, erreur, info. Contraste AA vérifié automatiquement quand l'admin change une couleur |
| Typographie latine | Titres : Manrope (géométrique, affirmée) ; texte : Inter (lisibilité) |
| Typographie arabe | IBM Plex Sans Arabic |
| Échelle | Espacements sur une grille de 4 px ; échelle typographique fluide (`clamp`) ; rayons 6 / 10 / 16 px ; trois niveaux d'ombre discrets |
| Thème | Clair par défaut, sombre prévu dans les jetons (le dashboard pourra le proposer) |
| Mouvement | Transitions de 150 à 250 ms, apparitions discrètes au défilement, désactivées si `prefers-reduced-motion` |
| Composants | Boutons (principal, secondaire, fantôme, danger ; états survol, focus visible, désactivé, chargement), champs, sélecteurs, cases, cartes, badges de statut, tableaux, modales, tiroirs, alertes, toasts, onglets, info-bulles, squelettes, états vides, pagination, stepper |

Les couleurs de l'admin sont injectées comme variables CSS depuis `Setting.theme` ; tous les composants lisent les jetons, jamais une couleur en dur.

## Annexe 2. Variables d'environnement prévues

| Variable | Rôle |
|---|---|
| `APP_ENV` | `development`, `staging` ou `production` (bloque `seed:dev` en production) |
| `NEXT_PUBLIC_APP_URL` | URL publique du site |
| `DATABASE_URL`, `DIRECT_URL` | Connexion PostgreSQL (poolée / directe pour les migrations) |
| `AUTH_SECRET` | Secret de signature des sessions |
| `DATA_ENCRYPTION_KEY` | Clé de chiffrement des champs sensibles |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM` | Envoi des emails |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL` | Stockage compatible S3 |
| `PDF_RENDERER`, `CHROMIUM_PATH` ou `GOTENBERG_URL` | Génération PDF |
| `CRON_SECRET` | Protection des tâches planifiées |
| `RATE_LIMIT_STORE`, `REDIS_URL` (facultatif) | Limitation de débit |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (facultatif) | Captcha |
| `CLAMAV_HOST`, `CLAMAV_PORT` (facultatif) | Antivirus |
| `LOG_LEVEL` | Niveau de journalisation |

Chaque variable sera documentée dans `.env.example` et dans le README ; l'application vérifie leur présence et leur format au démarrage.
