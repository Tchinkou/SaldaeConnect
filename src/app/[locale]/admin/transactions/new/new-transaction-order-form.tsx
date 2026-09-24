"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createTransactionOrderAction } from "@/server/core/transactions/transaction-order-actions";

type Product = { id: string; sku: string; name: string; currentPrice: string; currentCurrency: string };
type LineItem = { productId: string; quantity: string };

export function NewTransactionOrderForm({
  clients,
  products,
}: {
  clients: Array<{ id: string; displayName: string; code: string }>;
  products: Product[];
}) {
  const t = useTranslations("admin.transactions.create");
  const router = useRouter();

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [items, setItems] = useState<LineItem[]>([{ productId: products[0]?.id ?? "", quantity: "1" }]);
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createTransactionOrderAction({
      clientId,
      items: items.filter((item) => item.productId).map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
      documentType: documentType || null,
      documentNumber: documentNumber || null,
      notes: notes || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/admin/transactions/${result.data.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        {clients.length === 0 || products.length === 0 ? (
          <p className="text-sm text-foreground/60">{t("missingPrerequisites")}</p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-transaction-client" className="text-sm font-medium text-foreground">{t("client")}</label>
              <select id="new-transaction-client" value={clientId} onChange={(event) => setClientId(event.target.value)} required className="h-10 rounded-md border border-border bg-surface px-3 text-sm">
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName} ({client.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="new-transaction-item-product" className="text-sm font-medium text-foreground">{t("items")}</label>
              {items.map((item, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <select
                    id={index === 0 ? "new-transaction-item-product" : undefined}
                    value={item.productId}
                    onChange={(event) => updateItem(index, { productId: event.target.value })}
                    className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm"
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.currentPrice} {product.currentCurrency})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) => updateItem(index, { quantity: event.target.value })}
                    className="h-10 w-28 rounded-md border border-border bg-surface px-3 text-sm"
                  />
                  {items.length > 1 ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>
                      {t("remove")}
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => setItems([...items, { productId: products[0]?.id ?? "", quantity: "1" }])}
              >
                {t("addItem")}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                placeholder={t("documentType")}
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
              <input
                placeholder={t("documentNumber")}
                value={documentNumber}
                onChange={(event) => setDocumentNumber(event.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>

            <textarea
              placeholder={t("notes")}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />

            {error ? <p className="text-sm text-danger-600">{error}</p> : null}

            <div>
              <Button type="submit" isLoading={submitting} disabled={!clientId}>
                {t("submit")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
