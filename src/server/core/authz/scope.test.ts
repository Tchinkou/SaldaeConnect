import { describe, it, expect } from "vitest";
import { hasPermission, permissionScope, type PermissionMap } from "./scope";

function withPermissions(permissions: Record<string, "ALL" | "ASSIGNED" | "OWN">): PermissionMap {
  return { permissions: new Map(Object.entries(permissions)) as PermissionMap["permissions"] };
}

describe("permissionScope / hasPermission", () => {
  it("refuse tout accès quand il n'y a pas de session (utilisateur null)", () => {
    expect(hasPermission(null, "team.write")).toBe(false);
    expect(permissionScope(null, "team.write")).toBeNull();
  });

  it("refuse une permission jamais accordée à aucun rôle", () => {
    const user = withPermissions({ "lead.read": "ASSIGNED" });
    expect(hasPermission(user, "team.write")).toBe(false);
  });

  it("accorde l'accès quand la permission est présente, quel que soit le périmètre", () => {
    const owned = withPermissions({ "quote.read": "OWN" });
    const assigned = withPermissions({ "quote.read": "ASSIGNED" });
    const all = withPermissions({ "quote.read": "ALL" });

    expect(hasPermission(owned, "quote.read")).toBe(true);
    expect(hasPermission(assigned, "quote.read")).toBe(true);
    expect(hasPermission(all, "quote.read")).toBe(true);
  });

  it("renvoie le périmètre exact accordé", () => {
    const user = withPermissions({ "settings.write": "ALL" });
    expect(permissionScope(user, "settings.write")).toBe("ALL");
    expect(permissionScope(user, "audit.read")).toBeNull();
  });
});
