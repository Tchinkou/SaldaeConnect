"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/** Changement de mot de passe en libre-service — exige le mot de passe actuel (Better Auth `changePassword`). */
export function ChangePasswordForm() {
  const t = useTranslations("portal.profile.password");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);

    if (newPassword !== confirmPassword) {
      setError(t("errorMismatch"));
      return;
    }

    setSubmitting(true);
    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setSubmitting(false);

    if (changeError) {
      setError(changeError.message ?? t("errorGeneric"));
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDone(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="change-password-current" className="text-sm font-medium text-foreground">
          {t("currentPassword")}
        </label>
        <input
          id="change-password-current"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="change-password-new" className="text-sm font-medium text-foreground">
          {t("newPassword")}
        </label>
        <input
          id="change-password-new"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="change-password-confirm" className="text-sm font-medium text-foreground">
          {t("confirmPassword")}
        </label>
        <input
          id="change-password-confirm"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        />
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}
      {done ? <p className="text-sm text-success-600">{t("success")}</p> : null}

      <div>
        <Button type="submit" isLoading={submitting}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
