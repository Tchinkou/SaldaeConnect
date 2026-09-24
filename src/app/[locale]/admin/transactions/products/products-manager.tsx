"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { upsertProductAction, recordStockMovementAction } from "@/server/core/transactions/product-actions";

const PRODUCT_KINDS = ["CURRENCY", "PREPAID_CARD", "PAYSERA", "OTHER"] as const;
type ProductKind = (typeof PRODUCT_KINDS)[number];

type TranslationDraft = { name: string; description: string };

export type ProductRow = {
  id: string;
  kind: ProductKind;
  sku: string;
  unit: string | null;
  trackStock: boolean;
  isActive: boolean;
  currentPrice: string;
  currentCurrency: string;
  minQuantity: number | null;
  maxQuantity: number | null;
  stockLevel: string | null;
  name: string;
  translations: { fr: TranslationDraft; en: TranslationDraft; ar: TranslationDraft };
};

type Draft = {
  kind: ProductKind;
  sku: string;
  unit: string;
  trackStock: boolean;
  isActive: boolean;
  currentPrice: string;
  currentCurrency: string;
  minQuantity: string;
  maxQuantity: string;
  translations: { fr: TranslationDraft; en: TranslationDraft; ar: TranslationDraft };
};

const inputClass =
  "h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

const emptyDraft: Draft = {
  kind: "CURRENCY",
  sku: "",
  unit: "",
  trackStock: false,
  isActive: true,
  currentPrice: "",
  currentCurrency: "DZD",
  minQuantity: "",
  maxQuantity: "",
  translations: { fr: { name: "", description: "" }, en: { name: "", description: "" }, ar: { name: "", description: "" } },
};

function toDraft(product: ProductRow): Draft {
  return {
    kind: product.kind,
    sku: product.sku,
    unit: product.unit ?? "",
    trackStock: product.trackStock,
    isActive: product.isActive,
    currentPrice: product.currentPrice,
    currentCurrency: product.currentCurrency,
    minQuantity: product.minQuantity !== null ? String(product.minQuantity) : "",
    maxQuantity: product.maxQuantity !== null ? String(product.maxQuantity) : "",
    translations: product.translations,
  };
}

