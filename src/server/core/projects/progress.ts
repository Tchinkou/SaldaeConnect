/**
 * Progression d'un projet (§F.4) : calculée automatiquement à partir des
 * tâches terminées ou des jalons pondérés, ou saisie manuellement — choix
 * par projet via `Project.progressMode`. Fonction pure (pas de "server-only"),
 * utilisable aussi bien côté serveur que dans un composant client si besoin.
 */
export function computeProjectProgress(
  mode: "TASKS" | "MILESTONES" | "MANUAL",
  data: {
    progressManual: number | null;
    tasks: Array<{ status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED" }>;
    milestones: Array<{ status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED"; weight: number }>;
  },
): number {
  if (mode === "MANUAL") {
    return Math.min(100, Math.max(0, data.progressManual ?? 0));
  }

  if (mode === "MILESTONES") {
    const active = data.milestones.filter((m) => m.status !== "CANCELLED");
    const totalWeight = active.reduce((sum, m) => sum + m.weight, 0);
    if (totalWeight === 0) return 0;
    const doneWeight = active.filter((m) => m.status === "DONE").reduce((sum, m) => sum + m.weight, 0);
    return Math.round((doneWeight / totalWeight) * 100);
  }

  // TASKS
  const active = data.tasks.filter((t) => t.status !== "CANCELLED");
  if (active.length === 0) return 0;
  const done = active.filter((t) => t.status === "DONE").length;
  return Math.round((done / active.length) * 100);
}
