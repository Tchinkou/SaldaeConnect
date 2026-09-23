"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/core/action";

const ACTIVITY_TYPES = ["NOTE", "CALL", "EMAIL", "MEETING", "WHATSAPP"] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function AddActivityForm<T extends Record<string, unknown>>({
  action,
  extraInput,
}: {
  action: (input: T & { type: ActivityType; subject?: string | null; body: string }) => Promise<ActionResult<{ id: string }>>;
  extraInput: T;
}) {
  const t = useTranslations("admin.crm.activity");
  const router = useRouter();
  const [type, setType] = useState<ActivityType>("NOTE");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        const result = await action({ ...extraInput, type, subject: subject || null, body });
        setSubmitting(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSubject("");
        setBody("");
        setType("NOTE");
        router.refresh();
      }}
    >
      <div className="flex flex-wrap gap-2">
        <select
          value={type}
          onChange={(event) => setType(event.target.value as ActivityType)}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
        >
          {ACTIVITY_TYPES.map((option) => (
            <option key={option} value={option}>
              {t(`type.${option}`)}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={t("subjectPlaceholder")}
          className="h-9 flex-1 rounded-md border border-border bg-surface px-2 text-sm"
        />
      </div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("bodyPlaceholder")}
        rows={2}
        required
        className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
      />
      {error ? <p className="text-xs text-danger-600">{error}</p> : null}
      <div>
        <Button type="submit" isLoading={submitting} size="sm">
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
