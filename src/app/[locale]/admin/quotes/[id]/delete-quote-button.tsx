"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteQuoteAction } from "@/app/[locale]/admin/quotes/actions";

export function DeleteQuoteButton({ quoteId, clientId }: { quoteId: string; clientId: string }) {
  const t = useTranslations("admin.quotes.detail");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-danger-600 hover:underline">
        {t("delete")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-foreground/70">{t("deleteConfirm")}</span>
      <button
        type="button"
        disabled={submitting}
        onClick={async () => {
          setSubmitting(true);
          const result = await deleteQuoteAction({ quoteId });
          if (!result.ok) {
            setSubmitting(false);
            return;
          }
          router.push(`/admin/clients/${clientId}`);
          router.refresh();
        }}
        className="font-medium text-danger-600 hover:underline"
      >
        {t("deleteConfirmYes")}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-foreground/60 hover:underline">
        {t("cancel")}
      </button>
    </div>
  );
}
