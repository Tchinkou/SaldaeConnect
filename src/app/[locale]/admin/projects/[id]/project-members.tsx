"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { addProjectMemberAction, removeProjectMemberAction } from "@/server/core/projects/actions";

export type ProjectMemberRow = { userId: string; name: string; role: "MANAGER" | "MEMBER" | "VIEWER" };

export function ProjectMembers({
  projectId,
  members,
  staff,
  canWrite,
}: {
  projectId: string;
  members: ProjectMemberRow[];
  staff: Array<{ id: string; name: string }>;
  canWrite: boolean;
}) {
  const t = useTranslations("admin.projects.detail.members");
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"MANAGER" | "MEMBER" | "VIEWER">("MEMBER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableStaff = staff.filter((person) => !members.some((member) => member.userId === person.id));

  return (
    <div className="flex flex-col gap-3">
      {members.length === 0 ? (
        <p className="text-sm text-foreground/50">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between py-2 text-sm">
              <span className="text-foreground">{member.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground/60">{t(`role.${member.role}`)}</span>
                {canWrite ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      setSubmitting(true);
                      await removeProjectMemberAction({ projectId, userId: member.userId });
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

      {canWrite && availableStaff.length > 0 ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!userId) return;
            setSubmitting(true);
            setError(null);
            const result = await addProjectMemberAction({ projectId, userId, role });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setUserId("");
            setRole("MEMBER");
            router.refresh();
          }}
        >
          <select value={userId} onChange={(event) => setUserId(event.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
            <option value="">{t("selectStaff")}</option>
            {availableStaff.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as typeof role)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          >
            {(["MANAGER", "MEMBER", "VIEWER"] as const).map((option) => (
              <option key={option} value={option}>
                {t(`role.${option}`)}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" isLoading={submitting} disabled={!userId}>
            {t("add")}
          </Button>
        </form>
      ) : null}
      {error ? <p className="text-xs text-danger-600">{error}</p> : null}
    </div>
  );
}
