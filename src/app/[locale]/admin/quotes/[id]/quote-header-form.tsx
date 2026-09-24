"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updateQuoteHeaderAction } from "@/app/[locale]/admin/quotes/actions";

export function QuoteHeaderForm({
  quoteId,
  canWrite,
  title,
  validUntil,
  introduction,
  terms,
  internalNotes,
  globalDiscountType,
  globalDiscountValue,
  depositPercent,
  depositAmount,
}: {
  quoteId: string;
  canWrite: boolean;
  title: string;
  validUntil: string | null;
  introduction: string | null;
  terms: string | null;
  internalNotes: string | null;
  globalDiscountType: "PERCENT" | "AMOUNT" | null;
  globalDiscountValue: number | null;
  depositPercent: number | null;
  depositAmount: number | null;
}) {
  const t = useTranslations("admin.quotes.detail");
  const router = useRouter();

  const [state, setState] = useState({
    title,
    validUntil: validUntil ?? "",
    introduction: introduction ?? "",
    terms: terms ?? "",
    internalNotes: internalNotes ?? "",
    globalDiscountType: globalDiscountType ?? "",
    globalDiscountValue: globalDiscountValue != null ? String(globalDiscountValue) : "",
    depositPercent: depositPercent != null ? String(depositPercent) : "",
    depositAmount: depositAmount != null ? String(depositAmount) : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <Field label={t("titleField")} value={state.title} />
        {state.validUntil ? <Field label={t("validUntil")} value={state.validUntil} /> : null}
        {state.introduction ? <Field label={t("introduction")} value={state.introduction} multiline /> : null}
        {state.terms ? <Field label={t("terms")} value={state.terms} multiline /> : null}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        const result = await updateQuoteHeaderAction({
          quoteId,
          title: state.title,
          validUntil: state.validUntil || null,
          introduction: state.introduction || null,
          terms: state.terms || null,
          internalNotes: state.internalNotes || null,
          globalDiscountType: state.globalDiscountType ? (state.globalDiscountType as "PERCENT" | "AMOUNT") : null,
          globalDiscountValue: state.globalDiscountValue ? Number(state.globalDiscountValue) : null,
          depositPercent: state.depositPercent ? Number(state.depositPercent) : null,
          depositAmount: state.depositAmount ? Number(state.depositAmount) : null,
        });
        setSubmitting(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="quote-title" className="text-sm font-medium text-foreground">{t("titleField")}</label>
        <input
          id="quote-title"
          required
          value={state.title}
          onChange={(event) => setState((s) => ({ ...s, title: event.target.value }))}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quote-valid-until" className="text-sm font-medium text-foreground">{t("validUntil")}</label>
          <input
            id="quote-valid-until"
            type="date"
            value={state.validUntil}
            onChange={(event) => setState((s) => ({ ...s, validUntil: event.target.value }))}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quote-global-discount-type" className="text-sm font-medium text-foreground">{t("globalDiscountType")}</label>
          <select
            id="quote-global-discount-type"
            value={state.globalDiscountType}
            onChange={(event) => setState((s) => ({ ...s, globalDiscountType: event.target.value }))}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          >
            <option value="">{t("none")}</option>
            <option value="PERCENT">{t("percent")}</option>
            <option value="AMOUNT">{t("amount")}</option>
          </select>
        </div>
      </div>

      {state.globalDiscountType ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quote-global-discount-value" className="text-sm font-medium text-foreground">
            {state.globalDiscountType === "PERCENT" ? t("globalDiscountValuePercent") : t("globalDiscountValueAmount")}
          </label>
          <input
            id="quote-global-discount-value"
            type="number"
            min={0}
            step="0.01"
            dir="ltr"
            value={state.globalDiscountValue}
            onChange={(event) => setState((s) => ({ ...s, globalDiscountValue: event.target.value }))}
            className="h-10 w-40 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quote-deposit-percent" className="text-sm font-medium text-foreground">{t("depositPercent")}</label>
          <input
            id="quote-deposit-percent"
            type="number"
            min={0}
            max={100}
            step="1"
            dir="ltr"
            value={state.depositPercent}
            onChange={(event) => setState((s) => ({ ...s, depositPercent: event.target.value }))}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quote-deposit-amount" className="text-sm font-medium text-foreground">{t("depositAmount")}</label>
          <input
            id="quote-deposit-amount"
            type="number"
            min={0}
            step="0.01"
            dir="ltr"
            value={state.depositAmount}
            onChange={(event) => setState((s) => ({ ...s, depositAmount: event.target.value }))}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quote-introduction" className="text-sm font-medium text-foreground">{t("introduction")}</label>
        <textarea
          id="quote-introduction"
          value={state.introduction}
          onChange={(event) => setState((s) => ({ ...s, introduction: event.target.value }))}
          rows={3}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quote-terms" className="text-sm font-medium text-foreground">{t("terms")}</label>
        <textarea
          id="quote-terms"
          value={state.terms}
          onChange={(event) => setState((s) => ({ ...s, terms: event.target.value }))}
          rows={3}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quote-internal-notes" className="text-sm font-medium text-foreground">{t("internalNotes")}</label>
        <textarea
          id="quote-internal-notes"
          value={state.internalNotes}
          onChange={(event) => setState((s) => ({ ...s, internalNotes: event.target.value }))}
          rows={2}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
        <p className="text-xs text-foreground/70">{t("internalNotesHint")}</p>
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <div>
        <Button type="submit" isLoading={submitting} size="sm">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={multiline ? "flex flex-col gap-1" : "flex items-center justify-between gap-4"}>
      <span className="text-foreground/70">{label}</span>
      <span className={multiline ? "whitespace-pre-wrap text-foreground/80" : "font-medium text-foreground"}>{value}</span>
    </div>
  );
}
