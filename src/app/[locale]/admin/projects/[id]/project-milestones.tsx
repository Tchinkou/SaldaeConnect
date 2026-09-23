"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addMilestoneAction, removeMilestoneAction, updateMilestoneStatusAction } from "@/server/core/projects/actions";

export type MilestoneRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  weight: number;
};

const STATUS_TONE = { TODO: "neutral", IN_PROGRESS: "info", DONE: "success", CANCELLED: "danger" } as const;

export function ProjectMilestones({ projectId, milestones, canWrite }: { projectId: string; milestones: MilestoneRow[]; canWrite: boolean }) {
  const t = useTranslations("admin.projects.detail.milestone");
  const format = useFormatter();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [weight, setWeight] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {milestones.length === 0 ? (
        <p className="text-sm text-foreground/50">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {milestones.map((milestone) => (
            <li key={milestone.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="flex-1">
                <p className="font-medium text-foreground">{milestone.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground/50">
                  {milestone.dueDate ? <span>{format.dateTime(new Date(milestone.dueDate), { dateStyle: "medium" })}</span> : null}
                  <span>{t("weightDisplay", { weight: milestone.weight })}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canWrite ? (
                  <select
                    value={milestone.status}
                    disabled={submitting}
                    onChange={async (event) => {
                      setSubmitting(true);
                      await updateMilestoneStatusAction({ milestoneId: milestone.id, status: event.target.value as MilestoneRow["status"] });
                      setSubmitting(false);
                      router.refresh();
                    }}
                    className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
                  >
                    {(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const).map((option) => (
                      <option key={option} value={option}>
                        {t(`statusValue.${option}`)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={STATUS_TONE[milestone.status]}>{t(`statusValue.${milestone.status}`)}</Badge>
                )}
                {canWrite ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      await removeMilestoneAction({ milestoneId: milestone.id });
                      setSubmitting(false);
                      router.refresh();
                    }}
                    className="text-xs font-medium text-danger-600 hover:underline"
                  >
                    {t("remove")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        showForm ? (
          <form
            className="flex flex-col gap-3 rounded-md border border-border p-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSubmitting(true);
              setError(null);
              const result = await addMilestoneAction({
                projectId,
                title,
                dueDate: dueDate || null,
                weight: Number(weight) || 1,
              });
              setSubmitting(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setTitle("");
              setDueDate("");
              setWeight("1");
              setShowForm(false);
              router.refresh();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/70">{t("title")}</label>
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/70">{t("dueDate")}</label>
                <input
                  type="date"
                  dir="ltr"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/70">{t("weight")}</label>
                <input
                  type="number"
                  dir="ltr"
                  min={1}
                  max={100}
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                />
              </div>
            </div>
            {error ? <p className="text-sm text-danger-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={submitting}>
                {t("add")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(true)}>
              {t("add")}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
