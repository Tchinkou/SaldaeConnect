import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Tests unitaires et d'intégration légers (§J : "écrits dans chaque
 * phase"). Volontairement séparés de Playwright/E2E (phase 12) : ceux-ci ne
 * démarrent ni serveur Next ni base de données, ils testent la logique pure
 * (autorisation, validation) avec les dépendances (Prisma, sessions)
 * simulées — voir `src/server/core/**\/*.test.ts`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Vitest ne passe pas par le bundler Next.js — voir test/stubs/server-only.ts.
      "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
    },
  },
});
