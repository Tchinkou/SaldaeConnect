"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { sendQuoteAction } from "@/app/[locale]/admin/quotes/actions";

export function SendQuoteButton({ quoteId }: { quoteId: string }) {
  const t = useTranslations("admin.quotes.detail");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <Button type="button" size="sm" onClick={() => setConfirming(true)}>
        {t("send")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-foreground/70">{t("sendConfirm")}</span>
        <Button
          type="button"
          size="sm"
          isLoading={submitting}
          onClick={async () => {
            setSubmitting(true);
            setError(null);
            const result = await sendQuoteAction({ quoteId });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          }}
        >
          {t("sendConfirmYes")}
        </Button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={submitting}
          className="text-foreground/60 hover:underline"
        >
          {t("cancel")}
        </button>
      </div>
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
