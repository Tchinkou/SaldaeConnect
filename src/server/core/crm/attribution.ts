import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type CrmSetting = {
  attributionMode: "round_robin" | "fixed";
  fixedOwnerId: string | null;
  lastAssignedOwnerId: string | null;
};

/**
 * Attribution par défaut (§E.2) : responsable fixe, ou tour de rôle entre le
 * staff actif habilité à traiter des leads (`lead.write`). Doit être appelée
 * dans la transaction qui crée le Lead/l'Opportunité, pour que la rotation
 * du tour de rôle reste cohérente même sous création concurrente.
 */
export async function pickDefaultOwner(tx: Prisma.TransactionClient): Promise<string | null> {
  const setting = await tx.setting.findUnique({ where: { key: "crm" } });
  const config = (setting?.value as CrmSetting | undefined) ?? {
    attributionMode: "round_robin",
    fixedOwnerId: null,
    lastAssignedOwnerId: null,
  };

  if (config.attributionMode === "fixed") {
    return config.fixedOwnerId;
  }

  const eligible = await tx.user.findMany({
    where: {
      userType: "STAFF",
      status: "ACTIVE",
      roles: { some: { role: { permissions: { some: { permission: { key: "lead.write" } } } } } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (eligible.length === 0) return null;

  const lastIndex = eligible.findIndex((u) => u.id === config.lastAssignedOwnerId);
  const nextOwner = eligible[(lastIndex + 1) % eligible.length]!.id;

  await tx.setting.update({
    where: { key: "crm" },
    data: { value: { ...config, lastAssignedOwnerId: nextOwner } },
  });

  return nextOwner;
}
