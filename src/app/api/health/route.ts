import { NextResponse } from "next/server";
import { prisma } from "@/server/core/db/client";

/**
 * Point de contrôle de disponibilité (§H.8, docs/architecture.md) — sans
 * préfixe de langue comme les autres routes API, sans authentification (les
 * services de supervision externes ne portent pas de session). Vérifie la
 * seule dépendance dont la panne rend l'application inutilisable : la base
 * de données. N'inclut pas les fournisseurs email/stockage : leur panne
 * dégrade des fonctionnalités précises sans rendre le reste indisponible,
 * ce que ce point de contrôle binaire ne peut pas représenter correctement.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
