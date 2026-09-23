"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateClientStatusAction } from "@/app/[locale]/admin/clients/[id]/actions";

type ClientStatus = "PROSPECT" | "ACTIVE" | "INACTIVE";

export function ClientStatusSelect({ id, status }: { id: string; status: ClientStatus }) {
  const t = useTranslations("admin.crm.clients");
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={isPending}
        onChange={(event) => {
          const next = event.target.value as ClientStatus;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await updateClientStatusAction({ id, status: next });
            if (!result.ok) {
              setError(result.error);
              setValue(status);
            } else {
              router.refresh();
            }
          });
        }}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
      >
        <option value="PROSPECT">{t("statusValue.PROSPECT")}</option>
        <option value="ACTIVE">{t("statusValue.ACTIVE")}</option>
        <option value="INACTIVE">{t("statusValue.INACTIVE")}</option>
      </select>
      {error ? <span className="text-xs text-danger-600">{error}</span> : null}
    </div>
  );
}
