"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateAutoDraftDepositInvoiceAction } from "./invoicing-actions";

export function AutoDraftDepositToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const t = useTranslations("admin.settings.invoicing");
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={enabled}
          disabled={submitting}
          onChange={async (event) => {
            const next = event.target.checked;
            setEnabled(next);
            setSubmitting(true);
            setError(null);
            const result = await updateAutoDraftDepositInvoiceAction({ enabled: next });
            setSubmitting(false);
            if (!result.ok) {
              setEnabled(!next);
              setError(result.error);
              return;
            }
            router.refresh();
          }}
        />
        {t("autoDraftDepositInvoice")}
      </label>
      <p className="text-xs text-foreground/70">{t("autoDraftDepositInvoiceHint")}</p>
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
