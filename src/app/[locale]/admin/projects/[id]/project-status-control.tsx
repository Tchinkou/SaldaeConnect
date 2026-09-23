"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updateProjectStatusAction } from "@/server/core/projects/actions";

const STATUSES = ["PLANNING", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW", "COMPLETED", "ARCHIVED"] as const;
type ProjectStatusValue = (typeof STATUSES)[number];

export function ProjectStatusControl({ projectId, currentStatus }: { projectId: string; currentStatus: ProjectStatusValue }) {
  const t = useTranslations("admin.projects.detail");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<ProjectStatusValue>(currentStatus);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-brand-600 hover:underline">
        {t("changeStatus")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value as ProjectStatusValue)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
      >
        {STATUSES.map((option) => (
          <option key={option} value={option}>
            {t(`statusValue.${option}`)}
          </option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("statusNotePlaceholder")}
        rows={2}
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      />
      {error ? <p className="text-xs text-danger-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          isLoading={submitting}
          onClick={async () => {
            setSubmitting(true);
            setError(null);
            const result = await updateProjectStatusAction({ projectId, status, note: note || null });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setEditing(false);
            setNote("");
            router.refresh();
          }}
        >
          {t("confirmStatus")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={submitting}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
