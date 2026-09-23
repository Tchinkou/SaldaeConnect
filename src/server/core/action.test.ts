import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const getCurrentUserMock = vi.fn();
const hasPermissionMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/server/core/authz/session", () => ({
  getCurrentUser: () => getCurrentUserMock(),
  hasPermission: (...args: unknown[]) => hasPermissionMock(...args),
}));

vi.mock("@/server/core/audit", () => ({
  logAudit: (...args: unknown[]) => logAuditMock(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const { defineAction } = await import("./action");

/**
 * L'enveloppeur `defineAction` est le seul chemin par lequel une mutation
 * admin peut toucher la base (§A.2, §H.2) : ces tests vérifient que
 * l'authentification et l'autorisation sont bien appliquées *avant*
 * `handler`, et jamais contournables — c'est le test d'accès refusé
 * automatisé demandé en critère de sortie de la phase 2.
 */
describe("defineAction", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    hasPermissionMock.mockReset();
    logAuditMock.mockReset();
  });

  const echoAction = defineAction({
    permission: "team.write",
    schema: z.object({ name: z.string().min(1, "Le nom est requis.") }),
    audit: { category: "SECURITY", action: "test.echo" },
    handler: async (input) => ({ received: input.name }),
  });

  it("refuse l'accès sans session", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const result = await echoAction({ name: "x" });

    expect(result).toEqual({ ok: false, error: "Connexion requise." });
    expect(hasPermissionMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("refuse l'accès à un utilisateur connecté sans la permission requise", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: "u1", name: "Ana Staff" },
      roles: ["staff"],
    });
    hasPermissionMock.mockReturnValue(false);

    const result = await echoAction({ name: "x" });

    expect(result).toEqual({ ok: false, error: "Action non autorisée." });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ category: "SECURITY", action: "access.denied", actorUserId: "u1" }),
    );
  });

  it("rejette une entrée invalide même avec la permission", async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: "u1", name: "Ana Admin" }, roles: ["admin"] });
    hasPermissionMock.mockReturnValue(true);

    const result = await echoAction({ name: "" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Le nom est requis.");
    }
  });

  it("exécute le handler et journalise quand tout est valide", async () => {
    getCurrentUserMock.mockResolvedValue({ user: { id: "u1", name: "Ana Admin" }, roles: ["admin"] });
    hasPermissionMock.mockReturnValue(true);

    const result = await echoAction({ name: "hello" });

    expect(result).toEqual({ ok: true, data: { received: "hello" } });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "test.echo", actorUserId: "u1" }),
    );
  });
});
