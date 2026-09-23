"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DynamicQuestion, type QuestionField } from "@/components/forms/dynamic-question";
import { submitRequestAction } from "@/app/[locale]/(public)/quote/actions";

export interface QuoteWizardService {
  id: string;
  slug: string;
  name: string;
  questionFields: QuestionField[];
}

type AppLocale = "fr" | "en" | "ar";

interface FormState {
  serviceId: string;
  answers: Record<string, string | boolean>;
  budgetMin: string;
  budgetMax: string;
  budgetUnknown: boolean;
  desiredDeadline: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  country: string;
  city: string;
  message: string;
  files: File[];
  privacyAccepted: boolean;
}

const EMPTY_STATE: FormState = {
  serviceId: "",
  answers: {},
  budgetMin: "",
  budgetMax: "",
  budgetUnknown: false,
  desiredDeadline: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  companyName: "",
  country: "",
  city: "",
  message: "",
  files: [],
  privacyAccepted: false,
};

export function QuoteWizard({
  services,
  locale,
  initialServiceSlug,
}: {
  services: QuoteWizardService[];
  locale: AppLocale;
  initialServiceSlug?: string;
}) {
  const t = useTranslations("public.quote");
  const [renderedAt] = useState(() => Date.now());
  const [state, setState] = useState<FormState>(() => ({
    ...EMPTY_STATE,
    serviceId: services.find((s) => s.slug === initialServiceSlug)?.id ?? "",
  }));
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ requestNumber: string } | null>(null);

  const selectedService = services.find((s) => s.id === state.serviceId);
  const hasQuestions = (selectedService?.questionFields.length ?? 0) > 0;

  const steps = useMemo(
    () =>
      (["service", "questions", "budget", "timeline", "contact", "message", "summary"] as const).filter(
        (step) => step !== "questions" || hasQuestions,
      ),
    [hasQuestions],
  );
  const currentStep = steps[stepIndex];

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case "service":
        return state.serviceId !== "";
      case "questions":
        return (selectedService?.questionFields ?? [])
          .filter((f) => f.required)
          .every((f) => {
            const value = state.answers[f.key];
            return f.type === "checkbox" ? Boolean(value) : typeof value === "string" && value !== "";
          });
      case "contact":
        return state.firstName !== "" && state.lastName !== "" && state.email !== "";
      case "message":
        return state.message.trim() !== "";
      case "summary":
        return state.privacyAccepted;
      default:
        return true;
    }
  }

  if (result) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <h2 className="text-xl font-semibold text-foreground">{t("confirmation.title")}</h2>
          <p className="mt-2 text-ink-500">
            {t("confirmation.body", { number: result.requestNumber })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <ol className="mb-8 flex flex-wrap gap-2 text-xs font-medium text-ink-500">
        {steps.map((step, index) => (
          <li
            key={step}
            className={index === stepIndex ? "rounded-full bg-brand-100 px-3 py-1 text-brand-700" : "px-3 py-1"}
          >
            {t(`steps.${step}`)}
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="pt-6">
          {currentStep === "service" ? (
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("service.title")}</h2>
              <select
                value={state.serviceId}
                onChange={(event) => update("serviceId", event.target.value)}
                className="mt-4 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  {t("service.placeholder")}
                </option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {currentStep === "questions" ? (
            <div className="space-y-6">
              {selectedService?.questionFields.map((field) => (
                <DynamicQuestion
                  key={field.key}
                  field={field}
                  locale={locale}
                  value={state.answers[field.key]}
                  onChange={(value) => update("answers", { ...state.answers, [field.key]: value })}
                />
              ))}
            </div>
          ) : null}

          {currentStep === "budget" ? (
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("budget.title")}</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="Min (DZD)"
                  value={state.budgetMin}
                  disabled={state.budgetUnknown}
                  onChange={(event) => update("budgetMin", event.target.value)}
                  className="w-40 rounded-md border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50"
                />
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="Max (DZD)"
                  value={state.budgetMax}
                  disabled={state.budgetUnknown}
                  onChange={(event) => update("budgetMax", event.target.value)}
                  className="w-40 rounded-md border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50"
                />
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={state.budgetUnknown}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      budgetUnknown: event.target.checked,
                      budgetMin: "",
                      budgetMax: "",
                    }))
                  }
                  className="h-4 w-4 rounded border-border"
                />
                {t("budget.unknown")}
              </label>
            </div>
          ) : null}

          {currentStep === "timeline" ? (
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("timeline.title")}</h2>
              <input
                type="date"
                dir="ltr"
                value={state.desiredDeadline}
                onChange={(event) => update("desiredDeadline", event.target.value)}
                className="mt-4 block w-full max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          {currentStep === "contact" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t("contactStep.title")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("contactStep.firstName")} value={state.firstName} onChange={(v) => update("firstName", v)} required />
                <Field label={t("contactStep.lastName")} value={state.lastName} onChange={(v) => update("lastName", v)} required />
                <Field label={t("contactStep.email")} type="email" dir="ltr" value={state.email} onChange={(v) => update("email", v)} required />
                <Field label={t("contactStep.phone")} type="tel" dir="ltr" value={state.phone} onChange={(v) => update("phone", v)} />
                <Field label={t("contactStep.companyName")} value={state.companyName} onChange={(v) => update("companyName", v)} />
                <Field label={t("contactStep.country")} value={state.country} onChange={(v) => update("country", v)} />
                <Field label={t("contactStep.city")} value={state.city} onChange={(v) => update("city", v)} />
              </div>
            </div>
          ) : null}

          {currentStep === "message" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t("messageStep.title")}</h2>
              <div>
                <label className="block text-sm font-medium text-foreground">{t("messageStep.message")}</label>
                <textarea
                  rows={5}
                  value={state.message}
                  onChange={(event) => update("message", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">{t("messageStep.files")}</label>
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => update("files", Array.from(event.target.files ?? []))}
                  className="mt-1 block w-full text-sm"
                />
                <p className="mt-1 text-xs text-ink-500">{t("messageStep.filesHint")}</p>
              </div>
            </div>
          ) : null}

          {currentStep === "summary" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">{t("summary.title")}</h2>
              <dl className="space-y-2 text-sm">
                <SummaryRow label={t("service.title")} value={selectedService?.name} />
                <SummaryRow label={t("contactStep.title")} value={`${state.firstName} ${state.lastName} — ${state.email}`} />
                <SummaryRow label={t("messageStep.message")} value={state.message} />
                {state.files.length > 0 ? (
                  <SummaryRow label={t("messageStep.files")} value={state.files.map((f) => f.name).join(", ")} />
                ) : null}
              </dl>
              <p className="text-xs text-ink-500">{t("summary.privacy")}</p>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={state.privacyAccepted}
                  onChange={(event) => update("privacyAccepted", event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {t("summary.privacyAccept")}
              </label>
              {error ? <p className="text-sm text-danger-600">{error}</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          disabled={stepIndex === 0 || submitting}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          {t("actions.back")}
        </Button>

        {currentStep === "summary" ? (
          <Button
            type="button"
            isLoading={submitting}
            disabled={!canProceed()}
            onClick={async () => {
              setSubmitting(true);
              setError(null);
              const submission = await submitRequestAction({
                locale,
                serviceId: state.serviceId,
                answers: state.answers,
                budgetMin: state.budgetUnknown || state.budgetMin === "" ? undefined : Number(state.budgetMin),
                budgetMax: state.budgetUnknown || state.budgetMax === "" ? undefined : Number(state.budgetMax),
                desiredDeadline: state.desiredDeadline || undefined,
                firstName: state.firstName,
                lastName: state.lastName,
                email: state.email,
                phone: state.phone || undefined,
                companyName: state.companyName || undefined,
                country: state.country || undefined,
                city: state.city || undefined,
                message: state.message,
                files: state.files,
                privacyAccepted: state.privacyAccepted as true,
                renderedAt,
              });
              setSubmitting(false);
              if (submission.ok) {
                setResult(submission.data);
              } else {
                setError(
                  submission.error.includes("Trop de")
                    ? t("errors.tooManyRequests")
                    : t("errors.generic"),
                );
              }
            }}
          >
            {t("summary.submit")}
          </Button>
        ) : (
          <Button type="button" disabled={!canProceed()} onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}>
            {t("actions.next")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  dir,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  dir?: "ltr";
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        dir={dir}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
