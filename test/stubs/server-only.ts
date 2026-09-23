// Vitest ne passe pas par le bundler Next.js, qui est seul à définir le
// marqueur que `server-only` vérifie (voir docs/architecture.md §A.5, même
// contrainte que pour `npm run auth:generate`). On neutralise l'import ici
// plutôt que de retirer `import "server-only"` des fichiers testés.
export {};
