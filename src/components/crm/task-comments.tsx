"use client";

import { useEffect, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listCommentsAction, addCommentAction } from "@/server/core/crm/comment-actions";

type CommentRow = {
  id: string;
  body: string;
  visibleToClient: boolean;
  createdAt: string;
  authorName: string | null;
};

export function TaskComments({ taskId, isProjectTask }: { taskId: string; isProjectTask: boolean }) {
  const t = useTranslations("admin.crm.task.comment");
  const format = useFormatter();
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCommentsAction({ taskId }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) setComments(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-2">
      {loading ? (
        <p className="text-xs text-foreground/50">{t("loading")}</p>
      ) : comments && comments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md bg-background p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{comment.authorName ?? t("unknownAuthor")}</span>
                <div className="flex items-center gap-2">
                  {isProjectTask && comment.visibleToClient ? <Badge tone="info">{t("visibleToClient")}</Badge> : null}
                  <span className="text-foreground/50">{format.dateTime(new Date(comment.createdAt), { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-foreground/80">{comment.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-foreground/50">{t("empty")}</p>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);
          const result = await addCommentAction({ taskId, body, visibleToClient });
          setSubmitting(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setBody("");
          setVisibleToClient(false);
          const refreshed = await listCommentsAction({ taskId });
          if (refreshed.ok) setComments(refreshed.data);
        }}
      >
        <textarea
          required
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t("bodyPlaceholder")}
          className="rounded-md border border-border bg-surface p-2 text-xs"
        />
        <div className="flex items-center justify-between gap-2">
          {isProjectTask ? (
            <label className="flex items-center gap-1.5 text-xs text-foreground/70">
              <input
                type="checkbox"
                checked={visibleToClient}
                onChange={(event) => setVisibleToClient(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t("visibleToClient")}
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" isLoading={submitting}>
            {t("add")}
          </Button>
        </div>
        {error ? <p className="text-xs text-danger-600">{error}</p> : null}
      </form>
    </div>
  );
}
