"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createInvoiceAction } from "@/app/[locale]/admin/invoices/actions";

export function NewInvoiceForm({ clients }: { clients: Array<{ id: string; displayName: string; code: string }> }) {
  const t = useTranslations("admin.invoices.create");
  const tType = useTranslations("admin.invoices.typeValue");
  const router = useRouter();

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [type, setType] = useState<"STANDARD" | "DEPOSIT">("STANDARD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="text-sm text-foreground/60">{t("noClients")}</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setSubmitting(true);
              setError(null);
              const result = await createInvoiceAction({ clientId, type });
              setSubmitting(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push(`/admin/invoices/${result.data.invoiceId}`);
              router.refresh();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t("client")}</label>
              <select
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                required
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName} ({client.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t("type")}</label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as "STANDARD" | "DEPOSIT")}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="STANDARD">{tType("STANDARD")}</option>
                <option value="DEPOSIT">{tType("DEPOSIT")}</option>
              </select>
            </div>

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
