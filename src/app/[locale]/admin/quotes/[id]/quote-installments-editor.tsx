"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/server/core/money";
import { addQuoteInstallmentAction, removeQuoteInstallmentAction } from "@/app/[locale]/admin/quotes/actions";

type Installment = {
  id: string;
  label: string;
  percent: number | null;
  amount: number | null;
  trigger: string;
  milestoneKey: string | null;
  dueDate: string | null;
};

const TRIGGERS = ["ON_ACCEPTANCE", "ON_MILESTONE", "ON_DELIVERY", "ON_DATE"] as const;

const EMPTY_FORM = { label: "", percent: "", amount: "", trigger: "ON_ACCEPTANCE" as (typeof TRIGGERS)[number], dueDate: "" };

export function QuoteInstallmentsEditor({
  quoteId,
  currency,
  canWrite,
  installments,
}: {
  quoteId: string;
  currency: string;
  canWrite: boolean;
  installments: Installment[];
}) {
  const t = useTranslations("admin.quotes.detail.installment");
  const locale = useLocale();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await addQuoteInstallmentAction({
      quoteId,
      label: form.label,
      percent: form.percent ? Number(form.percent) : null,
      amount: form.amount ? Number(form.amount) : null,
      trigger: form.trigger,
      dueDate: form.trigger === "ON_DATE" && form.dueDate ? form.dueDate : null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    router.refresh();
  }

  async function handleRemove(installmentId: string) {
    setSubmitting(true);
    const result = await removeQuoteInstallmentAction({ quoteId, installmentId });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {installments.length === 0 ? (
        <p className="text-sm text-foreground/70">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {installments.map((installment) => (
            <li key={installment.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-foreground">{installment.label}</p>
                <p className="text-xs text-foreground/70">
                  {t(`triggerValue.${installment.trigger}`)}
                  {installment.dueDate ? ` · ${installment.dueDate}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground/70" dir="ltr">
                  {installment.percent != null ? `${installment.percent}%` : formatMoney(BigInt(Math.round((installment.amount ?? 0) * 100)), currency, locale)}
                </span>
                {canWrite ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleRemove(installment.id)}
                    className="text-xs font-medium text-danger-600 hover:underline"
                  >
                    {t("remove")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        showForm ? (
          <form
            className="flex flex-col gap-3 rounded-md border border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quote-installment-label" className="text-xs font-medium text-foreground/70">{t("label")}</label>
              <input
                id="quote-installment-label"
                required
                value={form.label}
                onChange={(event) => setForm((f) => ({ ...f, label: event.target.value }))}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quote-installment-percent" className="text-xs font-medium text-foreground/70">{t("percent")}</label>
                <input
                  id="quote-installment-percent"
                  type="number"
                  dir="ltr"
                  min={0}
                  max={100}
                  step="1"
                  value={form.percent}
                  onChange={(event) => setForm((f) => ({ ...f, percent: event.target.value, amount: "" }))}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quote-installment-amount" className="text-xs font-medium text-foreground/70">{t("amount")}</label>
                <input
                  id="quote-installment-amount"
                  type="number"
                  dir="ltr"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((f) => ({ ...f, amount: event.target.value, percent: "" }))}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quote-installment-trigger" className="text-xs font-medium text-foreground/70">{t("trigger")}</label>
                <select
                  id="quote-installment-trigger"
                  value={form.trigger}
                  onChange={(event) => setForm((f) => ({ ...f, trigger: event.target.value as (typeof TRIGGERS)[number] }))}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  {TRIGGERS.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {t(`triggerValue.${trigger}`)}
                    </option>
                  ))}
                </select>
              </div>
              {form.trigger === "ON_DATE" ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="quote-installment-due-date" className="text-xs font-medium text-foreground/70">{t("dueDate")}</label>
                  <input
                    id="quote-installment-due-date"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((f) => ({ ...f, dueDate: event.target.value }))}
                    className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                  />
                </div>
              ) : null}
            </div>

            {error ? <p className="text-sm text-danger-600">{error}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={submitting}>
                {t("addInstallment")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button type="button" size="sm" variant="secondary" onClick={() => setShowForm(true)}>
              {t("addInstallment")}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
