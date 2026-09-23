"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updateProjectProgressModeAction } from "@/server/core/projects/actions";

type ProgressMode = "TASKS" | "MILESTONES" | "MANUAL";

export function ProjectProgressMode({
  projectId,
  currentMode,
  currentManual,
  currentProgress,
  canWrite,
}: {
  projectId: string;
  currentMode: ProgressMode;
  currentManual: number | null;
  currentProgress: number;
  canWrite: boolean;
}) {
  const t = useTranslations("admin.projects.detail.progress");
  const router = useRouter();
  const [mode, setMode] = useState<ProgressMode>(currentMode);
  const [manual, setManual] = useState(String(currentManual ?? currentProgress));
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3" dir="ltr">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${currentProgress}%` }} />
        </div>
        <span className="text-sm font-semibold text-foreground">{currentProgress}%</span>
      </div>

      {canWrite ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            await updateProjectProgressModeAction({
              projectId,
              progressMode: mode,
              progressManual: mode === "MANUAL" ? Number(manual) || 0 : null,
            });
            setSubmitting(false);
            router.refresh();
          }}
        >
          <select value={mode} onChange={(event) => setMode(event.target.value as ProgressMode)} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
            {(["TASKS", "MILESTONES", "MANUAL"] as const).map((option) => (
              <option key={option} value={option}>
                {t(`mode.${option}`)}
              </option>
            ))}
          </select>
          {mode === "MANUAL" ? (
            <input
              type="number"
              dir="ltr"
              min={0}
              max={100}
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              className="h-9 w-20 rounded-md border border-border bg-surface px-2 text-sm"
            />
          ) : null}
          <Button type="submit" size="sm" isLoading={submitting}>
            {t("save")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
