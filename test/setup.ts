import { config } from "dotenv";

// Charge `.env` pour les tests qui importent `@/server/core/env` (validé au
// chargement du module) — `vitest` ne passe pas par le chargement d'env de
// Next.js comme `next dev`/`next build`.
config();
