// Point d'entrée appelé par `prisma db seed` / `prisma migrate dev` (voir
// prisma7.config.ts). `pnpm/npm run db:seed` exécute seed:base puis, hors
// production, seed:dev.
import { seedBase } from "./base";
import { seedDev } from "./dev";
import { prisma } from "./lib/client";

async function main() {
  await seedBase();
  if (process.env.APP_ENV !== "production") {
    await seedDev();
  }
}

main()
  .catch((error) => {
    console.error("❌ Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
