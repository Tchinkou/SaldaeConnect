"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updateInvoiceHeaderAction } from "@/app/[locale]/admin/invoices/actions";

export function InvoiceHeaderForm({
  invoiceId,
  canWrite,
  dueDate,
  terms,
  notes,
}: {
  invoiceId: string;
  canWrite: boolean;
  dueDate: string | null;
  terms: string | null;
  notes: string | null;
}) {
  const t = useTranslations("admin.invoices.detail");
  const router = useRouter();

  const [form, setForm] = useState({ dueDate: dueDate ?? "", terms: terms ?? "", notes: notes ?? "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await updateInvoiceHeaderAction({
      invoiceId,
      dueDate: form.dueDate || null,
      terms: form.terms || null,
      notes: form.notes || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!canWrite) {
    return (
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-foreground/60">{t("dueDate")}</dt>
          <dd className="text-foreground">{dueDate ?? "—"}</dd>
        </div>
        {terms ? (
          <div className="sm:col-span-2">
            <dt className="text-foreground/60">{t("terms")}</dt>
            <dd className="whitespace-pre-wrap text-foreground">{terms}</dd>
          </div>
        ) : null}
        {notes ? (
          <div className="sm:col-span-2">
            <dt className="text-foreground/60">{t("notes")}</dt>
            <dd className="whitespace-pre-wrap text-foreground">{notes}</dd>
          </div>
        ) : null}
      </dl>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invoice-due-date" className="text-sm font-medium text-foreground">{t("dueDate")}</label>
        <input
          id="invoice-due-date"
          type="date"
          value={form.dueDate}
          onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
          className="h-10 w-48 rounded-md border border-border bg-surface px-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invoice-terms" className="text-sm font-medium text-foreground">{t("terms")}</label>
        <textarea
          id="invoice-terms"
          value={form.terms}
          onChange={(event) => setForm({ ...form, terms: event.target.value })}
          rows={3}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invoice-notes" className="text-sm font-medium text-foreground">{t("notes")}</label>
        <textarea
          id="invoice-notes"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          rows={3}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" isLoading={submitting} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
