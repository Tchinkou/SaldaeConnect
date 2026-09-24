import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const CLI_PATH = path.join(__dirname, "db-cli.ts");

/**
 * Exécute une commande de préparation/nettoyage de données de test via un
 * sous-processus `tsx` plutôt qu'en important le client Prisma généré
 * directement dans le process Playwright Test : ce dernier compile chaque
 * fichier en CJS, incompatible avec le client généré par Prisma (module ESM
 * natif, `import.meta.url`) — voir le commentaire en tête de `db-cli.ts`.
 * `tsx` (utilisé ailleurs dans le projet, ex. `scripts/create-admin.ts`) le
 * charge sans problème.
 */
export async function runDbCommand<T>(command: Record<string, unknown>): Promise<T> {
  const { stdout } = await execFileAsync("npx", ["tsx", CLI_PATH, JSON.stringify(command)], {
    cwd: path.join(__dirname, "..", ".."),
    env: process.env,
  });
  return JSON.parse(stdout) as T;
}
