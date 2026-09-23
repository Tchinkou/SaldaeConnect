"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/server/core/money";
import { recordPaymentAction, reversePaymentAction } from "@/app/[locale]/admin/invoices/payments-actions";

type Payment = {
  id: string;
  amount: number;
  paidAt: string;
  methodName: string | null;
  reference: string | null;
  note: string | null;
  status: "RECORDED" | "REVERSED";
  reversalReason: string | null;
};

type PaymentMethod = { id: string; name: string };

const EMPTY_FORM = { amount: "", paidAt: new Date().toISOString().slice(0, 10), methodId: "", reference: "", note: "" };

export function InvoicePayments({
  invoiceId,
  currency,
  canRecord,
  canReverse,
  payments,
  paymentMethods,
}: {
  invoiceId: string;
  currency: string;
  canRecord: boolean;
  canReverse: boolean;
  payments: Payment[];
  paymentMethods: PaymentMethod[];
}) {
  const t = useTranslations("admin.invoices.detail.payment");
  const locale = useLocale();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await recordPaymentAction({
      invoiceId,
      amount: Number(form.amount),
      paidAt: form.paidAt,
      methodId: form.methodId || null,
      reference: form.reference || null,
      note: form.note || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    setForm(EMPTY_FORM);
    router.refresh();
  }

  async function handleReverse(paymentId: string) {
    setSubmitting(true);
    setError(null);
    const result = await reversePaymentAction({ paymentId, reversalReason });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReversingId(null);
    setReversalReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {payments.length === 0 ? (
        <p className="text-sm text-foreground/50">{t("empty")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {payments.map((payment) => (
            <div key={payment.id} className="flex flex-col gap-1 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className={payment.status === "REVERSED" ? "text-foreground/40 line-through" : "font-medium text-foreground"} dir="ltr">
                  {formatMoney(BigInt(Math.round(payment.amount * 100)), currency, locale)}
                </span>
                <span className="text-foreground/60">{payment.paidAt}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-foreground/60">
                {payment.methodName ? <span>{payment.methodName}</span> : null}
                {payment.reference ? <span>· {payment.reference}</span> : null}
                {payment.status === "REVERSED" ? <span className="text-danger-600">· {t("reversed")}</span> : null}
              </div>
              {payment.status === "REVERSED" && payment.reversalReason ? (
                <p className="text-xs text-foreground/50">{t("reversalReasonLabel")}: {payment.reversalReason}</p>
              ) : null}
              {canReverse && payment.status === "RECORDED" ? (
                reversingId === payment.id ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={reversalReason}
                      onChange={(event) => setReversalReason(event.target.value)}
                      placeholder={t("reversalReasonPlaceholder")}
                      className="h-8 w-56 rounded-md border border-border bg-surface px-2 text-xs"
                    />
                    <button
                      type="button"
                      disabled={submitting || !reversalReason.trim()}
                      onClick={() => handleReverse(payment.id)}
                      className="text-xs font-medium text-danger-600 hover:underline disabled:opacity-50"
                    >
                      {t("reverseConfirmYes")}
                    </button>
                    <button type="button" onClick={() => setReversingId(null)} className="text-xs text-foreground/60 hover:underline">
                      {t("cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReversingId(payment.id)}
                    className="mt-1 self-start text-xs font-medium text-danger-600 hover:underline"
                  >
                    {t("reverse")}
                  </button>
                )
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canRecord ? (
        showForm ? (
          <form
            className="flex flex-col gap-3 rounded-md border border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/70">{t("amount")}</label>
                <input
                  type="number"
                  dir="ltr"
                  min={0.01}
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(event) => setForm((f) => ({ ...f, amount: event.target.value }))}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/70">{t("paidAt")}</label>
                <input
                  type="date"
                  required
                  value={form.paidAt}
                  onChange={(event) => setForm((f) => ({ ...f, paidAt: event.target.value }))}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/70">{t("method")}</label>
              <select
                value={form.methodId}
                onChange={(event) => setForm((f) => ({ ...f, methodId: event.target.value }))}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              >
                <option value="">{t("noMethod")}</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/70">{t("reference")}</label>
              <input
                value={form.reference}
                onChange={(event) => setForm((f) => ({ ...f, reference: event.target.value }))}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/70">{t("note")}</label>
              <textarea
                value={form.note}
                onChange={(event) => setForm((f) => ({ ...f, note: event.target.value }))}
                rows={2}
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              />
            </div>

            {error ? <p className="text-sm text-danger-600">{error}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={submitting}>
                {t("record")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div>
            {error ? <p className="mb-2 text-sm text-danger-600">{error}</p> : null}
            <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(true)}>
              {t("record")}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
