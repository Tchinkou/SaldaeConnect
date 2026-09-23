// Client Prisma dédié aux scripts de seed. On ne réutilise pas
// src/server/core/db/client.ts car il importe "server-only", qui refuse de
// s'exécuter en dehors du bundler Next.js.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquant — voir .env.example");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
