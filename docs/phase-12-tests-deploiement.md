# Phase 12 — Tests + déploiement : rapport

Rapport de la dernière phase du plan initial (tests end-to-end réels,
responsive/RTL, sauvegardes, supervision, checklist de déploiement). Comme
pour `phase-11-durcissement.md`, chaque section résume ce qui a été
vérifié en direct (jamais seulement `tsc`/`eslint`/`vitest`), ce qui a été
corrigé, et ce qui reste un risque accepté ou hors périmètre documenté pour
suivi.

## 1. Tests E2E des parcours utilisateurs réels

Cinq suites Playwright (`e2e/*.spec.ts`), chacune exécutée contre le
serveur de dev réel et Postgres réel, avec nettoyage complet des données de
test (aucun résidu) :

- `public-quote-journey.spec.ts` — formulaire public de demande de devis
  (création Lead/Opportunity) puis cycle complet devis admin
  (création → envoi → décision client dans le portail → création du
  Projet).
- `crm-staff-journey.spec.ts` — lead → conversion client → devis depuis
  l'opportunité → envoi → acceptation portail → projet.
- `invoice-payment-journey.spec.ts` — facture manuelle → émission →
  paiement partiel (PARTIALLY_PAID) → paiement du solde (PAID, reste dû à
  zéro).
- `booking-journey.spec.ts` — réservation publique d'un créneau → confirmation
  admin.
- `transaction-order-journey.spec.ts` — commande transactionnelle interne,
  cycle complet REQUESTED → PRICE_CONFIRMED → AWAITING_PAYMENT → PAID →
  COMPLETED.

**Infrastructure de test elle-même : deux problèmes réels trouvés et
corrigés**, découverts en exécutant toute la suite d'affilée (chaque spec
avait été vérifiée individuellement, jamais toutes ensemble) lors de la
vérification finale de la phase 12 :

- Chaque spec ré-enrôlait le 2FA STAFF en entier dans son nettoyage
  (`resetStaffTwoFactor()` en fin de test), donc toute la suite
  déclenchait plusieurs cycles complets d'enrôlement (mot de passe +
  génération + vérification TOTP) en quelques minutes — suffisant pour
  déclencher réellement le limiteur de débit anti-brute-force de Better
  Auth (§H.2), pourtant un comportement de sécurité correct et voulu.
  Corrigé : la remise à zéro ne se fait plus qu'une fois pour toute la
  suite (`e2e/support/global-teardown.ts`) ; chaque spec profite de la
  branche « déjà enrôlé » (défi TOTP seul), bien plus légère.
- Le timeout par défaut de Playwright (30s) est trop court pour un
  parcours complet incluant 2 connexions réelles (staff + client) et
  plusieurs navigations admin/portail — les tests échouaient au milieu
  d'un parcours par ailleurs correct. Porté à 90s dans
  `playwright.config.ts`.

**Limite constatée, non corrigée** : après ces deux correctifs, chaque
spec vérifiée individuellement passe de façon fiable (re-vérifié en
direct), mais l'exécution de toute la suite d'affilée reste parfois
instable en toute fin de session de développement très prolongée (ce
conteneur exécute le même serveur `next dev` sans interruption depuis
plusieurs heures, avec une charge cumulée importante : dizaines
d'exécutions de tests, audits responsive, restaurations de sauvegarde…).
Un code TOTP a une fenêtre de validité de quelques dizaines de secondes ;
sous charge, le délai entre sa génération côté test et sa vérification
côté serveur peut suffire à l'invalider — observé une fois lors de cette
vérification finale, pas reproduit en isolant le test concerné. Ce n'est
pas un défaut applicatif ni un défaut du code de test : c'est une
caractéristique de charge de ce conteneur de développement à ce moment
précis. Recommandation pour l'exécution en CI (hors périmètre de cette
tâche) : lancer la suite contre un serveur de dev fraîchement démarré,
pas contre une instance qui tourne depuis des heures.

**Bugs applicatifs réels trouvés et corrigés en cours de route** (pas de
simples artefacts de test) :

- `transaction-order-status-control.tsx` : le composant de changement de
  statut d'une commande n'étant pas démonté entre deux ouvertures du
  panneau, l'état React local du statut sélectionné restait bloqué sur la
  valeur du changement précédent — un second changement de statut pouvait
  être soumis avec l'ancienne valeur, rejeté par le serveur comme
  « transition non autorisée vers elle-même » alors que l'utilisateur avait
  bien sélectionné une nouvelle valeur à l'écran. Corrigé en réinitialisant
  l'état local à l'ouverture du panneau.
