"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updatePaymentMethodAction } from "./invoicing-actions";

export type PaymentMethodRow = {
  id: string;
  key: string;
  isActive: boolean;
  translations: { fr: string; en: string; ar: string };
};

const inputClass =
  "h-9 rounded-md border border-border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

export function PaymentMethodsForm({ methods }: { methods: PaymentMethodRow[] }) {
  const t = useTranslations("admin.settings.paymentMethods");
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ fr: "", en: "", ar: "", isActive: true });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(method: PaymentMethodRow) {
    setEditingId(method.id);
    setDraft({ ...method.translations, isActive: method.isActive });
  }

  async function save(id: string) {
    setSubmitting(true);
    setError(null);
    const result = await updatePaymentMethodAction({
      paymentMethodId: id,
      isActive: draft.isActive,
      translations: { fr: draft.fr, en: draft.en, ar: draft.ar },
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-border">
        {methods.map((method) =>
          editingId === method.id ? (
            <li key={method.id} className="flex flex-col gap-2 py-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  placeholder="FR"
                  value={draft.fr}
                  onChange={(event) => setDraft({ ...draft, fr: event.target.value })}
                  className={inputClass}
                />
                <input
                  placeholder="EN"
                  value={draft.en}
                  onChange={(event) => setDraft({ ...draft, en: event.target.value })}
                  className={inputClass}
                />
                <input
                  placeholder="AR"
                  value={draft.ar}
                  onChange={(event) => setDraft({ ...draft, ar: event.target.value })}
                  className={inputClass}
                  dir="rtl"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
                />
                {t("active")}
              </label>
              <div className="flex gap-2">
                <Button size="sm" isLoading={submitting} onClick={() => save(method.id)}>
                  {t("save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  {t("cancel")}
                </Button>
              </div>
            </li>
          ) : (
            <li key={method.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <span className="font-medium text-foreground">{method.translations.fr}</span>
                {!method.isActive ? (
                  <Badge tone="neutral" className="ms-2">
                    {t("inactive")}
                  </Badge>
                ) : null}
              </div>
              <Button size="sm" variant="ghost" onClick={() => startEdit(method)}>
                {t("edit")}
              </Button>
            </li>
          ),
        )}
      </ul>

      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
