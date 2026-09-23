"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { updateSettingAction, type SocialSettingValue } from "./actions";

export function SocialForm({ initial }: { initial: Partial<SocialSettingValue> }) {
  const t = useTranslations("admin.settings");
  const [social, setSocial] = useState<SocialSettingValue>({
    facebook: initial.facebook ?? "",
    instagram: initial.instagram ?? "",
    linkedin: initial.linkedin ?? "",
    whatsapp: initial.whatsapp ?? "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    const result = await updateSettingAction({ key: "social", value: social });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  const fields: Array<{ key: keyof SocialSettingValue; label: string; placeholder: string }> = [
    { key: "facebook", label: t("social.facebook"), placeholder: "https://facebook.com/…" },
    { key: "instagram", label: t("social.instagram"), placeholder: "https://instagram.com/…" },
    { key: "linkedin", label: t("social.linkedin"), placeholder: "https://linkedin.com/company/…" },
    { key: "whatsapp", label: t("social.whatsapp"), placeholder: "+213…" },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label htmlFor={`social-${field.key}`} className="text-sm font-medium text-foreground">
              {field.label}
            </label>
            <input
              id={`social-${field.key}`}
              type="text"
              placeholder={field.placeholder}
              value={social[field.key]}
              onChange={(event) => setSocial({ ...social, [field.key]: event.target.value })}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-sm text-success-600">{t("saved")}</p> : null}

      <Button type="submit" isLoading={isSubmitting} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}
