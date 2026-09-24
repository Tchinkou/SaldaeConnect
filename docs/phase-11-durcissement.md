# Phase 11 — Durcissement : rapport de revue

Rapport de la passe de durcissement (sécurité, i18n, accessibilité,
performance) menée fin septembre 2026, avant la phase 12 (tests +
déploiement). Chaque section résume ce qui a été vérifié, ce qui a été
corrigé, et ce qui reste un risque accepté ou hors périmètre.

## 1. En-têtes de sécurité et CSP

- `next.config.ts` définit désormais, via `headers()`, une CSP statique
  stricte, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy` et
  `Permissions-Policy`.
- Vérifié en direct (curl + Playwright) sur les pages publiques et admin :
  0 violation CSP.
- **Compromis assumé** : la CSP est statique (pas de nonce par requête),
  ce qui simplifie le rendu statique mais suppose qu'aucun script inline
  non contrôlé ne sera jamais injecté dans le HTML généré. `img-src` est
  actuellement `https:` en attendant qu'un domaine de stockage de
  production définitif soit connu — à resserrer une fois l'infrastructure
  de stockage choisie.

## 2. Authentification à deux facteurs (2FA) obligatoire

- Tout le personnel (STAFF/ADMIN) est désormais bloqué à l'entrée de
  l'espace admin (`admin/layout.tsx`) tant que le TOTP n'est pas activé,
  via une page dédiée `/two-factor-setup` (hors de la coquille admin pour
  éviter une boucle de redirection).
- Vérifié en direct de bout en bout : activation (mot de passe → QR/secret
  → code TOTP), puis re-connexion avec défi 2FA (`/login/two-factor`), en
  simulant une vraie application d'authentification (générateur TOTP
  RFC 6238 minimal, sans dépendance).

## 3. Durcissement des cookies de session

- Cookies de session renommés en `__Host-saldaeconnect.session_token` /
  `__Host-saldaeconnect.session_data` (préfixe `__Host-` : force `Secure`,
  `Path=/`, aucun `Domain` — protection supplémentaire contre l'injection
  de cookie inter-sous-domaine).
- **Bug réel trouvé et corrigé en cours de route** : l'utilitaire
  `getSessionCookie()` de Better Auth (utilisé dans `proxy.ts`) reconstruit
  lui-même le nom de cookie attendu et ne connaît pas la convention
  `__Host-` — après le renommage, plus personne n'aurait pu se connecter à
  l'admin (le proxy redirigeait systématiquement vers `/login` malgré une
  session valide). Corrigé en lisant directement le cookie par son nom
  exact dans `proxy.ts`. Ce bug n'était visible ni par `tsc` ni par
  `eslint` — seule la vérification en direct (navigateur réel + inspection
  des en-têtes `Set-Cookie`/`Cookie`) l'a révélé.
- À cette occasion, audit ciblé de l'ownership-scoping (§H.2) : 3 pages du
  portail client (projets/factures/devis) faisaient un `findUnique({ id })`
  puis une vérification manuelle `clientId !== contact.clientId` a
  posteriori — fonctionnellement correct aujourd'hui, mais fragile pour
  l'avenir (un développeur pourrait oublier la vérification manuelle sur
  une nouvelle route). Durci en `findFirst({ where: { id, clientId } })`,
  qui échoue de façon sûre par construction.

## 4. Dépendances

`npm audit` : 3 vulnérabilités, toutes dans des outils de développement/
build jamais chargés par le serveur en production (`@vitest/mocker` de
vitest ; `deepmerge-ts`/`mysql2` embarqués transitivement par
`@prisma/config`, le code `mysql2` n'étant jamais exécuté puisque le
projet ne configure que `provider: "postgresql"`). Prisma 7.10.0 est la
dernière version stable disponible ; `npm audit fix --force` forcerait un
retour à `prisma@6.19.3`, une régression majeure délibérément évitée.
**Risque accepté**, à ré-évaluer à la prochaine version stable de Prisma.

## 5. Audit i18n (fr/en/ar)

Deux passes complémentaires (un diff croisé entre locales ne peut pas
détecter une clé absente des *trois* langues à la fois) :

1. Diff croisé fr/en/ar sur les 5 fichiers de namespaces : 0 écart.
2. Scan statique des appels `useTranslations()`/`t()` contre les fichiers
   de messages réels : a trouvé 3 bugs réels absents des trois locales à
   la fois — `admin.content.redirects.cancel` (repéré d'abord dans un log
   serveur), `portal.nav.reservations`, et une mauvaise portée de
   traducteur dans `new-invoice-form.tsx` (`admin.invoices.create.typeValue.*`
   au lieu de `admin.invoices.typeValue.*`, qui existait déjà). Les 3
   corrigés et vérifiés par un script chargeant les JSON de messages comme
   le ferait `next-intl` au runtime.

**Non exhaustif** : environ 63 appels `t(\`...${variable}\`)` (clé dynamique
construite par interpolation) n'ont pas été vérifiés un par un — seuls 2
échantillons l'ont été, sans anomalie. Risque résiduel faible mais réel.

## 6. Accessibilité (axe-core, WCAG2A/AA/21A/21AA)

Scan `axe-core` via Playwright, en deux temps : pages publiques (fr/en/ar,
sans authentification), puis pages admin réelles avec un compte STAFF
authentifié et 2FA effectivement activé (pas de contournement du gate).

Bugs réels trouvés et corrigés :

- **Select sans nom accessible** sur l'étape « service » de l'assistant de
  devis public (`/quote`) — violation *critique*. Lié via `aria-labelledby`
  à son titre.
- **~24 formulaires admin/portail** (filtres, éditeurs CMS, éditeurs
  devis/factures, disponibilités de réservation…) : labels visuels non
  associés programmatiquement à leur champ (`<label>` sans `htmlFor`, champ
  sans `id`) — invisible pour un lecteur d'écran. Corrigé partout, avec des
  identifiants uniques par ligne dans les tableaux dynamiques.
- **Contraste insuffisant** : `text-foreground/50` (texte secondaire —
  libellés de statistiques, légendes de graphique) ne passe pas le seuil
  AA (~3.5:1 calculé, 4.5:1 requis). Remplacé uniformément par
  `text-foreground/70` (~7:1) sur 102 occurrences — amélioration
  strictement monotone du contraste dans les deux thèmes.
- **Rôles interactifs imbriqués** dans le tableau Kanban du CRM : la carte
  glissable entière portait `role="button"` (attributs dnd-kit) tout en
  contenant un lien de navigation (`<a>`) — restructuré avec une poignée de
  glisser-déposer dédiée (icône + `aria-label`), séparée du lien, sans
  rien perdre du glisser-déposer clavier inter-colonnes (fonctionnalité
  spécifiquement durcie en Phase 4).
- **HTML invalide** : un `<p>` (état de liste vide) enfant direct d'un
  `<ul>` dans le gestionnaire de disponibilités — converti en `<li>`.
- Un composant partagé non encore utilisé en production
  (`DynamicQuestion`, questionnaire par service, §C — aucun schéma de
  questions n'existe encore faute d'éditeur admin) a été corrigé par
  prévention pour le même défaut de labels.

Vérifié en direct sur 10 pages publiques (fr/en/ar) + 11 pages admin
réelles (dont CRM avec vérification manuelle que les liens et la poignée
de glisser-déposer fonctionnent toujours) : **0 violation partout**.

**Non couvert par cette passe** : le portail client authentifié
(`/portal/*`) — aucun compte client de test n'était disponible en base
(zéro résidu après les tests précédents), et la mise en place d'un flux de
connexion client (lien magique) pour le tester en direct dépassait le
temps imparti. Les fichiers portail ont néanmoins été inclus dans la
correction mécanique des labels et de contraste (mêmes composants
partagés), donc probablement déjà conformes, mais non vérifié en direct.

## 7. Performance et cache

- **Index manquant ajouté** : `Reservation.clientId` (filtré directement
  dans `portal/reservations/page.tsx`, sans index le supportant). Migration
  Prisma **non générée** — à faire avant déploiement (`prisma migrate dev`).
- **N+1 repérés mais non corrigés**, documentés pour revue séparée :
  - `portal/messages/page.tsx` : dernier message + compteur non lus par
    conversation, en boucle — nécessiterait `distinct`/`groupBy` Prisma ou
    du SQL brut pour être batché proprement.
  - `transaction-order-actions.ts` (passage à `COMPLETED`) : boucle sur les
    lignes de commande avec écriture de mouvement de stock — code sensible
    (facturation), volontairement laissé à une revue humaine.
  - Les boucles des crons (rappels de réservation, factures en retard,
    expiration de devis) sont un pattern d'idempotence intentionnel documenté
    dans le code, à faible volume — non problématique.
- Aucune balise `<img>` brute trouvée : `next/image` est utilisé partout.
- **Gap de cache réel identifié, non corrigé** : toutes les pages publiques
  marketing/catalogue (accueil, services, portfolio, blog, pages légales…)
  sont entièrement dynamiques — chaque requête ré-exécute les requêtes
  Prisma, sans aucune mise en cache, alors qu'il s'agit de contenu public
  peu changeant. Un essai d'ajout de `export const revalidate = 3600` sur
  la page des services n'a **pas** suffi à sortir la route du rendu
  dynamique (cause exacte non identifiée avec certitude dans le temps
  imparti — pas d'usage de `cookies()`/`headers()` dans l'arbre de
  composants de ces pages). **À investiguer en suivi dédié** avant que le
  trafic ne justifie l'optimisation.

## Risques acceptés / hors périmètre (récapitulatif)

| Sujet | Statut |
|---|---|
| CSP `img-src: https:` non resserrée à un domaine précis | En attente du choix définitif d'infrastructure de stockage |
| 3 vulnérabilités `npm audit` (outils de dev uniquement) | Acceptées, prisma déjà à la dernière version stable |
| ~63 clés i18n dynamiques non vérifiées une à une | Risque résiduel faible, non bloquant |
| Portail client non testé en direct pour l'accessibilité | Corrections mécaniques appliquées, non vérifiées live faute de compte de test disponible |
| N+1 sur `portal/messages` et `transaction-order-actions` | Documentés, non corrigés (facturation/volume faible) |
| Absence de cache sur les pages publiques | Gap réel identifié, cause du blocage non résolue — suivi dédié nécessaire |
| Cadre légal des services de change/cartes, contenu juridique définitif | Toujours en attente de validation juridique/comptable (voir §K.2 `architecture.md`), non traité dans cette phase |

## Vérification

À chaque commit de cette phase : `tsc --noEmit`, `eslint` (fichiers
touchés ou repo entier selon les cas) et `vitest run` (44 tests) verts, et
vérification en direct sur serveur de développement + PostgreSQL réel
(jamais seulement le typecheck/lint) — notamment le bug `proxy.ts`/cookies
et l'audit d'accessibilité, qui n'auraient été détectés par aucun outil
statique.
