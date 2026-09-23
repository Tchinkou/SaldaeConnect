"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cancelInvoiceAction } from "@/app/[locale]/admin/invoices/actions";

export function CancelInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("admin.invoices.detail");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-danger-600 hover:underline">
        {t("cancelInvoice")}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 text-sm">
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("cancelReasonPlaceholder")}
          className="h-9 w-56 rounded-md border border-border bg-surface px-2 text-sm"
        />
        <Button
          type="button"
          size="sm"
          isLoading={submitting}
          disabled={!reason.trim()}
          onClick={async () => {
            setSubmitting(true);
            setError(null);
            const result = await cancelInvoiceAction({ invoiceId, cancelReason: reason });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          }}
        >
          {t("cancelInvoiceConfirmYes")}
        </Button>
        <button type="button" onClick={() => setOpen(false)} disabled={submitting} className="text-foreground/60 hover:underline">
          {t("cancel")}
        </button>
      </div>
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
