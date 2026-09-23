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
        label={t("owner")}
        value={currentParams.ownerId ?? ""}
        onChange={(v) => setParam("ownerId", v)}
        options={staff.map((s) => ({ value: s.id, label: s.name }))}
        allLabel={t("all")}
      />
      <FilterSelect
        label={t("service")}
        value={currentParams.serviceId ?? ""}
        onChange={(v) => setParam("serviceId", v)}
        options={services.map((s) => ({ value: s.id, label: s.name }))}
        allLabel={t("all")}
      />
      <FilterSelect
        label={t("source")}
        value={currentParams.sourceId ?? ""}
        onChange={(v) => setParam("sourceId", v)}
        options={sources.map((s) => ({ value: s.id, label: s.name }))}
        allLabel={t("all")}
      />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground/70">{t("period")}</label>
        <div className="flex items-center gap-1">
          <input
            type="date"
            dir="ltr"
            value={currentParams.dateFrom ?? ""}
            onChange={(event) => setParam("dateFrom", event.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
          />
          <span className="text-xs text-foreground/50">–</span>
          <input
            type="date"
            dir="ltr"
            value={currentParams.dateTo ?? ""}
            onChange={(event) => setParam("dateTo", event.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground/70">{t("amount")}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            dir="ltr"
            placeholder="Min"
            value={currentParams.minAmount ?? ""}
            onChange={(event) => setParam("minAmount", event.target.value)}
            className="h-9 w-24 rounded-md border border-border bg-surface px-2 text-xs"
          />
          <span className="text-xs text-foreground/50">–</span>
          <input
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
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-foreground/70">{label}</label>
      <select
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
