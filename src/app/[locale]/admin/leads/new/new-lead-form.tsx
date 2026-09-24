"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createLeadAction } from "@/app/[locale]/admin/leads/actions";

export function NewLeadForm({
  sources,
  services,
}: {
  sources: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("admin.crm.newLead");
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [serviceId, setServiceId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitting(true);
            setError(null);
            const result = await createLeadAction({
              firstName,
              lastName,
              email: email || null,
              phone: phone || null,
              companyName: companyName || null,
              sourceId,
              note: note || null,
              serviceId: serviceId || null,
            });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push(`/admin/leads/${result.data.leadId}`);
            router.refresh();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="new-lead-first-name" label={t("firstName")} value={firstName} onChange={setFirstName} required />
            <TextField id="new-lead-last-name" label={t("lastName")} value={lastName} onChange={setLastName} required />
            <TextField id="new-lead-email" label={t("email")} type="email" dir="ltr" value={email} onChange={setEmail} />
            <TextField id="new-lead-phone" label={t("phone")} type="tel" dir="ltr" value={phone} onChange={setPhone} />
            <TextField id="new-lead-company-name" label={t("companyName")} value={companyName} onChange={setCompanyName} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-lead-source" className="text-sm font-medium text-foreground">{t("source")}</label>
              <select
                id="new-lead-source"
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                required
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              >
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-lead-service" className="text-sm font-medium text-foreground">{t("service")}</label>
            <select
              id="new-lead-service"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
            >
              <option value="">{t("noService")}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-foreground/70">{t("serviceHint")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-lead-note" className="text-sm font-medium text-foreground">{t("note")}</label>
            <textarea
              id="new-lead-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>

          {error ? <p className="text-sm text-danger-600">{error}</p> : null}

          <div>
            <Button type="submit" isLoading={submitting}>
              {t("submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  dir,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  dir?: "ltr";
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      <input
        id={id}
        type={type}
        dir={dir}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
      />
    </div>
  );
}
