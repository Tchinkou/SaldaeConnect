"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { upsertTestimonialAction } from "@/app/[locale]/admin/content/testimonials/actions";

export function TestimonialForm({
  id,
  initial,
}: {
  id: string | null;
  initial: {
    authorName: string;
    company: string;
    jobTitle: string;
    content: string;
    rating: number | null;
    publicationConsent: boolean;
    isActive: boolean;
    order: number;
  };
}) {
  const t = useTranslations("admin.content");
  const router = useRouter();

  const [state, setState] = useState(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await upsertTestimonialAction({
      id,
      authorName: state.authorName,
      company: state.company || null,
      jobTitle: state.jobTitle || null,
      content: state.content,
      rating: state.rating,
      publicationConsent: state.publicationConsent,
      isActive: state.isActive,
      order: state.order,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/content/testimonials");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="testimonial-author-name" className="text-sm font-medium text-foreground">{t("testimonials.authorName")}</label>
          <input
            id="testimonial-author-name"
            type="text"
            value={state.authorName}
            onChange={(event) => setState((s) => ({ ...s, authorName: event.target.value }))}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="testimonial-company" className="text-sm font-medium text-foreground">{t("testimonials.company")}</label>
          <input
            id="testimonial-company"
            type="text"
            value={state.company}
            onChange={(event) => setState((s) => ({ ...s, company: event.target.value }))}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="testimonial-job-title" className="text-sm font-medium text-foreground">{t("testimonials.jobTitle")}</label>
          <input
            id="testimonial-job-title"
            type="text"
            value={state.jobTitle}
            onChange={(event) => setState((s) => ({ ...s, jobTitle: event.target.value }))}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="testimonial-order" className="text-sm font-medium text-foreground">{t("order")}</label>
          <input
            id="testimonial-order"
            type="number"
            min={0}
            dir="ltr"
            value={state.order}
            onChange={(event) => setState((s) => ({ ...s, order: Number(event.target.value) }))}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="testimonial-content" className="text-sm font-medium text-foreground">{t("testimonials.content")}</label>
        <textarea
          id="testimonial-content"
          rows={4}
          value={state.content}
          onChange={(event) => setState((s) => ({ ...s, content: event.target.value }))}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={state.publicationConsent}
          onChange={(event) => setState((s) => ({ ...s, publicationConsent: event.target.checked }))}
          className="h-4 w-4 rounded border-border"
        />
        {t("testimonials.publicationConsent")}
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={state.isActive}
          onChange={(event) => setState((s) => ({ ...s, isActive: event.target.checked }))}
          className="h-4 w-4 rounded border-border"
        />
        {t("active")}
      </label>

      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {t("save")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/content/testimonials")}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