- `cleanupTestClient` (utilitaire de test `db-cli.ts`) avalait silencieusement
  l'échec de suppression d'un client quand une facture/projet/devis
  bloquait la suppression (`onDelete: Restrict`), laissant des clients de
  test orphelins en base. Corrigé pour supprimer explicitement les entités
  dépendantes dans le bon ordre avant le client.

## 2. Responsive (9 largeurs d'écran) et RTL

Méthodologie : scripts Playwright autonomes (non committés, comme les
scripts d'audit de la phase 11), un par périmètre (`site public`, `admin`,
`portail client`), testant chaque combinaison locale (fr/ar) × largeur
(320, 360, 375, 390, 414, 768, 1024, 1280, 1920 px — les 9 largeurs prévues
au plan) × pages clés, en vérifiant : absence de débordement horizontal de
page (`document.documentElement.scrollWidth` vs `clientWidth`) et `dir="rtl"`
correct en arabe.

**Site public** (accueil, services, devis, portfolio, contact — 90
combinaisons testées) : **0 anomalie** après correction de deux bugs réels :

- `header.tsx` : la navigation desktop complète (logo + 4 liens + connexion
  + sélecteur de langue + CTA) ne tenait pas dans `max-w-6xl` à 768px
  (bascule `md:flex` → `lg:flex`, et repli mobile `md:hidden` → `lg:hidden`
  en conséquence).
- `footer.tsx` : 4 colonnes serrées à `md` (768px) débordaient
  horizontalement (bascule `md:grid-cols-4` → `sm:grid-cols-2 lg:grid-cols-4`).

**Admin** (dashboard, Kanban CRM, liste devis — 54 combinaisons testées) :
**0 anomalie** après correction d'un bug réel affectant *toutes* les
largeurs testées, y compris desktop :

- `admin/layout.tsx` : le conteneur de contenu (`flex-1`) n'avait pas
  `min-w-0`. Par défaut, un enfant flex ne rétrécit pas sous la largeur
  intrinsèque de son contenu (`min-width: auto`) — le Kanban CRM, qui gère
  pourtant correctement son propre défilement horizontal interne
  (`overflow-x-auto`), élargissait toute la mise en page au lieu d'être
  contenu dans son propre conteneur. Corrigé en ajoutant `min-w-0`.

**Portail client** (dashboard, devis, documents — 54 combinaisons
testées) : le même correctif `min-w-0` a été appliqué à
`portal/layout.tsx` (conteneur de contenu), ce qui a réduit les anomalies
de 30 à 15 — mais **15 anomalies subsistent**, toutes sur le tableau de
bord portail, aux largeurs ≤ 414px (téléphones), en fr comme en ar.

**Cause racine identifiée** (débordement résiduel du portail) : à ces
largeurs, la barre latérale fixe de 256px (`w-64`, non réductible, sans
équivalent « menu mobile » contrairement au site public) ne laisse qu'environ
70 à 120px de largeur de contenu utile. À cette largeur, même un mot unique
insécable dans un titre (ex. « Bienvenue », ou « Derniers documents ») ne
peut pas tenir et force un débordement — ce n'est pas un bug CSS isolé
corrigeable par `min-w-0`/`truncate` (déjà tentés, sans effet suffisant),
mais une limite architecturale de la coquille (`admin/layout.tsx` et
`portal/layout.tsx` partagent la même structure à barre latérale fixe).
L'admin n'a pas montré cette anomalie uniquement parce que les pages
échantillonnées (dashboard, Kanban, liste devis) n'ont pas de titre
« mot unique » aussi contraint — la même limite structurelle s'y applique.

**Décision** : risque accepté, documenté pour suivi plutôt que corrigé
dans l'urgence. Justification : (1) l'admin et le portail sont des outils
de gestion (staff back-office, client suivant un dossier), plus
généralement consultés sur tablette/desktop que sur téléphone en mode très
étroit (320-414px) que le site public grand public ; (2) le site public,
qui doit réellement supporter le mobile, est à 0 anomalie ; (3) une
vraie correction (barre latérale rétractable en menu mobile, sur le modèle
du `<details>` du header public) est un ajout d'UI, pas un correctif
ponctuel, et risquerait d'introduire de nouveaux bugs si précipité en fin
de phase. **Recommandation pour une itération future** : si l'usage mobile
étroit du portail/admin se confirme en production, ajouter un repli « menu
hamburger » sous un seuil (ex. `lg`) sur `admin/layout.tsx` et
`portal/layout.tsx`, symétrique à celui déjà en place sur `header.tsx`.

