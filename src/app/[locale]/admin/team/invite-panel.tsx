"use client";

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { inviteStaffAction } from "./actions";

export function InvitePanel({ roles }: { roles: { id: string; name: string }[] }) {
  const t = useTranslations("admin.team");
  const locale = useLocale() as "fr" | "en" | "ar";
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const result = await inviteStaffAction({ email, roleId, locale });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSuccess(t("inviteSuccess", { email }));
    setEmail("");
    setIsOpen(false);
    router.refresh();
  }

  if (!isOpen) {
    return (
      <div className="flex flex-col gap-2">
        <Button type="button" onClick={() => setIsOpen(true)} size="sm">
          {t("invite")}
        </Button>
        {success ? <p className="text-sm text-success-600">{success}</p> : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-border bg-surface-muted p-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
          {t("email")}
        </label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-role" className="text-sm font-medium text-foreground">
          {t("role")}
        </label>
        <select
          id="invite-role"
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" isLoading={isSubmitting} size="sm">
          {t("send")}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger-600 sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}
