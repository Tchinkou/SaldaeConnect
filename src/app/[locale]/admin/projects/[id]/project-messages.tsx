"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listProjectMessagesAction, sendProjectMessageAction } from "@/server/core/projects/messaging-actions";

type MessageRow = {
  id: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  authorName: string | null;
  fromClient: boolean;
  files: Array<{ id: string; originalName: string; sizeBytes: string }>;
};

export function ProjectMessages({ projectId }: { projectId: string }) {
  const t = useTranslations("admin.projects.detail.message");
  const format = useFormatter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const result = await listProjectMessagesAction({ projectId });
    setLoading(false);
    if (result.ok) setMessages(result.data);
  }

  useEffect(() => {
    let cancelled = false;
    listProjectMessagesAction({ projectId }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) setMessages(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <p className="text-sm text-foreground/70">{t("loading")}</p>
      ) : messages && messages.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`rounded-md p-3 text-sm ${message.isInternalNote ? "bg-warning-50 border border-warning-200" : "bg-background"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {message.authorName ?? t("unknownAuthor")}
                  {message.fromClient ? <Badge tone="info" className="ms-2">{t("fromClient")}</Badge> : null}
                  {message.isInternalNote ? <Badge tone="warning" className="ms-2">{t("internalNote")}</Badge> : null}
                </span>
                <span className="text-xs text-foreground/70">
                  {format.dateTime(new Date(message.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-foreground/80">{message.body}</p>
              {message.files.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {message.files.map((file) => (
                    <li key={file.id}>
                      <a href={`/api/files/${file.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                        📎 {file.originalName}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/70">{t("empty")}</p>
      )}

      <form
        className="flex flex-col gap-2 rounded-md border border-border p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);
          const files = fileInputRef.current?.files ? Array.from(fileInputRef.current.files) : [];
          const result = await sendProjectMessageAction({ projectId, body, isInternalNote, files });
          setSubmitting(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setBody("");
          setIsInternalNote(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          await refresh();
        }}
      >
        <textarea
          required
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t("bodyPlaceholder")}
          className="rounded-md border border-border bg-surface p-2 text-sm"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" multiple className="text-xs" />
            <label className="flex items-center gap-1.5 text-xs text-foreground/70">
              <input
                type="checkbox"
                checked={isInternalNote}
                onChange={(event) => setIsInternalNote(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t("internalNote")}
            </label>
          </div>
          <Button type="submit" size="sm" isLoading={submitting}>
            {t("add")}
          </Button>
        </div>
        {error ? <p className="text-xs text-danger-600">{error}</p> : null}
      </form>
    </div>
  );
}
