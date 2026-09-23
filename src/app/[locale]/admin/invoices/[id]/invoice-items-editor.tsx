"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/server/core/money";
import { addInvoiceItemAction, updateInvoiceItemAction, removeInvoiceItemAction } from "@/app/[locale]/admin/invoices/actions";

type Item = {
  id: string;
  serviceId: string | null;
  title: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discountPercent: number;
  taxRateId: string | null;
  taxRatePercent: number | null;
  lineTotal: number;
};

type TaxRate = { id: string; name: string; ratePercent: number };
type Service = { id: string; name: string; indicativePrice: number | null; indicativeCurrency: string | null };

const EMPTY_FORM = {
  serviceId: "",
  title: "",
  description: "",
  quantity: "1",
  unit: "",
  unitPrice: "0",
  discountPercent: "0",
  taxRateId: "",
};

export function InvoiceItemsEditor({
  invoiceId,
  currency,
  canWrite,
  items,
  taxRates,
  services,
}: {
  invoiceId: string;
  currency: string;
  canWrite: boolean;
  items: Item[];
  taxRates: TaxRate[];
  services: Service[];
}) {
  const t = useTranslations("admin.invoices.detail.item");
  const locale = useLocale();
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError(null);
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setForm({
      serviceId: item.serviceId ?? "",
      title: item.title,
      description: item.description ?? "",
      quantity: String(item.quantity),
      unit: item.unit ?? "",
      unitPrice: String(item.unitPrice),
      discountPercent: String(item.discountPercent),
      taxRateId: item.taxRateId ?? "",
    });
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const payload = {
      invoiceId,
      serviceId: form.serviceId || null,
      title: form.title,
      description: form.description || null,
      quantity: Number(form.quantity),
      unit: form.unit || null,
      unitPrice: Number(form.unitPrice),
      discountPercent: Number(form.discountPercent),
      taxRateId: form.taxRateId || null,
    };
    const result = editingId ? await updateInvoiceItemAction({ ...payload, itemId: editingId }) : await addInvoiceItemAction(payload);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    router.refresh();
  }

  async function handleRemove(itemId: string) {
    setSubmitting(true);
    const result = await removeInvoiceItemAction({ invoiceId, itemId });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-foreground/50">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs font-medium uppercase tracking-wide text-foreground/60">
              <tr>
                <th className="px-2 py-2 text-start">{t("titleColumn")}</th>
                <th className="px-2 py-2 text-end">{t("quantity")}</th>
                <th className="px-2 py-2 text-end">{t("unitPrice")}</th>
                <th className="px-2 py-2 text-end">{t("discount")}</th>
                <th className="px-2 py-2 text-end">{t("tax")}</th>
                <th className="px-2 py-2 text-end">{t("lineTotal")}</th>
                {canWrite ? <th className="px-2 py-2" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-2 py-2">
                    <p className="font-medium text-foreground">{item.title}</p>
                    {item.description ? <p className="text-xs text-foreground/50">{item.description}</p> : null}
                  </td>
                  <td className="px-2 py-2 text-end text-foreground/70" dir="ltr">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ""}
                  </td>
                  <td className="px-2 py-2 text-end text-foreground/70" dir="ltr">
                    {formatMoney(BigInt(Math.round(item.unitPrice * 100)), currency, locale)}
                  </td>
                  <td className="px-2 py-2 text-end text-foreground/70" dir="ltr">
                    {item.discountPercent > 0 ? `-${item.discountPercent}%` : "—"}
                  </td>
                  <td className="px-2 py-2 text-end text-foreground/70" dir="ltr">
                    {item.taxRatePercent != null ? `${item.taxRatePercent}%` : "—"}
                  </td>
                  <td className="px-2 py-2 text-end font-medium text-foreground" dir="ltr">
                    {formatMoney(BigInt(Math.round(item.lineTotal * 100)), currency, locale)}
                  </td>
                  {canWrite ? (
                    <td className="px-2 py-2 text-end">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => startEdit(item)} className="text-xs font-medium text-brand-600 hover:underline">
                          {t("edit")}
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleRemove(item.id)}
                          className="text-xs font-medium text-danger-600 hover:underline"
                        >
                          {t("remove")}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            {services.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/70">{t("service")}</label>
                <select
                  value={form.serviceId}
                  onChange={(event) => {
                    const service = services.find((s) => s.id === event.target.value);
                    setForm((f) => ({
                      ...f,
                      serviceId: event.target.value,
                      title: service ? service.name : f.title,
                      unitPrice:
                        service && service.indicativePrice != null && service.indicativeCurrency === currency
                          ? String(service.indicativePrice)
                          : f.unitPrice,
                    }));
                  }}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                >
                  <option value="">{t("noService")}</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/70">{t("titleColumn")}</label>
              <input
                required
                value={form.title}
                onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/70">{t("description")}</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
                rows={2}
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField label={t("quantity")} value={form.quantity} onChange={(v) => setForm((f) => ({ ...f, quantity: v }))} min={0.01} step="0.01" />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground/70">{t("unit")}</label>
                <input
                  value={form.unit}
                  onChange={(event) => setForm((f) => ({ ...f, unit: event.target.value }))}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                />
              </div>
              <NumberField label={t("unitPrice")} value={form.unitPrice} onChange={(v) => setForm((f) => ({ ...f, unitPrice: v }))} min={0} step="0.01" />
              <NumberField
                label={t("discount")}
                value={form.discountPercent}
                onChange={(v) => setForm((f) => ({ ...f, discountPercent: v }))}
                min={0}
                max={100}
                step="1"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground/70">{t("tax")}</label>
              <select
                value={form.taxRateId}
                onChange={(event) => setForm((f) => ({ ...f, taxRateId: event.target.value }))}
                className="h-9 w-48 rounded-md border border-border bg-surface px-2 text-sm"
              >
                <option value="">{t("noTax")}</option>
                {taxRates.map((rate) => (
                  <option key={rate.id} value={rate.id}>
                    {rate.name} ({rate.ratePercent}%)
                  </option>
                ))}
              </select>
              {taxRates.length === 0 ? <p className="text-xs text-foreground/50">{t("noTaxRatesHint")}</p> : null}
            </div>

            {error ? <p className="text-sm text-danger-600">{error}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={submitting}>
                {editingId ? t("saveEdit") : t("addItem")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div>
            <Button type="button" size="sm" variant="secondary" onClick={startAdd}>
              {t("addItem")}
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground/70">{label}</label>
      <input
        type="number"
        dir="ltr"
        min={min}
        max={max}
        step={step}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
      />
    </div>
  );
}
