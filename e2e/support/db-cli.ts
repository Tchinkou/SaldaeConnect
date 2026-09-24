// Exécuté via `tsx` (jamais importé directement par Playwright Test — voir
// `db.ts` pour pourquoi). Reçoit une commande JSON sur argv[2], écrit un
// résultat JSON sur stdout. Usage interne à `e2e/support/**` uniquement.
import "dotenv/config";
import { hash as argon2Hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

type Command =
  | { op: "resetStaffTwoFactor"; email: string }
  | { op: "getStaffTotpSecret"; email: string }
  | { op: "createTestClient"; label: string }
  | { op: "cleanupTestClient"; userId: string; clientId: string }
  | { op: "raw"; model: string; method: string; args: unknown };

async function main() {
  const command = JSON.parse(process.argv[2] ?? "{}") as Command;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquant.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  let result: unknown;
  switch (command.op) {
    case "resetStaffTwoFactor": {
      await db.user.update({ where: { email: command.email }, data: { twoFactorEnabled: false } });
      const user = await db.user.findUnique({ where: { email: command.email } });
      if (user) await db.twoFactor.deleteMany({ where: { userId: user.id } });
      result = { ok: true };
      break;
    }
    case "getStaffTotpSecret": {
      const record = await db.twoFactor.findFirst({ where: { user: { email: command.email } } });
      result = { secret: record?.secret ?? null };
      break;
    }
    case "createTestClient": {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const email = `e2e-${command.label}-${suffix}@saldaeconnect.test`;
      const client = await db.client.create({
        data: {
          code: `E2E-${suffix}`.toUpperCase(),
          kind: "INDIVIDUAL",
          displayName: `E2E Test ${command.label}`,
          email,
          status: "ACTIVE",
          preferredLocale: "fr",
        },
      });
      const password = "E2eTest2026!Secure";
      const passwordHash = await argon2Hash(password);
      const user = await db.user.create({
        data: {
          email,
          name: `E2E Test ${command.label}`,
          emailVerified: true,
          userType: "CLIENT",
          status: "ACTIVE",
          accounts: { create: { providerId: "credential", accountId: "PLACEHOLDER", password: passwordHash } },
        },
      });
      await db.account.updateMany({ where: { userId: user.id, providerId: "credential" }, data: { accountId: user.id } });
      const contact = await db.clientContact.create({
        data: { clientId: client.id, firstName: "E2E", lastName: command.label, email, isPrimary: true, userId: user.id },
      });
      result = { email, password, clientId: client.id, contactId: contact.id, userId: user.id };
      break;
    }
    case "cleanupTestClient": {
      // Ordre imposé par les relations `onDelete: Restrict` vers Client
      // (Quote, Project, Invoice, Payment, Subscription) — sans quoi la
      // suppression du client échoue silencieusement et laisse un résidu
      // (déjà observé : un client orphelin d'une exécution précédente a
      // faussé une sélection par libellé dans un test).
      await db.payment.deleteMany({ where: { clientId: command.clientId } });
      await db.invoice.deleteMany({ where: { clientId: command.clientId } });
      await db.project.deleteMany({ where: { clientId: command.clientId } });
      await db.quote.deleteMany({ where: { clientId: command.clientId } });
      await db.subscription.deleteMany({ where: { clientId: command.clientId } });
      await db.user.delete({ where: { id: command.userId } }).catch(() => {});
      await db.client.delete({ where: { id: command.clientId } });
      result = { ok: true };
      break;
    }
    case "raw": {
      // Passerelle générique pour les besoins ponctuels des parcours E2E
      // (lire/nettoyer une ligne créée par le test) sans ajouter une
      // commande dédiée à chaque fois. Modèle/méthode Prisma valides
      // uniquement — jamais exposé en dehors de `e2e/**`.
      const model = (db as unknown as Record<string, Record<string, (args: unknown) => Promise<unknown>>>)[command.model];
      if (!model || typeof model[command.method] !== "function") {
        throw new Error(`Commande raw invalide : ${command.model}.${command.method}`);
      }
      result = await model[command.method](command.args);
      break;
    }
  }

  await db.$disconnect();
  // Certains modèles (Quote, Invoice…) portent des colonnes BigInt (montants
  // en centimes) que JSON.stringify ne sait pas sérialiser nativement.
  process.stdout.write(JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? value.toString() : value)));
}

main().catch((error) => {
  process.stderr.write(String(error?.stack ?? error));
  process.exit(1);
});
