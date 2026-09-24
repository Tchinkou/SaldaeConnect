"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { updatePortalProfileAction } from "@/app/[locale]/portal/profile/actions";

export function PortalProfileForm({
  initialFirstName,
  initialLastName,
  initialPhone,
  initialJobTitle,
}: {
  initialFirstName: string;
  initialLastName: string;
  initialPhone: string;
  initialJobTitle: string;
}) {
  const t = useTranslations("portal.profile.form");
  const router = useRouter();

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(initialPhone);
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const result = await updatePortalProfileAction({ firstName, lastName, phone: phone || null, jobTitle: jobTitle || null });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-first-name" className="text-sm font-medium text-foreground">
            {t("firstName")}
          </label>
          <input
            id="profile-first-name"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-last-name" className="text-sm font-medium text-foreground">
            {t("lastName")}
          </label>
          <input
            id="profile-last-name"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-phone" className="text-sm font-medium text-foreground">
            {t("phone")}
          </label>
          <input
            id="profile-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-job-title" className="text-sm font-medium text-foreground">
            {t("jobTitle")}
          </label>
          <input
            id="profile-job-title"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
      {saved ? <p className="text-sm text-success-600">{t("saved")}</p> : null}

      <div>
        <Button type="submit" isLoading={submitting}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
