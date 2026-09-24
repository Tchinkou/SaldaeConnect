"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const STATUSES = ["PLANNING", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW", "COMPLETED", "ARCHIVED"] as const;

export function ProjectFilters({ currentParams }: { currentParams: Record<string, string | undefined> }) {
  const t = useTranslations("admin.projects");
  const router = useRouter();
  const [q, setQ] = useState(currentParams.q ?? "");

  function setParam(key: string, value: string) {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(currentParams)) if (v) next[k] = v;
    if (value) next[key] = value;
    else delete next[key];
    router.push({ pathname: "/admin/projects", query: next });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="project-filter-search" className="text-xs font-medium text-foreground/70">{t("filters.search")}</label>
        <input
          id="project-filter-search"
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setParam("q", q);
          }}
          onBlur={() => setParam("q", q)}
          placeholder={t("filters.searchPlaceholder")}
          className="h-9 w-48 rounded-md border border-border bg-surface px-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="project-filter-status" className="text-xs font-medium text-foreground/70">{t("filters.status")}</label>
        <select
          id="project-filter-status"
          value={currentParams.status ?? ""}
          onChange={(event) => setParam("status", event.target.value)}
          className="h-9 rounded-md border border-border bg-surface px-2 text-xs"
        >
          <option value="">{t("filters.all")}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`statusValue.${status}`)}
            </option>
          ))}
        </select>
      </div>
      {Object.values(currentParams).some(Boolean) ? (
        <button
          type="button"
          onClick={() => router.push({ pathname: "/admin/projects" })}
          className="h-9 rounded-md px-3 text-xs font-medium text-brand-600 hover:underline"
        >
          {t("filters.reset")}
        </button>
      ) : null}
    </div>
  );
}
