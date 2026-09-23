"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createCreditNoteAction } from "@/app/[locale]/admin/invoices/actions";

export function CreateCreditNoteButton({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations("admin.invoices.detail");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        isLoading={submitting}
        onClick={async () => {
          setSubmitting(true);
          setError(null);
          const result = await createCreditNoteAction({ invoiceId });
          setSubmitting(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/admin/invoices/${result.data.invoiceId}`);
          router.refresh();
        }}
      >
        {t("createCreditNote")}
      </Button>
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
