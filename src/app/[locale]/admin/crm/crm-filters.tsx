"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function CrmFilters({
  staff,
  services,
  sources,
  currentParams,
}: {
  staff: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  sources: Array<{ id: string; name: string }>;
  currentParams: Record<string, string | undefined>;
}) {
  const t = useTranslations("admin.crm.filters");
  const router = useRouter();

  function setParam(key: string, value: string) {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(currentParams)) {
      if (v) next[k] = v;
    }
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    router.push({ pathname: "/admin/crm", query: next });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3">
      <FilterSelect
        id="crm-filter-owner"
        label={t("owner")}
        value={currentParams.ownerId ?? ""}
        onChange={(v) => setParam("ownerId", v)}
        options={staff.map((s) => ({ value: s.id, label: s.name }))}
        allLabel={t("all")}
      />
      <FilterSelect
        id="crm-filter-service"
        label={t("service")}
        value={currentParams.serviceId ?? ""}
        onChange={(v) => setParam("serviceId", v)}
        options={services.map((s) => ({ value: s.id, label: s.name }))}
        allLabel={t("all")}
      />
      <FilterSelect
        id="crm-filter-source"
        label={t("source")}
        value={currentParams.sourceId ?? ""}
        onChange={(v) => setParam("sourceId", v)}
        options={sources.map((s) => ({ value: s.id, label: s.name }))}
        allLabel={t("all")}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="crm-filter-date-from" className="text-xs font-medium text-foreground/70">{t("period")}</label>
        <div className="flex items-center gap-1">
          <input
            id="crm-filter-date-from"
            type="date"
            dir="ltr"
            value={currentParams.dateFrom ?? ""}
            onChange={(event) => setParam("dateFrom", event.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
          />
          <span className="text-xs text-foreground/70">–</span>
          <input
            aria-label={t("period")}
            type="date"
            dir="ltr"
            value={currentParams.dateTo ?? ""}
            onChange={(event) => setParam("dateTo", event.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="crm-filter-min-amount" className="text-xs font-medium text-foreground/70">{t("amount")}</label>
        <div className="flex items-center gap-1">
          <input
            id="crm-filter-min-amount"
            type="number"
            min={0}
            dir="ltr"
            placeholder="Min"
            value={currentParams.minAmount ?? ""}
            onChange={(event) => setParam("minAmount", event.target.value)}
            className="h-9 w-24 rounded-md border border-border bg-surface px-2 text-xs"
          />
          <span className="text-xs text-foreground/70">–</span>
          <input
            aria-label={t("amount")}
            type="number"
            min={0}
            dir="ltr"
            placeholder="Max"
            value={currentParams.maxAmount ?? ""}
            onChange={(event) => setParam("maxAmount", event.target.value)}
            className="h-9 w-24 rounded-md border border-border bg-surface px-2 text-xs"
          />
        </div>
      </div>
      {Object.values(currentParams).some(Boolean) ? (
        <button
          type="button"
          onClick={() => router.push({ pathname: "/admin/crm" })}
          className="h-9 rounded-md px-3 text-xs font-medium text-brand-600 hover:underline"
        >
          {t("reset")}
        </button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-foreground/70">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
