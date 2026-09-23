"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { upsertTaxRateAction, deleteTaxRateAction } from "./invoicing-actions";

export type TaxRateRow = {
  id: string;
  name: string;
  ratePercent: string;
  legalMentionFr: string | null;
  legalMentionEn: string | null;
  legalMentionAr: string | null;
  isDefault: boolean;
  isActive: boolean;
};

const inputClass =
  "h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

type Draft = {
  name: string;
  ratePercent: string;
  legalMentionFr: string;
  isDefault: boolean;
  isActive: boolean;
};

const emptyDraft: Draft = { name: "", ratePercent: "", legalMentionFr: "", isDefault: false, isActive: true };

export function TaxRatesForm({ rates }: { rates: TaxRateRow[] }) {
  const t = useTranslations("admin.settings.taxRates");
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(rate: TaxRateRow) {
    setEditingId(rate.id);
    setDraft({
      name: rate.name,
      ratePercent: rate.ratePercent,
      legalMentionFr: rate.legalMentionFr ?? "",
      isDefault: rate.isDefault,
      isActive: rate.isActive,
    });
  }

  async function save(id: string | undefined, source: Draft) {
    setSubmitting(true);
    setError(null);
    const result = await upsertTaxRateAction({
      id,
      name: source.name,
      ratePercent: Number(source.ratePercent),
      legalMentionFr: source.legalMentionFr || null,
      legalMentionEn: null,
      legalMentionAr: null,
      isDefault: source.isDefault,
      isActive: source.isActive,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    setCreating(false);
    setNewDraft(emptyDraft);
    router.refresh();
  }

  async function remove(id: string) {
    setSubmitting(true);
    setError(null);
    const result = await deleteTaxRateAction({ taxRateId: id });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {rates.length === 0 && !creating ? <p className="text-sm text-foreground/50">{t("empty")}</p> : null}

      <ul className="flex flex-col divide-y divide-border">
        {rates.map((rate) =>
          editingId === rate.id ? (
            <li key={rate.id} className="flex flex-col gap-2 py-3">
              <DraftFields draft={draft} setDraft={setDraft} t={t} />
              <div className="flex gap-2">
                <Button size="sm" isLoading={submitting} onClick={() => save(rate.id, draft)}>
                  {t("save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  {t("cancel")}
                </Button>
              </div>
            </li>
          ) : (
            <li key={rate.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <span className="font-medium text-foreground">{rate.name}</span>
                <span className="ms-2 text-foreground/60" dir="ltr">
                  {rate.ratePercent}%
                </span>
                {rate.isDefault ? (
                  <Badge tone="info" className="ms-2">
                    {t("default")}
                  </Badge>
                ) : null}
                {!rate.isActive ? (
                  <Badge tone="neutral" className="ms-2">
                    {t("inactive")}
                  </Badge>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => startEdit(rate)}>
                  {t("edit")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(rate.id)} isLoading={submitting}>
                  {t("remove")}
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>

      {creating ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <DraftFields draft={newDraft} setDraft={setNewDraft} t={t} />
          <div className="flex gap-2">
            <Button size="sm" isLoading={submitting} onClick={() => save(undefined, newDraft)}>
              {t("add")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="self-start" onClick={() => setCreating(true)}>
          {t("add")}
        </Button>
      )}

      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DraftFields({
  draft,
  setDraft,
  t,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input
        placeholder={t("name")}
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        className={inputClass}
      />
      <input
        type="number"
        min={0}
        max={100}
        step="0.01"
        placeholder={t("ratePercent")}
        value={draft.ratePercent}
        onChange={(event) => setDraft({ ...draft, ratePercent: event.target.value })}
        className={inputClass}
      />
      <input
        placeholder={t("legalMention")}
        value={draft.legalMentionFr}
        onChange={(event) => setDraft({ ...draft, legalMentionFr: event.target.value })}
        className={`${inputClass} sm:col-span-2`}
      />
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={draft.isDefault}
          onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })}
        />
        {t("default")}
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
        />
        {t("active")}
      </label>
    </div>
  );
}
