"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invalidToken = searchParams.get("error") === "INVALID_TOKEN" || !token;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("errorMismatch"));
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token: token ?? "",
    });
    setIsSubmitting(false);

    if (resetError) {
      setError(t("errorInvalidToken"));
      return;
    }

    setIsDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        {!invalidToken && !isDone ? <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p> : null}
      </CardHeader>
      <CardContent>
        {invalidToken ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-danger-600">{t("errorInvalidToken")}</p>
            <Link href="/forgot-password" className="text-center text-sm text-brand-600 hover:underline">
              {t("title")}
            </Link>
          </div>
        ) : isDone ? (
          <p className="text-sm text-foreground">{t("success")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                {t("password")}
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                {t("confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-danger-600">
                {error}
              </p>
            ) : null}

            <Button type="submit" isLoading={isSubmitting} className="w-full">
              {t("submit")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
