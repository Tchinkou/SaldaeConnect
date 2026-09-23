"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/server/core/action";

export function OwnerReassignSelect({
  id,
  currentOwnerId,
  staff,
  action,
}: {
  id: string;
  currentOwnerId: string | null;
  staff: Array<{ id: string; name: string }>;
  action: (input: { id: string; ownerId: string | null }) => Promise<ActionResult<{ id: string }>>;
}) {
  const t = useTranslations("admin.crm.common");
  const router = useRouter();
  const [value, setValue] = useState(currentOwnerId ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={isPending}
        onChange={(event) => {
          const ownerId = event.target.value || null;
          setValue(event.target.value);
          setError(null);
          startTransition(async () => {
            const result = await action({ id, ownerId });
            if (!result.ok) {
              setError(result.error);
              setValue(currentOwnerId ?? "");
            } else {
              router.refresh();
            }
          });
        }}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
      >
        <option value="">{t("unassigned")}</option>
        {staff.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-danger-600">{error}</span> : null}
    </div>
  );
}
