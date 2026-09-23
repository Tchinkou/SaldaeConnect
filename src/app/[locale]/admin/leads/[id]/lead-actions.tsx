"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { convertLeadToClientAction } from "@/server/core/crm/convert";
import { disqualifyLeadAction } from "@/app/[locale]/admin/leads/[id]/actions";

export function LeadActions({ leadId, canConvert }: { leadId: string; canConvert: boolean }) {
  const t = useTranslations("admin.crm.lead");
  const router = useRouter();
  const [converting, setConverting] = useState(false);
  const [disqualifying, setDisqualifying] = useState(false);
  const [showDisqualifyForm, setShowDisqualifyForm] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [convertedClientId, setConvertedClientId] = useState<string | null>(null);

  if (!canConvert) return null;

  if (convertedClientId) {
    return (
      <Link href={`/admin/clients/${convertedClientId}`} className="text-sm font-medium text-brand-600 hover:underline">
        {t("viewClient")}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          isLoading={converting}
          onClick={async () => {
            setConverting(true);
            setError(null);
            const result = await convertLeadToClientAction({ leadId });
            setConverting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setConvertedClientId(result.data.clientId);
            router.refresh();
          }}
        >
          {t("convert")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setShowDisqualifyForm((v) => !v)}>
          {t("disqualify")}
        </Button>
      </div>
      {showDisqualifyForm ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("disqualifyReasonPlaceholder")}
            rows={2}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          />
          <div>
            <Button
              type="button"
              variant="danger"
              isLoading={disqualifying}
              disabled={!reason.trim()}
              onClick={async () => {
                setDisqualifying(true);
                setError(null);
                const result = await disqualifyLeadAction({ id: leadId, reason });
                setDisqualifying(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setShowDisqualifyForm(false);
                router.refresh();
              }}
              size="sm"
            >
              {t("confirmDisqualify")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
