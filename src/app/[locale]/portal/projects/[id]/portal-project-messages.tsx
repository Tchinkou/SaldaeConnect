"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Button } from "@/components/ui/button";
import { listPortalProjectMessagesAction, sendPortalProjectMessageAction } from "@/server/core/projects/messaging-actions";

type MessageRow = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
  files: Array<{ id: string; originalName: string }>;
};

export function PortalProjectMessages({ projectId }: { projectId: string }) {
  const t = useTranslations("portal.projects.detail.message");
  const format = useFormatter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const result = await listPortalProjectMessagesAction({ projectId });
    setLoading(false);
    if (result.ok) setMessages(result.data);
  }

  useEffect(() => {
    let cancelled = false;
    listPortalProjectMessagesAction({ projectId }).then((result) => {
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
        <p className="text-sm text-foreground/50">{t("loading")}</p>
      ) : messages && messages.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {messages.map((message) => (
            <li key={message.id} className="rounded-md bg-background p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{message.authorName ?? t("unknownAuthor")}</span>
                <span className="text-xs text-foreground/50">
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
        <p className="text-sm text-foreground/50">{t("empty")}</p>
      )}

      <form
        className="flex flex-col gap-2 rounded-md border border-border p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);
          const files = fileInputRef.current?.files ? Array.from(fileInputRef.current.files) : [];
          const result = await sendPortalProjectMessageAction({ projectId, body, files });
          setSubmitting(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setBody("");
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
        <div className="flex items-center justify-between gap-2">
          <input ref={fileInputRef} type="file" multiple className="text-xs" />
          <Button type="submit" size="sm" isLoading={submitting}>
            {t("add")}
          </Button>
        </div>
        {error ? <p className="text-xs text-danger-600">{error}</p> : null}
      </form>
    </div>
  );
}
