// Crée le premier administrateur en production (§46 : "création d'un
// admin"). Usage :
//   npm run create-admin -- --email=admin@exemple.com --name="Prénom Nom" --password="..."
// Si --password est omis, un mot de passe aléatoire est généré et affiché
// une seule fois (à changer dès la première connexion, 2FA à activer
// ensuite).
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { hash as argon2Hash } from "@node-rs/argon2";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) args.set(match[1], match[2]);
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const email = args.get("email");
  const name = args.get("name");
  if (!email || !name) {
    console.error('Usage: npm run create-admin -- --email=admin@exemple.com --name="Prénom Nom" [--password=...]');
    process.exit(1);
  }

  const password = args.get("password") ?? randomBytes(12).toString("base64url");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const adminRole = await prisma.role.findUnique({ where: { key: "admin" } });
  if (!adminRole) {
    throw new Error("Le rôle 'admin' n'existe pas — lancez d'abord `npm run db:seed`.");
  }

  const passwordHash = await argon2Hash(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      emailVerified: true,
      userType: "STAFF",
      status: "ACTIVE",
      accounts: {
        create: { providerId: "credential", accountId: "PLACEHOLDER", password: passwordHash },
      },
    },
  });
  await prisma.account.updateMany({
    where: { userId: user.id, providerId: "credential" },
    data: { accountId: user.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });

  console.info(`✅ Administrateur créé : ${email}`);
  if (!args.get("password")) {
    console.info(`   Mot de passe généré (à noter, affiché une seule fois) : ${password}`);
  }
  console.info("   Pensez à activer la double authentification à la première connexion (§27).");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
