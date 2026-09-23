# Sécurité

Les principes complets (couches de défense, RBAC, fichiers, audit,
sauvegardes) sont documentés dans
[`architecture.md` §H](./architecture.md#h-architecture-de-sécurité). Ce
document couvre ce qui est déjà implémenté et comment l'opérer.

## Authentification (Better Auth)

Configuration dans `src/server/core/auth/auth.ts` :

- Email + mot de passe, hachage **argon2id** (`@node-rs/argon2`), pas le
  scrypt par défaut de Better Auth — voir la justification en commentaire
  dans le fichier.
- Double authentification (TOTP) via le plugin `two-factor`.
- Vérification des mots de passe compromis via le plugin `haveibeenpwned`.
- Lien magique (`magic-link`) pour l'invitation des clients au portail sans
  mot de passe à choisir dans un premier temps.
- Sessions en base (30 jours, cookie `HttpOnly`/`Secure` en production,
  préfixe `saldaeconnect`).

### Régénérer le schéma Better Auth

Les modèles `User`, `Session`, `Account`, `Verification`, `TwoFactor` de
`prisma/schema/10-identity.prisma` sont générés à partir de `auth.ts`. Pour
les régénérer après un changement de configuration (ex. un nouveau champ
dans `user.additionalFields`) :

```bash
npm run auth:generate
```

Cette commande rappelle la marche à suivre : retirer temporairement les
`import "server-only"` des fichiers sous `src/server/core/` (le CLI Better
Auth charge `auth.ts` en dehors du bundler Next.js, qui refuse sinon de
s'exécuter), lancer la génération, puis les restaurer. Ne modifiez jamais
ces cinq modèles à la main — ajoutez plutôt des relations vers vos propres
modèles, comme `UserRole` ou `ClientContact` le font déjà.

## RBAC

- `Role` / `Permission` / `RolePermission` (avec un `PermissionScope` :
  `ALL`, `ASSIGNED`, `OWN`) / `UserRole` dans `10-identity.prisma`.
- Les rôles système (`admin`, `staff`, `client`) et leurs permissions par
  défaut sont créés par `seed:base` (`prisma/seed/base.ts`).
- **À faire en phase 2** : l'enveloppeur serveur (`src/server/core/action.ts`
  / `route.ts`) qui vérifie systématiquement authentification → autorisation
  → validation avant d'exécuter une action, décrit en `architecture.md` §A.2
  et §H.2. Tant qu'il n'existe pas, aucune route ne doit faire confiance à
  une vérification uniquement côté client.

## Secrets et variables d'environnement

- Toutes les variables sont validées au démarrage par
  `src/server/core/env.ts` (Zod) — l'application refuse de démarrer si une
  variable obligatoire manque.
- `DATA_ENCRYPTION_KEY` est réservée au chiffrement applicatif des champs
  sensibles (pièces d'identité pour les réservations et transactions, §21,
  §28) — l'implémentation de `server/core/crypto` arrive avec le module
  concerné (phase 9).
- Ne jamais commiter `.env`. `.env.example` documente chaque variable.

## À valider avant la mise en ligne

Voir `architecture.md` §K.2 : cadre légal des services de change/cartes/
Paysera/visa, règles fiscales avec le comptable, contenu juridique définitif.
Rien de tout cela n'est présumé dans le code : `Setting.invoicing.note` et
les pages légales générées par le seed le rappellent explicitement.
