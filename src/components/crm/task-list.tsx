"use client";

import { useTransition } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { updateTaskStatusAction } from "@/server/core/crm/task-actions";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueAt: string | null;
  assigneeName: string | null;
};

const PRIORITY_TONE = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "danger" } as const;

export function TaskList({ tasks }: { tasks: TaskRow[] }) {
  const t = useTranslations("admin.crm.task");
  const format = useFormatter();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (tasks.length === 0) {
    return <p className="text-sm text-foreground/50">{t("empty")}</p>;
  }

  const now = new Date();

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => {
        const overdue = task.dueAt && task.status !== "DONE" && task.status !== "CANCELLED" && new Date(task.dueAt) < now;
        return (
          <li key={task.id} className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
            <input
              type="checkbox"
              checked={task.status === "DONE"}
              disabled={isPending}
              onChange={(event) => {
                startTransition(async () => {
                  await updateTaskStatusAction({ id: task.id, status: event.target.checked ? "DONE" : "TODO" });
                  router.refresh();
                });
              }}
              className="h-4 w-4 rounded border-border"
            />
            <div className="flex-1">
              <p className={`text-sm font-medium ${task.status === "DONE" ? "text-foreground/40 line-through" : "text-foreground"}`}>
                {task.title}
              </p>
              {task.description ? <p className="text-xs text-foreground/60">{task.description}</p> : null}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/50">
                <Badge tone={PRIORITY_TONE[task.priority]}>{t(`priority.${task.priority}`)}</Badge>
                {task.dueAt ? (
                  <span className={overdue ? "font-medium text-danger-600" : undefined}>
                    {format.dateTime(new Date(task.dueAt), { dateStyle: "medium" })}
                  </span>
                ) : null}
                {task.assigneeName ? <span>{t("assignedTo", { name: task.assigneeName })}</span> : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
