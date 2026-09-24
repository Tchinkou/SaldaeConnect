"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updateTransactionOrderStatusAction } from "@/server/core/transactions/transaction-order-actions";

const TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["PRICE_CONFIRMED", "CANCELLED"],
  PRICE_CONFIRMED: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

type StatusValue = "REQUESTED" | "PRICE_CONFIRMED" | "AWAITING_PAYMENT" | "PAID" | "COMPLETED" | "CANCELLED";

export function TransactionOrderStatusControl({ orderId, currentStatus, currentTotal }: { orderId: string; currentStatus: StatusValue; currentTotal: string }) {
  const t = useTranslations("admin.transactions.detail");
  const router = useRouter();
  const options = TRANSITIONS[currentStatus] ?? [];
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<StatusValue>((options[0] as StatusValue) ?? currentStatus);
  const [note, setNote] = useState("");
  const [total, setTotal] = useState(currentTotal);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) return null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          // `status` n'est initialisé qu'au montage : comme ce composant
          // n'est pas démonté entre deux ouvertures, une réouverture après
          // un premier changement de statut gardait la valeur précédente
          // (ex: soumission de PRICE_CONFIRMED une seconde fois, rejetée
          // par le serveur comme transition non autorisée vers elle-même,
          // alors que le <select> affichait visuellement la bonne option
          // par défaut du navigateur faute de correspondance de `value`).
          setStatus((options[0] as StatusValue) ?? currentStatus);
          setEditing(true);
        }}
        className="text-xs font-medium text-brand-600 hover:underline"
      >
        {t("changeStatus")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <select value={status} onChange={(event) => setStatus(event.target.value as StatusValue)} className="h-9 rounded-md border border-border bg-surface px-2 text-sm">
        {options.map((option) => (
          <option key={option} value={option}>
            {t(`statusValue.${option}`)}
          </option>
        ))}
      </select>

      {status === "PRICE_CONFIRMED" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="transaction-confirmed-total" className="text-xs font-medium text-foreground/70">{t("confirmedTotal")}</label>
          <input id="transaction-confirmed-total" type="number" dir="ltr" value={total} onChange={(event) => setTotal(event.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-sm" />
        </div>
      ) : null}

      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("statusNotePlaceholder")} rows={2} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm" />
      {error ? <p className="text-xs text-danger-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          isLoading={submitting}
          onClick={async () => {
            setSubmitting(true);
            setError(null);
            const result = await updateTransactionOrderStatusAction({
              orderId,
              status,
              note: note || null,
              total: status === "PRICE_CONFIRMED" ? Number(total) : null,
            });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setEditing(false);
            setNote("");
            router.refresh();
          }}
        >
          {t("confirmStatus")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={submitting}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
