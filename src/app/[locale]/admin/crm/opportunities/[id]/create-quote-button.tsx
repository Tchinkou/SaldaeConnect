"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createQuoteAction } from "@/app/[locale]/admin/quotes/actions";

export function CreateQuoteButton({ opportunityId }: { opportunityId: string }) {
  const t = useTranslations("admin.crm.opportunity");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="sm"
        isLoading={submitting}
        onClick={async () => {
          setSubmitting(true);
          setError(null);
          const result = await createQuoteAction({ opportunityId });
          if (!result.ok) {
            setSubmitting(false);
            setError(result.error);
            return;
          }
          router.push(`/admin/quotes/${result.data.quoteId}`);
          router.refresh();
        }}
      >
        {t("createQuote")}
      </Button>
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
