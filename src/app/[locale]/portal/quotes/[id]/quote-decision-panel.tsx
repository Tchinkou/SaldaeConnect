"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptQuoteAction, rejectQuoteAction, requestQuoteChangesAction } from "@/app/[locale]/portal/quotes/[id]/actions";

type Mode = null | "accept" | "reject" | "changes";

/** Les trois décisions possibles côté client sur un devis envoyé (§F.3, §J). */
export function QuoteDecisionPanel({ quoteId, defaultSignerName }: { quoteId: string; defaultSignerName: string }) {
  const t = useTranslations("portal.quoteDetail.decision");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitAccept() {
    setSubmitting(true);
    setError(null);
    const result = await acceptQuoteAction({ quoteId, signerName });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function submitReject() {
    setSubmitting(true);
    setError(null);
    const result = await rejectQuoteAction({ quoteId, reason: reason || null });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function submitChanges() {
    if (!comment.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await requestQuoteChangesAction({ quoteId, comment });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("heading")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {mode === null ? (
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => setMode("accept")}>
              {t("accept.submit")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMode("changes")}>
              {t("requestChanges.submit")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("reject")}>
              {t("reject.submit")}
            </Button>
          </div>
        ) : null}

        {mode === "accept" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitAccept();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quote-decision-signer-name" className="text-sm font-medium text-foreground">
                {t("accept.signerName")}
              </label>
              <input
                id="quote-decision-signer-name"
                required
                value={signerName}
                onChange={(event) => setSignerName(event.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              />
            </div>
            <p className="text-xs text-foreground/60">{t("accept.confirm")}</p>
            {error ? <p className="text-sm text-danger-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" isLoading={submitting}>
                {t("accept.submit")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode(null)} disabled={submitting}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "reject" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitReject();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quote-decision-reject-reason" className="text-sm font-medium text-foreground">
                {t("reject.reason")}
              </label>
              <textarea
                id="quote-decision-reject-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>
            {error ? <p className="text-sm text-danger-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" variant="danger" isLoading={submitting}>
                {t("reject.submit")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode(null)} disabled={submitting}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : null}

        {mode === "changes" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitChanges();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="quote-decision-changes-comment" className="text-sm font-medium text-foreground">
                {t("requestChanges.comment")}
              </label>
              <textarea
                id="quote-decision-changes-comment"
                required
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>
            {error ? <p className="text-sm text-danger-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" variant="secondary" isLoading={submitting}>
                {t("requestChanges.submit")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode(null)} disabled={submitting}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
