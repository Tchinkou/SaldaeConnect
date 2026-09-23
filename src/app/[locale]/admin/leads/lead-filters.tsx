"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function LeadFilters({
  staff,
  sources,
  currentParams,
}: {
  staff: Array<{ id: string; name: string }>;
  sources: Array<{ id: string; name: string }>;
  currentParams: Record<string, string | undefined>;
}) {
  const t = useTranslations("admin.crm.filters");
  const router = useRouter();
  const [q, setQ] = useState(currentParams.q ?? "");

  function setParam(key: string, value: string) {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(currentParams)) if (v) next[k] = v;
    if (value) next[key] = value;
    else delete next[key];
    router.push({ pathname: "/admin/leads", query: next });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground/70">{t("search")}</label>
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setParam("q", q);
          }}
          onBlur={() => setParam("q", q)}
          placeholder={t("searchPlaceholder")}
          className="h-9 w-48 rounded-md border border-border bg-surface px-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground/70">{t("status")}</label>
        <select
          value={currentParams.status ?? ""}
          onChange={(event) => setParam("status", event.target.value)}
          className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
        >
          <option value="">{t("all")}</option>
          <option value="OPEN">{t("statusValue.OPEN")}</option>
          <option value="CONVERTED">{t("statusValue.CONVERTED")}</option>
          <option value="DISQUALIFIED">{t("statusValue.DISQUALIFIED")}</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground/70">{t("source")}</label>
        <select
          value={currentParams.sourceId ?? ""}
          onChange={(event) => setParam("sourceId", event.target.value)}
          className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
        >
          <option value="">{t("all")}</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-foreground/70">{t("owner")}</label>
        <select
          value={currentParams.ownerId ?? ""}
          onChange={(event) => setParam("ownerId", event.target.value)}
          className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
        >
          <option value="">{t("all")}</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      {Object.values(currentParams).some(Boolean) ? (
        <button
          type="button"
          onClick={() => router.push({ pathname: "/admin/leads" })}
          className="h-9 rounded-md px-3 text-xs font-medium text-brand-600 hover:underline"
        >
          {t("reset")}
        </button>
      ) : null}
    </div>
  );
}
