"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { recordTransactionPaymentAction, reverseTransactionPaymentAction } from "@/server/core/transactions/transaction-order-actions";

export type PaymentRow = { id: string; amount: string; currency: string; reference: string | null; status: "RECORDED" | "REVERSED"; paidAt: string };

export function TransactionPaymentsPanel({ orderId, canRecord, payments }: { orderId: string; canRecord: boolean; payments: PaymentRow[] }) {
  const t = useTranslations("admin.transactions.detail");
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setSubmitting(true);
    setError(null);
    const result = await recordTransactionPaymentAction({ orderId, amount: Number(amount), methodId: null, reference: reference || null });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAmount("");
    setReference("");
    router.refresh();
  }

  async function reverse(paymentId: string) {
    const reversalReason = window.prompt(t("reversalReasonPrompt"));
    if (!reversalReason) return;
    setSubmitting(true);
    setError(null);
    const result = await reverseTransactionPaymentAction({ paymentId, reversalReason });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {payments.map((payment) => (
          <li key={payment.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div>
              <span dir="ltr" className="font-medium text-foreground">
                {payment.amount} {payment.currency}
              </span>
              {payment.reference ? <span className="ms-2 text-xs text-foreground/70">{payment.reference}</span> : null}
              {payment.status === "REVERSED" ? (
                <Badge tone="neutral" className="ms-2">
                  {t("reversed")}
                </Badge>
              ) : null}
            </div>
            {payment.status === "RECORDED" ? (
              <Button size="sm" variant="ghost" onClick={() => reverse(payment.id)} disabled={submitting}>
                {t("reverse")}
              </Button>
            ) : null}
          </li>
        ))}
        {payments.length === 0 ? <p className="py-2 text-sm text-foreground/70">{t("noPayments")}</p> : null}
      </ul>

      {canRecord ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            placeholder={t("amount")}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-9 w-32 rounded-md border border-border bg-surface px-2 text-sm"
          />
          <input
            placeholder={t("reference")}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
          />
          <Button size="sm" isLoading={submitting} onClick={record} disabled={!amount}>
            {t("recordPayment")}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
    </div>
  );
}
