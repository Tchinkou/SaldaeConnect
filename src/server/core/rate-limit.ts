import "server-only";
import { prisma } from "@/server/core/db/client";
import { RateLimitedError } from "@/server/core/errors";

/**
 * Limitation de débit à fenêtre fixe, adossée à PostgreSQL
 * (`RateLimitBucket`) — voir `RATE_LIMIT_STORE=postgres` dans
 * `.env.example`. Suffisant pour le volume attendu ; un adaptateur Redis
 * pourra la remplacer plus tard sans changer les appelants.
 *
 * Better Auth limite déjà ses propres routes (`/api/auth/*`, voir
 * `auth.ts`) — cette fonction sert aux actions serveur qui n'en passent
 * pas par lui (invitations, formulaires publics à partir de la phase 3…).
 */
export async function rateLimit(key: string, { windowSeconds, max }: { windowSeconds: number; max: number }) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const bucketKey = `${key}:${windowStart.getTime()}`;

  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key: bucketKey },
    create: { key: bucketKey, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (bucket.count > max) {
    throw new RateLimitedError();
  }
}
