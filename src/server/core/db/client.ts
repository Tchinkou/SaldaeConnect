import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/core/env";

/**
 * Client Prisma partagé par toute l'application. En développement, Next.js
 * recharge les modules à chaud : on garde l'instance sur `globalThis` pour
 * ne pas ouvrir un nouveau pool de connexions à chaque rechargement.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.LOG_LEVEL === "debug" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (env.APP_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