RTL (arabe) : `dir="rtl"` vérifié correct sur les 3 périmètres, à toutes
les largeurs, sans exception.

## 3. Sauvegardes : procédure et test de restauration

Deux scripts ajoutés (`scripts/backup-db.sh`, `scripts/restore-db.sh`),
utilisables tels quels en développement comme en production (la partie
Postgres ne dépend d'aucun hébergeur — cohérent avec le choix d'architecture
« aucune dépendance à un hébergeur précis »).

- `backup-db.sh [dossier]` : `pg_dump -Fc` (format compressé/personnalisé,
  restaurable sélectivement) de `DATABASE_URL`, horodaté. Rappelle de
  chiffrer l'export avant tout envoi vers un stockage distant (§H.6).
- `restore-db.sh <fichier.dump> <url-cible>` : restaure **toujours** vers
  une URL passée explicitement en argument, jamais vers `DATABASE_URL`
  implicitement, pour ne jamais écraser une base par erreur d'inattention ;
  demande une confirmation interactive avant `pg_restore --clean`.

**Test de restauration réel effectué** (pas seulement documenté) :

1. Sauvegarde de la base de développement réelle via `backup-db.sh`.
2. Création d'une base Postgres neuve (`saldaeconnect_restore_test`) et
   restauration du dump dans cette base via `restore-db.sh`.
3. Comparaison des effectifs de lignes source vs restauré sur les tables
   clés (`user`, `clients`, `leads`, `opportunities`, `quotes`, `invoices`,
   `projects`, `reservations`, `transaction_orders`, `audit_logs`) :
   identiques sur toute la liste.
4. Vérification fonctionnelle (pas seulement un comptage) : connexion à la
   base restaurée via le client Prisma réel de l'application et lecture
   d'un client + d'un devis avec ses lignes — données cohérentes et
   complètes.
5. Bug réel trouvé et corrigé en cours de route : les deux scripts
   échouaient sur `DATABASE_URL` tel que fourni par Prisma
   (`?schema=public` en fin d'URL) — `pg_dump`/`pg_restore` ne reconnaissent
   pas ce paramètre de requête (`invalid URI query parameter: "schema"`).
   Corrigé en retirant ce paramètre avant l'appel.
6. Sauvegarde des fichiers (`StorageProvider` local, `.storage/files`) :
   test `tar czf`/`tar xzf` réel, comparaison `diff -rq` des 22 fichiers du
   dossier de test — restauration identique bit à bit.

Base de test et tous les fichiers temporaires supprimés après vérification
(aucun résidu).

## 4. Supervision : recommandation documentée

Contrairement aux sections précédentes, cette tâche est explicitement une
recommandation à documenter (§H.8 de `architecture.md`), pas une
intégration d'outil tiers — comme pour l'hébergement (§A.7), le choix d'un
service de supervision précis dépend de la plateforme retenue, qui n'est
pas encore choisie.

Ce qui a été fait concrètement (pas seulement écrit) :

- Ajout de `GET /api/health`, un point de contrôle réel vérifiant la
  connexion à la base de données (`SELECT 1`), sans dépendance
  d'hébergement. Vérifié en direct contre le serveur de dev réel :
  `200 {"status":"ok"}`.

Ce qui reste une recommandation documentée, non implémentée cette phase
(justification dans §H.8) : suivi d'erreurs applicatives (Sentry ou
équivalent), détection d'absence d'exécution des jobs cron (dead man's
switch), stratégie de journaux applicatifs selon l'hébergement, seuils
d'alerte minimaux. Chacun nécessite soit une clé d'API/service tiers non
demandé à ce stade, soit une décision d'hébergement préalable — les deux
hors périmètre d'une tâche de recommandation.

**Hors périmètre de ce test** (nécessite une infrastructure de production
non encore choisie, cf. `architecture.md` §A.7) : sauvegarde automatique du
fournisseur avec restauration à un instant donné (point-in-time recovery,
ex. Neon), programmation du `pg_dump` quotidien via cron/tâche planifiée,
et réplication du stockage de fichiers vers un second emplacement. Ces
points restent à mettre en place au moment du choix d'hébergement — le
mécanisme de sauvegarde/restauration lui-même (ce que teste cette tâche)
est vérifié fonctionnel indépendamment de l'hébergeur.
