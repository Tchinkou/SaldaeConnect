"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createRedirectAction, deleteRedirectAction } from "./actions";

export type RedirectRow = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  hits: number;
};

const inputClass =
  "h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

type Draft = { fromPath: string; toPath: string; statusCode: 301 | 302 };

const emptyDraft: Draft = { fromPath: "", toPath: "", statusCode: 301 };

export function RedirectsForm({ redirects }: { redirects: RedirectRow[] }) {
  const t = useTranslations("admin.content.redirects");
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setSubmitting(true);
    setError(null);
    const result = await createRedirectAction(draft);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreating(false);
    setDraft(emptyDraft);
    router.refresh();
  }

  async function remove(id: string) {
    setSubmitting(true);
    setError(null);
    const result = await deleteRedirectAction({ redirectId: id });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {redirects.length === 0 && !creating ? <p className="text-sm text-foreground/50">{t("empty")}</p> : null}

      <ul className="flex flex-col divide-y divide-border">
        {redirects.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div dir="ltr">
              <span className="font-medium text-foreground">{entry.fromPath}</span>
              <span className="mx-2 text-foreground/40">→</span>
              <span className="text-foreground/70">{entry.toPath}</span>
              <Badge tone={entry.statusCode === 301 ? "info" : "neutral"} className="ms-2">
                {entry.statusCode}
              </Badge>
              <span className="ms-2 text-xs text-foreground/50">{t("hits", { count: entry.hits })}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(entry.id)} isLoading={submitting}>
              {t("remove")}
            </Button>
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              placeholder={t("fromPath")}
              dir="ltr"
              value={draft.fromPath}
              onChange={(event) => setDraft({ ...draft, fromPath: event.target.value })}
              className={inputClass}
            />
            <input
              placeholder={t("toPath")}
              dir="ltr"
              value={draft.toPath}
              onChange={(event) => setDraft({ ...draft, toPath: event.target.value })}
              className={inputClass}
            />
            <select
              value={draft.statusCode}
              onChange={(event) => setDraft({ ...draft, statusCode: Number(event.target.value) as 301 | 302 })}
              className={inputClass}
            >
              <option value={301}>301 — {t("permanent")}</option>
              <option value={302}>302 — {t("temporary")}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" isLoading={submitting} onClick={add}>
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
