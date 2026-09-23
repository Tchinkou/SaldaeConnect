"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { addTaskAction } from "@/server/core/crm/task-actions";

export function AddTaskForm({
  opportunityId,
  clientId,
  staff,
}: {
  opportunityId?: string;
  clientId?: string;
  staff: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("admin.crm.task");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        const result = await addTaskAction({
          title,
          dueAt: dueAt || null,
          priority,
          assigneeId: assigneeId || null,
          opportunityId,
          clientId,
        });
        setSubmitting(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setTitle("");
        setDueAt("");
        setPriority("MEDIUM");
        setAssigneeId("");
        router.refresh();
      }}
    >
      <input
        type="text"
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("titlePlaceholder")}
        className="h-9 min-w-40 flex-1 rounded-md border border-border bg-surface px-2 text-sm"
      />
      <input
        type="date"
        dir="ltr"
        value={dueAt}
        onChange={(event) => setDueAt(event.target.value)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
      />
      <select
        value={priority}
        onChange={(event) => setPriority(event.target.value as typeof priority)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
      >
        {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((option) => (
          <option key={option} value={option}>
            {t(`priority.${option}`)}
          </option>
        ))}
      </select>
      <select
        value={assigneeId}
        onChange={(event) => setAssigneeId(event.target.value)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
      >
        <option value="">{t("unassigned")}</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      <Button type="submit" isLoading={submitting} size="sm">
        {t("add")}
      </Button>
      {error ? <p className="w-full text-xs text-danger-600">{error}</p> : null}
    </form>
  );
}
