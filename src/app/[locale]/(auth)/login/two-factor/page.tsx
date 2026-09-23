"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TwoFactorPage() {
  const t = useTranslations("auth.twoFactor");
  const router = useRouter();

  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: verifyError } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code });

    setIsSubmitting(false);

    if (verifyError) {
      setError(t("errorInvalidCode"));
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <p className="mt-1 text-sm text-foreground/70">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-sm font-medium text-foreground">
              {useBackupCode ? t("backupCode") : t("code")}
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-center text-lg tracking-[0.3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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

          <button
            type="button"
            onClick={() => {
              setUseBackupCode((previous) => !previous);
              setCode("");
              setError(null);
            }}
            className="text-center text-sm text-brand-600 hover:underline"
          >
            {useBackupCode ? t("useTotpCode") : t("useBackupCode")}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
