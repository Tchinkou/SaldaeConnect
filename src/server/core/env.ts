import "server-only";
import { z } from "zod";

/**
 * Toutes les variables d'environnement utilisées par le serveur, validées au
 * démarrage. Si une variable obligatoire manque ou a un format invalide,
 * l'application refuse de démarrer plutôt que d'échouer plus tard de façon
 * imprévisible. Voir .env.example pour la documentation de chaque variable.
 */
const envSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url(),

  DATABASE_URL: z.url(),
  SHADOW_DATABASE_URL: z.url().optional(),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit faire au moins 32 caractères"),
  DATA_ENCRYPTION_KEY: z.string().min(32, "DATA_ENCRYPTION_KEY doit faire au moins 32 caractères"),

  EMAIL_PROVIDER: z.enum(["resend", "postmark", "console"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  EMAIL_FROM: z.string().min(1),

  STORAGE_PROVIDER: z.enum(["s3", "local"]).default("local"),
  STORAGE_ENDPOINT: z.url().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.url().optional(),
  STORAGE_LOCAL_DIR: z.string().optional(),

  PDF_RENDERER: z.enum(["chromium", "gotenberg"]).default("chromium"),
  CHROMIUM_PATH: z.string().optional(),
  GOTENBERG_URL: z.url().optional(),

  CRON_SECRET: z.string().min(16),

  RATE_LIMIT_STORE: z.enum(["postgres", "redis"]).default("postgres"),
  REDIS_URL: z.url().optional(),

  TURNSTILE_SECRET_KEY: z.string().optional(),

  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "❌ Variables d'environnement invalides ou manquantes :\n" +
        JSON.stringify(z.treeifyError(parsed.error), null, 2),
    );
    throw new Error("Configuration d'environnement invalide — voir .env.example");
  }
  return parsed.data;
}

// Un seul chargement/validation par processus.
export const env: Env = loadEnv();