export function ProductsManager({ products }: { products: ProductRow[] }) {
  const t = useTranslations("admin.products");
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movementProductId, setMovementProductId] = useState<string | null>(null);
  const [movement, setMovement] = useState({ type: "IN" as "IN" | "OUT" | "ADJUSTMENT", quantity: "", note: "" });

  async function save(id: string | undefined, source: Draft) {
    setSubmitting(true);
    setError(null);
    const result = await upsertProductAction({
      id,
      kind: source.kind,
      sku: source.sku,
      unit: source.unit || null,
      trackStock: source.trackStock,
      isActive: source.isActive,
      currentPrice: Number(source.currentPrice),
      currentCurrency: source.currentCurrency,
      minQuantity: source.minQuantity ? Number(source.minQuantity) : null,
      maxQuantity: source.maxQuantity ? Number(source.maxQuantity) : null,
      translations: source.translations,
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

  async function submitMovement(productId: string) {
    setSubmitting(true);
    setError(null);
    const result = await recordStockMovementAction({
      productId,
      type: movement.type,
      quantity: Number(movement.quantity),
      reference: null,
      note: movement.note || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMovementProductId(null);
    setMovement({ type: "IN", quantity: "", note: "" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {products.length === 0 && !creating ? <p className="text-sm text-foreground/70">{t("empty")}</p> : null}

      <ul className="flex flex-col divide-y divide-border">
        {products.map((product) =>
          editingId === product.id ? (
            <li key={product.id} className="flex flex-col gap-2 py-3">
              <DraftFields draft={draft} setDraft={setDraft} t={t} />
              <div className="flex gap-2">
                <Button size="sm" isLoading={submitting} onClick={() => save(product.id, draft)}>
                  {t("save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  {t("cancel")}
                </Button>
              </div>
            </li>
          ) : (
            <li key={product.id} className="flex flex-col gap-2 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-foreground">{product.name}</span>
                  <span className="ms-2 text-xs text-foreground/70" dir="ltr">
                    {product.sku}
                  </span>
                  <span className="ms-2 text-foreground/60" dir="ltr">
                    {product.currentPrice} {product.currentCurrency}
                  </span>
                  {product.trackStock ? (
                    <Badge tone="info" className="ms-2">
                      {t("stock", { level: product.stockLevel ?? "0" })}
                    </Badge>
                  ) : null}
                  {!product.isActive ? (
                    <Badge tone="neutral" className="ms-2">
                      {t("inactive")}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {product.trackStock ? (
                    <Button size="sm" variant="ghost" onClick={() => setMovementProductId(product.id)}>
                      {t("addMovement")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(product.id);
                      setDraft(toDraft(product));
                    }}
                  >
                    {t("edit")}
                  </Button>
                </div>
              </div>

              {movementProductId === product.id ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                  <select
                    className={inputClass}
                    value={movement.type}
                    onChange={(event) => setMovement({ ...movement, type: event.target.value as "IN" | "OUT" | "ADJUSTMENT" })}
                  >
                    <option value="IN">{t("movementType.IN")}</option>
                    <option value="OUT">{t("movementType.OUT")}</option>
                    <option value="ADJUSTMENT">{t("movementType.ADJUSTMENT")}</option>
                  </select>
                  <input
                    type="number"
                    className={inputClass}
                    placeholder={t("quantity")}
                    value={movement.quantity}
                    onChange={(event) => setMovement({ ...movement, quantity: event.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder={t("note")}
                    value={movement.note}
                    onChange={(event) => setMovement({ ...movement, note: event.target.value })}
                  />
                  <Button size="sm" isLoading={submitting} onClick={() => submitMovement(product.id)}>
                    {t("save")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setMovementProductId(null)}>
                    {t("cancel")}
                  </Button>
                </div>
              ) : null}
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

function DraftFields({ draft, setDraft, t }: { draft: Draft; setDraft: (draft: Draft) => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <select className={inputClass} value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as ProductKind })}>
        {PRODUCT_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {t(`kind.${kind}`)}
          </option>
        ))}
      </select>
      <input placeholder={t("sku")} value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} className={inputClass} />
      <input
        placeholder={t("nameFr")}
        value={draft.translations.fr.name}
        onChange={(event) => setDraft({ ...draft, translations: { ...draft.translations, fr: { ...draft.translations.fr, name: event.target.value } } })}
        className={inputClass}
      />
      <input
        placeholder={t("nameEn")}
        value={draft.translations.en.name}
        onChange={(event) => setDraft({ ...draft, translations: { ...draft.translations, en: { ...draft.translations.en, name: event.target.value } } })}
        className={inputClass}
      />
      <input
        placeholder={t("nameAr")}
        value={draft.translations.ar.name}
        dir="rtl"
        onChange={(event) => setDraft({ ...draft, translations: { ...draft.translations, ar: { ...draft.translations.ar, name: event.target.value } } })}
        className={inputClass}
      />
      <input placeholder={t("unit")} value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} className={inputClass} />
      <input
        type="number"
        placeholder={t("currentPrice")}
        value={draft.currentPrice}
        onChange={(event) => setDraft({ ...draft, currentPrice: event.target.value })}
        className={inputClass}
      />
      <input
        placeholder={t("currentCurrency")}
        value={draft.currentCurrency}
        onChange={(event) => setDraft({ ...draft, currentCurrency: event.target.value.toUpperCase() })}
        className={inputClass}
      />
      <input
        type="number"
        placeholder={t("minQuantity")}
        value={draft.minQuantity}
        onChange={(event) => setDraft({ ...draft, minQuantity: event.target.value })}
        className={inputClass}
      />
      <input
        type="number"
        placeholder={t("maxQuantity")}
        value={draft.maxQuantity}
        onChange={(event) => setDraft({ ...draft, maxQuantity: event.target.value })}
        className={inputClass}
      />
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={draft.trackStock} onChange={(event) => setDraft({ ...draft, trackStock: event.target.checked })} />
        {t("trackStock")}
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
        {t("active")}
      </label>
    </div>
  );
}
